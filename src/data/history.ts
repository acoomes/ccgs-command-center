// Typed wrapper around history.generated.json. Static snapshot — re-run the
// dev/build to refresh.

import generated from './history.generated.json';
import type { AuditEntry, LiveAgent, RecentStop, TimelineEntry } from './types';

interface Generated {
  generatedAt: number;
  timeline: TimelineEntry[];
  audit: AuditEntry[];
  lastCommitTs: number | null;
  lastAuditTs: number | null;
  liveAgents: LiveAgent[];
  recentStops: RecentStop[];
  sessionStartTs: number | null;
}

// JSON imports come in as `string[][]`; the extractor enforces the tuple
// shape so the runtime is safe — cast through `unknown` to accept it.
const data = generated as unknown as Generated;

export const TIMELINE:     readonly TimelineEntry[] = data.timeline;
export const AUDIT:        readonly AuditEntry[]    = data.audit;
export const LIVE_AGENTS:  readonly LiveAgent[]     = data.liveAgents;
export const RECENT_STOPS: readonly RecentStop[]    = data.recentStops;

export const HISTORY = {
  generatedAt:    data.generatedAt,
  lastCommitTs:   data.lastCommitTs,
  lastAuditTs:    data.lastAuditTs,
  sessionStartTs: data.sessionStartTs,
};

/** "23m ago", "3h ago", "2d ago" — for snapshot subtitles. */
export function relativeAgo(tsSec: number | null, now = data.generatedAt): string {
  if (tsSec == null) return '—';
  const s = Math.max(0, now - tsSec);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return `${Math.floor(s / 604800)}w ago`;
}
