#!/usr/bin/env node
// Extracts agent metadata from .claude/agents/*.md and detects the project engine
// from CLAUDE.md. Output: src/data/agents.generated.json.
//
// Naive frontmatter parser — only extracts top-level scalar keys (name,
// description, model). Multi-line / block-scalar values are not supported.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = path.resolve(__dirname, '../../..');
const AGENTS_DIR = path.join(REPO_ROOT, '.claude/agents');
const CLAUDE_MD  = path.join(REPO_ROOT, 'CLAUDE.md');
const OUT_FILE   = path.resolve(__dirname, '../src/data/agents.generated.json');

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function detectEngine(claudeMdPath) {
  let text = '';
  try { text = fs.readFileSync(claudeMdPath, 'utf8'); } catch { return 'unity'; }
  // Match the engine line in the "Technology Stack" block, e.g.
  //   - **Engine**: Unity 6.3 LTS
  const engineLine = text.match(/^\s*-\s*\*\*Engine\*\*:\s*(\w+)/im);
  if (engineLine) {
    const e = engineLine[1].toLowerCase();
    if (e.startsWith('godot')) return 'godot';
    if (e.startsWith('unity')) return 'unity';
    if (e.startsWith('unreal')) return 'unreal';
  }
  return 'unity';
}

const files = fs.readdirSync(AGENTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

const agents = [];
const skipped = [];
for (const file of files) {
  const text = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf8');
  const fm = parseFrontmatter(text);
  if (!fm || !fm.name) { skipped.push(file); continue; }
  agents.push({
    slug: fm.name,
    description: fm.description ?? '',
    model: (fm.model ?? 'sonnet').toLowerCase(),
  });
}

const engine = detectEngine(CLAUDE_MD);

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ engine, agents }, null, 2) + '\n');

console.log(
  `[extract-agents] wrote ${agents.length} agents to ${path.relative(process.cwd(), OUT_FILE)} ` +
  `(engine: ${engine}${skipped.length ? `, skipped: ${skipped.join(', ')}` : ''})`
);
