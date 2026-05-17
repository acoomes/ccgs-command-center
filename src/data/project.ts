// Typed wrapper around project.generated.json. Provides derived display values
// (Day N since first commit, "23m ago" relative times, etc.).

import generated from './project.generated.json';

export interface GitInfo {
  branch: string | null;
  firstCommitTs: number | null;
  lastCommitTs: number | null;
  lastCommitSubject: string | null;
  dirtyCount: number;
}

export type SprintPriority = 'must' | 'should' | 'nice';
export type SprintStoryStatus = 'todo' | 'inprog' | 'review' | 'blocked' | 'done';

export interface SprintStory {
  id: string;
  title: string;
  owner: string;
  est: string;
  priority: SprintPriority;
  status: SprintStoryStatus;
}

export type SprintInfo =
  | { hasActive: false }
  | {
      hasActive: true;
      file: string;
      number: number | null;
      goal: string | null;
      start: string | null;
      end: string | null;
      stories: SprintStory[];
      statusSource: 'yaml' | 'markdown';
    };

export interface SessionInfo {
  count: number;
  lastEndTs: number | null;
}

export interface PhaseInfo {
  stage: string | null;
  number: number | null;
  day: number | null;
}

export interface Project {
  generatedAt: number;
  name: string;
  engine: string | null;
  engineSlug: 'godot' | 'unity' | 'unreal' | null;
  reviewMode: string | null;
  git: GitInfo;
  sprint: SprintInfo;
  session: SessionInfo;
  phase: PhaseInfo;
}

export const PROJECT = generated as Project;

/** Days elapsed from the first commit through `now` (defaults to build time). */
export function projectDay(now = PROJECT.generatedAt): number {
  if (!PROJECT.git.firstCommitTs) return 0;
  const elapsed = now - PROJECT.git.firstCommitTs;
  return Math.max(1, Math.floor(elapsed / 86400) + 1);
}

/** Human-friendly delta: "23m ago", "2h ago", "3d ago". */
export function relativeAge(tsSec: number | null, now = PROJECT.generatedAt): string {
  if (tsSec == null) return '—';
  const s = Math.max(0, now - tsSec);
  if (s < 60)       return 'just now';
  if (s < 3600)     return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)    return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Short label for session sub-text: "23m ago" or "just started". */
export function lastSessionAge(now = PROJECT.generatedAt): string {
  return relativeAge(PROJECT.session.lastEndTs, now);
}
