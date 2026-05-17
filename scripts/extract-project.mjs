#!/usr/bin/env node
// Extracts project state (name, engine, git, sessions, phase) from the repo
// into src/data/project.generated.json. Fields that aren't available become
// nulls — the UI handles them as honest empty states.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_FILE  = path.resolve(__dirname, '../src/data/project.generated.json');

const read = (rel) => {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch { return null; }
};

const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
  } catch { return null; }
};

// ── Project name + engine from CLAUDE.md ──
const claude = read('CLAUDE.md') ?? '';
const h1 = claude.match(/^#\s+(.+)$/m)?.[1] ?? 'Project';
// Split on " — ", " -- ", " : " — take the lead phrase.
const name = h1.split(/\s+(?:[—:]|--)\s+/, 1)[0].trim();

const engineLine = claude.match(/^\s*-\s*\*\*Engine\*\*:\s*(\w+)/im);
const engineSlug = (() => {
  const e = engineLine?.[1].toLowerCase() ?? '';
  if (e.startsWith('godot')) return 'godot';
  if (e.startsWith('unity')) return 'unity';
  if (e.startsWith('unreal')) return 'unreal';
  return null;
})();

let engineLabel = null;
if (engineSlug) {
  const versionMd = read(`docs/engine-reference/${engineSlug}/VERSION.md`) ?? '';
  const row = versionMd.match(/\|\s*\*\*Engine Version\*\*\s*\|\s*([^|]+)\|/);
  if (row) engineLabel = row[1].trim();
}

// ── Review intensity ──
const reviewMode = (read('production/review-mode.txt') ?? '').trim() || null;

// ── Git ──
const branch = git('rev-parse --abbrev-ref HEAD');
const firstCommitTs = Number((git('log --reverse --format=%ct') ?? '').split('\n')[0]) || null;
const lastCommitTs  = Number(git('log -1 --format=%ct')) || null;
const lastCommitSubject = git('log -1 --format=%s');
const dirtyCount = (git('status --porcelain') ?? '').split('\n').filter(Boolean).length;

// ── Sprint ──
// Source of truth: production/sprints/*.md (canonical location used by the
// /sprint-plan and /sprint-status skills). Picks the most recently modified
// .md file as "current". Optionally overlays per-story status from
// production/sprint-status.yaml when present (matches /sprint-status order
// of preference: yaml first, markdown markers as fallback).
const sprintsDir = path.join(REPO_ROOT, 'production/sprints');
// Order matters: explicit "not started" / "todo" overrides matches against
// later keywords (e.g., we don't want "NOT STARTED" caught by /\bstarted\b/).
const STATUS_KEYWORDS = [
  ['todo',    /\b(?:not\s+started|todo|not\s+yet|backlog)\b/i],
  ['done',    /\b(?:done|complete|completed|shipped)\b/i],
  ['blocked', /\b(?:blocked|stuck|waiting\s+on)\b/i],
  ['review',  /\b(?:in[\s-]review|in\s+review|pr\s+open|ready\s+for\s+review)\b/i],
  ['inprog',  /\b(?:in[\s-]progress|inprog|wip)\b/i],
];
function inferStatus(text) {
  for (const [name, re] of STATUS_KEYWORDS) if (re.test(text)) return name;
  return 'todo';
}

function pickCurrentSprintFile() {
  let entries = [];
  try { entries = fs.readdirSync(sprintsDir).filter((f) => f.endsWith('.md')); } catch { return null; }
  if (!entries.length) return null;
  entries.sort((a, b) => {
    const ma = fs.statSync(path.join(sprintsDir, a)).mtimeMs;
    const mb = fs.statSync(path.join(sprintsDir, b)).mtimeMs;
    return mb - ma;
  });
  return entries[0];
}

// Minimal YAML parser for the small, flat sprint-status.yaml schema:
//   sprint: 3
//   goal: "…"
//   start: 2026-05-20
//   end:   2026-06-03
//   stories:
//     - id: EPIC-001-S01
//       status: done
function parseSprintStatusYaml(text) {
  const result = { stories: {} };
  let inStories = false;
  let current = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '');
    if (!line.trim()) continue;
    if (/^stories\s*:/.test(line)) { inStories = true; continue; }
    if (inStories) {
      const idM = line.match(/^\s*-\s*id\s*:\s*['"]?(.+?)['"]?\s*$/);
      const kvM = line.match(/^\s+([a-z_]+)\s*:\s*['"]?(.+?)['"]?\s*$/i);
      if (idM) {
        current = { id: idM[1].trim() };
        result.stories[current.id] = current;
      } else if (kvM && current) {
        current[kvM[1]] = kvM[2].trim();
      }
    } else {
      const kv = line.match(/^([a-z_]+)\s*:\s*['"]?(.+?)['"]?\s*$/i);
      if (kv) result[kv[1]] = kv[2].trim();
    }
  }
  return result;
}

function parseSprintMarkdown(md) {
  // Heading: `# Sprint N — START to END` or `# Sprint N` (dates optional)
  const titleM = md.match(/^#\s+Sprint\s+(\d+)(?:\s*[—-]+\s*(.+?)(?:\s+to\s+(.+?))?)?\s*$/im);
  const number = titleM ? Number(titleM[1]) : null;
  const start  = titleM?.[2]?.trim() || null;
  const end    = titleM?.[3]?.trim() || null;

  // Goal: first non-empty line after `## Sprint Goal`
  const goalBlock = md.match(/##\s+Sprint Goal\s*\n+([\s\S]*?)(?=\n##\s|\n$)/i);
  const goal = goalBlock?.[1].split('\n').map((l) => l.trim()).find(Boolean) ?? null;

  // Priority sections — each holds a markdown table. Columns vary; we treat
  // the first column as ID, the second as Task, and look for an Owner/Agent
  // column and an Est column by header name.
  const PRIORITIES = [
    ['must',   /###\s+Must Have[^\n]*\n+([\s\S]*?)(?=\n###\s|\n##\s|$)/i],
    ['should', /###\s+Should Have[^\n]*\n+([\s\S]*?)(?=\n###\s|\n##\s|$)/i],
    ['nice',   /###\s+Nice to Have[^\n]*\n+([\s\S]*?)(?=\n###\s|\n##\s|$)/i],
  ];

  const stories = [];
  for (const [priority, re] of PRIORITIES) {
    const block = md.match(re)?.[1];
    if (!block) continue;
    const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
    if (lines.length < 2) continue;
    const headerCells = lines[0].split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
    const colOf = (...names) => headerCells.findIndex((h) => names.some((n) => h.includes(n)));
    const idCol    = colOf('id');
    const taskCol  = colOf('task', 'title', 'story');
    const ownerCol = colOf('owner', 'agent');
    const estCol   = colOf('est');
    // Skip header + separator (|---|---|).
    for (const row of lines.slice(2)) {
      const cells = row.split('|').slice(1, -1).map((c) => c.trim());
      const id = idCol >= 0 ? cells[idCol] : '';
      if (!id || /^[-:]+$/.test(id)) continue;
      stories.push({
        id,
        title:    taskCol  >= 0 ? cells[taskCol]  : '',
        owner:    ownerCol >= 0 ? cells[ownerCol] : '',
        est:      estCol   >= 0 ? cells[estCol]   : '',
        priority,
        status:   inferStatus(row),
      });
    }
  }
  return { number, start, end, goal, stories };
}

let sprint = { hasActive: false };
const currentSprintFile = pickCurrentSprintFile();
if (currentSprintFile) {
  const md = read(`production/sprints/${currentSprintFile}`) ?? '';
  const parsed = parseSprintMarkdown(md);

  // Overlay authoritative status from sprint-status.yaml if it exists.
  const yamlText = read('production/sprint-status.yaml');
  let yamlGoal = null, yamlStart = null, yamlEnd = null, yamlNumber = null;
  if (yamlText) {
    const ys = parseSprintStatusYaml(yamlText);
    yamlGoal   = ys.goal ?? null;
    yamlStart  = ys.start ?? null;
    yamlEnd    = ys.end ?? null;
    yamlNumber = ys.sprint != null ? Number(ys.sprint) : null;
    for (const s of parsed.stories) {
      const yamlEntry = ys.stories[s.id];
      if (yamlEntry?.status) s.status = yamlEntry.status.toLowerCase();
    }
  }

  sprint = {
    hasActive: true,
    file: currentSprintFile,
    number: yamlNumber ?? parsed.number,
    goal:   yamlGoal   ?? parsed.goal,
    start:  yamlStart  ?? parsed.start,
    end:    yamlEnd    ?? parsed.end,
    stories: parsed.stories,
    statusSource: yamlText ? 'yaml' : 'markdown',
  };
}

// ── Sessions ──
const sessionLog = read('production/session-logs/session-log.md') ?? '';
const sessionMatches = [...sessionLog.matchAll(/^## Session End:\s*(\d{8})_(\d{6})/gm)];
const sessionCount = sessionMatches.length + 1; // +1 for the current session
const lastSessionEndTs = (() => {
  const last = sessionMatches[sessionMatches.length - 1];
  if (!last) return null;
  // 20260516_183954 → 2026-05-16T18:39:54
  const [, ymd, hms] = last;
  const iso = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T` +
              `${hms.slice(0, 2)}:${hms.slice(2, 4)}:${hms.slice(4, 6)}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
})();

// ── Phase (CCGS stage → 7-phase pipeline number) ──
const stage = (read('production/stage.txt') ?? '').trim() || null;
const phaseNumberFromStage = (s) => {
  if (!s) return null;
  const lower = s.toLowerCase();
  if (/release/.test(lower))                                    return 7;
  if (/polish|qa|test/.test(lower))                             return 6;
  if (/production|build|sprint/.test(lower))                    return 5;
  if (/vertical slice|plan/.test(lower))                        return 4;
  if (/architect/.test(lower))                                  return 3;
  if (/design|systems|concept|prototype|map systems/.test(lower)) return 2;
  if (/brainstorm|setup|discover|onboard/.test(lower))          return 1;
  return null;
};
const currentPhase = phaseNumberFromStage(stage);

// "Phase day": days since production/stage.txt was last modified (heuristic for
// "how long have we been in this stage"). Falls back to null if the file
// doesn't exist.
const stagePath = path.join(REPO_ROOT, 'production/stage.txt');
let phaseDay = null;
try {
  const stat = fs.statSync(stagePath);
  const days = (Date.now() - stat.mtimeMs) / 86400000;
  phaseDay = Math.max(1, Math.floor(days) + 1);
} catch { /* no stage file */ }

// ── Output ──
const out = {
  generatedAt: Math.floor(Date.now() / 1000),
  name,
  engine: engineLabel || (engineSlug && engineSlug[0].toUpperCase() + engineSlug.slice(1)) || null,
  engineSlug,
  reviewMode,
  git: {
    branch,
    firstCommitTs,
    lastCommitTs,
    lastCommitSubject,
    dirtyCount,
  },
  sprint,
  session: {
    count: sessionCount,
    lastEndTs: lastSessionEndTs,
  },
  phase: {
    stage,
    number: currentPhase,
    day: phaseDay,
  },
};

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');

console.log(
  `[extract-project] ${out.name} · ${out.engine ?? 'no engine'} · ` +
  `branch=${out.git.branch} · session=${out.session.count} · ` +
  `phase=${out.phase.number ?? '?'} (${out.phase.stage ?? '—'}) · ` +
  (out.sprint.hasActive
    ? `sprint=${out.sprint.number ?? '?'} (${out.sprint.stories?.length ?? 0} stories, ${out.sprint.statusSource})`
    : 'no sprint')
);
