export type AgentState = 'live' | 'hot' | 'warn' | 'ok' | 'idle' | 'dim';
export type Tier = 1 | 2 | 3;
export type Model = 'opus' | 'sonnet' | 'haiku';
export type AgentStatus = 'Active' | 'Waiting' | 'Blocked' | 'Idle';

export interface NeedAction {
  label: string;
  resolve: string;
  primary?: boolean;
  hot?: boolean;
  skill?: string;
}

export interface Need {
  id: string;
  title: string;
  from: string;
  detail?: string;
  actions: NeedAction[];
}

export interface AgentDetail {
  role: string;
  tier: Tier;
  model: Model;
  status: AgentStatus;
  task: string;
  started: string;
  spawned: string;
}

export type StoryStatus = 'inprog' | 'review' | 'blocked' | 'done' | 'todo';

export interface Story {
  id: string;
  title: string;
  owner: string;
  status: StoryStatus;
  pts: number;
  statLabel: string;
}

/** [time, agent, message, dotState] */
export type TimelineEntry = readonly [string, string, string, AgentState];

/** [timestamp, action, agent, detail] */
export type AuditEntry = readonly [string, string, string, string];

export interface LiveAgent {
  slug: string;
  spawnedAtSec: number;
}

export interface RecentStop {
  slug: string;
  stoppedAtSec: number;
  durationSec: number | null;
}

export interface Department {
  name: string;
  lead: string | null;
  leadState?: AgentState;
  leadKey?: string;
  /** [name, state, optional click key] */
  specs: ReadonlyArray<readonly [string, AgentState, string?]>;
}

export interface Wing {
  director: string;
  dirState: AgentState;
  dirKey?: string;
  departments: Department[];
}

export type WingKey = 'creative' | 'technical' | 'production';
export type StudioMap = Record<WingKey, Wing>;

export type Toast = {
  id: string;
  title: string;
  body?: string;
  kind: 'ok' | 'run';
  dying: boolean;
};
