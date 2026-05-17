import type { AgentDetail } from './types';
import { realAgentInfo } from './realAgents';

/**
 * Resolves agent popover info from the real `.claude/agents/<slug>.md` files.
 * Returns null for unknown slugs (the popover renderer suppresses itself).
 */
export function getAgentInfo(slug: string): AgentDetail | null {
  return realAgentInfo(slug);
}
