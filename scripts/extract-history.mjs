#!/usr/bin/env node
// Pulls recent project history from two sources:
//   - git log (commit subject + author + timestamp) → Timeline tab
//   - production/session-logs/agent-audit.log       → Audit tab
// Writes src/data/history.generated.json.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_FILE  = path.resolve(__dirname, '../src/data/history.generated.json');

const TIMELINE_LIMIT = 14;
const AUDIT_LIMIT    = 18;

const read = (rel) => {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch { return null; }
};
const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { return null; }
};

// ── Git log → timeline ──
// Format we emit (matches the existing AgentState dot key):
//   [HH:MM, author-or-"you", subject, "ok"]
const userName = git('config user.name') ?? '';
const NOW = Math.floor(Date.now() / 1000);

// Short relative timestamp for the Timeline column (~5 chars):
//   today → "HH:MM"
//   <1d   → "Xh"
//   <7d   → "Xd"
//   else  → "Xw"
function shortAge(tsSec) {
  const d = new Date(tsSec * 1000);
  const today = new Date(NOW * 1000);
  const sameDay = d.toDateString() === today.toDateString();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const diffSec = NOW - tsSec;
  if (diffSec < 86400)  return `${Math.max(1, Math.floor(diffSec / 3600))}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return `${Math.floor(diffSec / 604800)}w`;
}

// Use TAB as field separator — `|` gets interpreted by the shell.
const commitLines = (git(`log -${TIMELINE_LIMIT} --format=%ct%x09%h%x09%s%x09%an`) ?? '')
  .split('\n').filter(Boolean);

const timeline = commitLines.map((line) => {
  const [ctsRaw, , subject, author] = line.split('\t');
  const cts = Number(ctsRaw);
  const actor = author && author === userName ? 'you' : (author || 'unknown');
  return [shortAge(cts), actor, subject ?? '', 'ok'];
});
const lastCommitTs = commitLines.length
  ? Number(commitLines[0].split('\t')[0])
  : null;

// ── Agent audit log → audit tab ──
// Source lines look like:
//   20260516_184704 | Agent invoked: ai-programmer
//   20260516_184747 | Agent completed: ai-programmer
// We emit: ["[HH:MM:SS]", "SPAWN"|"STOP", agent, ""]
function parseAuditTs(s) {
  // "20260516_184704" → seconds-since-epoch
  if (!/^\d{8}_\d{6}$/.test(s)) return null;
  const iso = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T` +
              `${s.slice(9, 11)}:${s.slice(11, 13)}:${s.slice(13, 15)}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}
function formatHms(tsSec) {
  if (tsSec == null) return '[--:--:--]';
  const d = new Date(tsSec * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `[${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}]`;
}

const auditRaw = (read('production/session-logs/agent-audit.log') ?? '')
  .split('\n').filter(Boolean);

// Pair each "invoked" with its later "completed" to enrich the STOP with
// duration. Simple LIFO match per agent — adequate when an agent isn't
// re-spawned before the prior run completes (the common case).
const openInvocations = new Map(); // agent slug → invocation timestamp
const auditEntries = [];
for (const line of auditRaw) {
  const m = line.match(/^(\d{8}_\d{6})\s*\|\s*Agent (invoked|completed):\s*(.*)$/);
  if (!m) continue;
  const [, tsRaw, action, agentRaw] = m;
  const ts = parseAuditTs(tsRaw);
  const agent = agentRaw.trim() || '—';
  if (action === 'invoked') {
    openInvocations.set(agent, ts);
    auditEntries.push([formatHms(ts), 'SPAWN', agent, '']);
  } else {
    const startedAt = openInvocations.get(agent);
    openInvocations.delete(agent);
    const detail = (ts != null && startedAt != null)
      ? `(${Math.max(1, ts - startedAt)}s)`
      : '';
    auditEntries.push([formatHms(ts), 'STOP', agent, detail]);
  }
}
// Keep the most recent AUDIT_LIMIT entries, newest first.
const audit = auditEntries.slice(-AUDIT_LIMIT).reverse();
const lastAuditTs = auditEntries.length
  ? parseAuditTs(auditRaw[auditRaw.length - 1].match(/^(\d{8}_\d{6})/)?.[1] ?? '')
  : null;

// ── Live agents (current session) ──
// "Current session" = events in agent-audit.log whose timestamp is after the
// most recent `## Session End:` marker in session-log.md. If no marker exists,
// fall back to the last 1 hour. Parent/child hierarchy isn't captured in the
// log format (no caller field), so this is a flat live list — not a tree.
const sessionLog = read('production/session-logs/session-log.md') ?? '';
const sessionEnds = [...sessionLog.matchAll(/^##\s+Session End:\s*(\d{8}_\d{6})/gm)]
  .map((m) => parseAuditTs(m[1]))
  .filter((t) => t != null);
const sessionStartTs = sessionEnds.length
  ? Math.max(...sessionEnds)
  : NOW - 3600;  // 1-hour fallback

// Walk audit lines IN ORDER since session start. Pair SPAWN/STOP LIFO per
// agent. Unpaired SPAWNs at the end = live; STOPs in the last 5 minutes go
// into recentStops so the UI can show "just completed" alongside live ones.
const RECENT_STOP_WINDOW = 300; // seconds
const sessionEvents = [];
for (const line of auditRaw) {
  const m = line.match(/^(\d{8}_\d{6})\s*\|\s*Agent (invoked|completed):\s*(.*)$/);
  if (!m) continue;
  const ts = parseAuditTs(m[1]);
  if (ts == null || ts <= sessionStartTs) continue;
  sessionEvents.push({ ts, action: m[2], agent: m[3].trim() || '—' });
}

const openByAgent = new Map(); // slug → spawn ts
const recentStops = [];
for (const ev of sessionEvents) {
  if (ev.action === 'invoked') {
    // LIFO per slug: most recent SPAWN wins when paired.
    openByAgent.set(ev.agent, ev.ts);
  } else {
    const spawnTs = openByAgent.get(ev.agent) ?? null;
    openByAgent.delete(ev.agent);
    if (NOW - ev.ts <= RECENT_STOP_WINDOW) {
      recentStops.push({
        slug: ev.agent,
        stoppedAtSec: ev.ts,
        durationSec: spawnTs != null ? Math.max(1, ev.ts - spawnTs) : null,
      });
    }
  }
}

const liveAgents = [...openByAgent.entries()]
  .map(([slug, spawnedAtSec]) => ({ slug, spawnedAtSec }))
  .sort((a, b) => a.spawnedAtSec - b.spawnedAtSec);  // oldest first

// Keep recentStops newest-first, capped.
recentStops.sort((a, b) => b.stoppedAtSec - a.stoppedAtSec);
const recentStopsCapped = recentStops.slice(0, 8);

// ── Write ──
const out = {
  generatedAt: Math.floor(Date.now() / 1000),
  timeline,
  audit,
  lastCommitTs,
  lastAuditTs,
  liveAgents,
  recentStops: recentStopsCapped,
  sessionStartTs,
};
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');

console.log(
  `[extract-history] ${timeline.length} commits, ${audit.length} audit entries, ` +
  `${liveAgents.length} live (session start ${sessionStartTs ?? '—'})`
);
