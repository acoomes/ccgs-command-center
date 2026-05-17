// Typed wrapper around needs.generated.json. Combines needs parsed from
// production/session-state/active.md (Open Questions, Next Steps, Deferred
// rollup) with sprint-derived needs (blocked + in-review stories) so the
// panel surfaces everything in one ranked list.

import generated from './needs.generated.json';
import { PROJECT } from './project';
import type { Need } from './types';

interface Generated {
  generatedAt: number;
  source: string;
  needs: Need[];
}

const FILE_NEEDS = (generated as unknown as Generated).needs;

// Derive needs from the parsed sprint data: blocked stories are hot,
// in-review stories want sign-off.
function sprintDerivedNeeds(): Need[] {
  if (!PROJECT.sprint.hasActive) return [];
  const out: Need[] = [];
  for (const s of PROJECT.sprint.stories) {
    if (s.status === 'blocked') {
      out.push({
        id: `sprint-blocked-${s.id}`,
        title: `${s.id} blocked`,
        from: `sprint ${PROJECT.sprint.number ?? ''}`.trim(),
        detail: s.title || undefined,
        actions: [
          { label: 'Diagnose', resolve: `looking at ${s.id}`, primary: true, hot: true },
        ],
      });
    } else if (s.status === 'review') {
      out.push({
        id: `sprint-review-${s.id}`,
        title: `${s.id} ready for review`,
        from: `sprint ${PROJECT.sprint.number ?? ''}`.trim(),
        detail: s.title || undefined,
        actions: [
          { label: 'Review', resolve: `reviewing ${s.id}`, skill: '/code-review' },
        ],
      });
    }
  }
  return out;
}

// Priority order, highest first:
//   1. blocked sprint stories  (hot)
//   2. open questions          (decision needed)
//   3. in-review sprint stories
//   4. next steps              (top 3)
//   5. deferred rollup         (informational tail)
function rankNeeds(all: Need[]): Need[] {
  const rank = (n: Need): number => {
    if (n.id.startsWith('sprint-blocked-')) return 0;
    if (/^oq-/.test(n.id))                  return 1;
    if (n.id.startsWith('sprint-review-'))  return 2;
    if (n.id.startsWith('next-'))           return 3;
    if (n.id === 'deferred')                return 4;
    return 5;
  };
  return [...all].sort((a, b) => rank(a) - rank(b));
}

export const INITIAL_NEEDS: readonly Need[] =
  rankNeeds([...sprintDerivedNeeds(), ...FILE_NEEDS]);

export const NEEDS_SOURCE = (generated as unknown as Generated).source;
