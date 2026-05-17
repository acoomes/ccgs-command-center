#!/usr/bin/env node
// Extracts "Needs You" items from production/session-state/active.md.
// Sprint-derived needs (blocked/review stories) are layered on at runtime
// in src/data/needs.ts so the extractor stays single-source.
//
// Sections recognised in active.md:
//   ## Open Questions          — table `| OQ-N | Question | Resolves In |`
//   ## Next Steps              — numbered list, top 3 (embedded `/skill` → runnable)
//   ## Deferred Recommended Items — bullet list, rolled up into one summary need

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUT_FILE  = path.resolve(__dirname, '../src/data/needs.generated.json');

const read = (rel) => {
  try { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'); } catch { return null; }
};

// Grab everything under `## heading …` up to the next `## ` heading.
// Splits on heading boundaries instead of one big regex — much harder to
// get wrong than juggling multiline anchors + lookaheads.
function section(md, heading) {
  const parts = md.split(/\n(?=##\s)/);
  for (const part of parts) {
    const m = part.match(new RegExp(`^##\\s+${heading}[^\\n]*\\n([\\s\\S]*)`, 'i'));
    if (m) return m[1];
  }
  return null;
}

function parseTableRows(block) {
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('|'));
  if (lines.length < 3) return [];
  return lines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
}

const active = read('production/session-state/active.md') ?? '';
const needs = [];

// ── Open Questions ──
const oqBlock = section(active, 'Open Questions');
if (oqBlock) {
  for (const [id, question, resolves] of parseTableRows(oqBlock)) {
    if (!id || /^[-:]+$/.test(id)) continue;
    needs.push({
      id: id.toLowerCase(),
      title: `${id}: ${question}`,
      from: 'open question',
      ...(resolves ? { detail: `Resolves in ${resolves}` } : {}),
      actions: [
        { label: 'Address', resolve: `working on ${id}`, primary: true },
      ],
    });
  }
}

// ── Next Steps ──
const nsBlock = section(active, 'Next Steps');
if (nsBlock) {
  const items = nsBlock.split('\n')
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s/.test(l))
    .slice(0, 3);
  for (const [i, line] of items.entries()) {
    const stripped = line.replace(/^\d+\.\s/, '');
    // Capture the full backticked invocation (skill + args), then the
    // description after the em/en/hyphen-dash. Falls back to bare text.
    const fullM = stripped.match(/`(\/[a-z][\w-]*(?:\s[^`]+)?)`\s*[—–-]?\s*(.*)$/i);
    const skill = fullM ? fullM[1].split(/\s/)[0] : null;
    const invocation = fullM ? fullM[1] : null;
    const detail = fullM ? (fullM[2] || null) : null;
    needs.push({
      id: `next-${i + 1}`,
      title: invocation ?? stripped,
      from: `next step ${i + 1}`,
      ...(detail ? { detail } : {}),
      actions: skill
        ? [{ label: `Run ${skill}`, resolve: invocation ?? skill, skill }]
        : [{ label: 'Acknowledge', resolve: 'noted' }],
    });
  }
}

// ── Deferred Recommended Items ──
const dfBlock = section(active, 'Deferred Recommended Items');
if (dfBlock) {
  const count = dfBlock.split('\n').filter((l) => /^[-*]\s/.test(l.trim())).length;
  if (count > 0) {
    needs.push({
      id: 'deferred',
      title: `${count} deferred items in queue`,
      from: 'review backlog',
      detail: 'Pushed from prior design-review passes',
      actions: [{ label: 'Show in active.md', resolve: 'open production/session-state/active.md' }],
    });
  }
}

const out = {
  generatedAt: Math.floor(Date.now() / 1000),
  source: 'production/session-state/active.md',
  needs,
};
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2) + '\n');

console.log(`[extract-needs] ${needs.length} needs from active.md`);
