#!/usr/bin/env node
// Extracts skills from .claude/skills/<slug>/SKILL.md into a generated JSON
// the Skills palette consumes. Skipped if the directory doesn't exist.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = process.env.PROJECT_ROOT
  ? path.resolve(process.env.PROJECT_ROOT)
  : path.resolve(__dirname, '../../..');
const SKILLS_DIR = path.join(REPO_ROOT, '.claude/skills');
const OUT_FILE   = path.resolve(__dirname, '../src/data/skills.generated.json');

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

// Distill a long skill description into a one-line hint for the cmd-K palette.
// Tries to land on a natural break (sentence, em-dash, clause) before the
// hard 60-char cap. Lowercases the leading capital so it reads as a hint, not
// a sentence ("guided ideation" not "Guided ideation.").
function shortHint(description) {
  if (!description) return '';
  // Drop parenthetical asides and "Use when …" suffixes — they're docs not hints.
  let s = description
    .replace(/\s*\([^)]*\)/g, '')
    .split(/\s+Use when\s+/i)[0]
    .trim();
  // Take the first natural break that lands past 10 chars.
  for (const re of [/\.\s+/, /\s[—–-]\s/, /,\s+/, /:\s+/]) {
    const i = s.search(re);
    if (i >= 10) { s = s.slice(0, i); break; }
  }
  s = s.trim().replace(/[.,;:—–-]+$/, '');
  if (s.length > 60) s = s.slice(0, 57).trimEnd() + '…';
  if (s.length > 1) s = s[0].toLowerCase() + s.slice(1);
  return s;
}

let entries = [];
try {
  const dirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  for (const slug of dirs) {
    const skillPath = path.join(SKILLS_DIR, slug, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const fm = parseFrontmatter(fs.readFileSync(skillPath, 'utf8'));
    if (!fm) continue;
    const name = fm.name ?? slug;
    if (fm['user-invocable'] === 'false') continue;
    entries.push({
      cmd: `/${name}`,
      hint: shortHint(fm.description ?? ''),
      description: fm.description ?? '',
      model: (fm.model ?? 'sonnet').toLowerCase(),
    });
  }
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
  console.warn('[extract-skills] no .claude/skills/ directory — writing empty list');
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ skills: entries }, null, 2) + '\n');

console.log(`[extract-skills] wrote ${entries.length} skills to ${path.relative(process.cwd(), OUT_FILE)}`);
