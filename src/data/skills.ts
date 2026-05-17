// Skill palette source. The list is derived from `.claude/skills/<slug>/SKILL.md`
// at build time by scripts/extract-skills.mjs; this module shapes it for the
// cmd-K palette while keeping the full description available for richer UIs.

import generated from './skills.generated.json';

export interface SkillEntry {
  cmd: string;          // e.g. "/dev-story"
  hint: string;         // short, lowercase, ≤ ~60 chars
  description: string;  // full frontmatter description
  model: string;        // "opus" | "sonnet" | "haiku"
}

interface GeneratedSkills { skills: SkillEntry[]; }

export const SKILL_ENTRIES: readonly SkillEntry[] =
  (generated as GeneratedSkills).skills;

/** Legacy tuple shape kept for the existing palette UI. */
export type Skill = readonly [cmd: string, hint: string];

export const SKILLS: readonly Skill[] =
  SKILL_ENTRIES.map((s) => [s.cmd, s.hint] as const);

/** Look up the full entry for a `/cmd` (e.g. for tooltips / detail panels). */
export const SKILL_BY_CMD: Record<string, SkillEntry> =
  Object.fromEntries(SKILL_ENTRIES.map((s) => [s.cmd, s]));
