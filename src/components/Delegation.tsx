import type { MouseEvent } from 'react';
import type { AgentState, AuditEntry, LiveAgent, RecentStop, TimelineEntry } from '../data/types';
import { getAgentInfo } from '../data/getAgentInfo';
import { HISTORY, LIVE_AGENTS, RECENT_STOPS, relativeAgo } from '../data/history';
import { AgentPopover } from './AgentPopover';
import { SlashChip } from './SlashChip';
import { StudioMapView } from './StudioMapView';

export type DelegationTab = 'live' | 'timeline' | 'audit' | 'map';

interface DelegationProps {
  tab: DelegationTab;
  onTab: (t: DelegationTab) => void;
  selectedAgent: string | null;
  onAgent: (k: string, e: MouseEvent) => void;
  onCloseAgent: () => void;
  onRunSkill: (cmd: string) => void;
  timeline: readonly TimelineEntry[];
  audit: readonly AuditEntry[];
}

const TABS: ReadonlyArray<readonly [DelegationTab, string]> = [
  ['live', 'Live'],
  ['timeline', 'Timeline'],
  ['audit', 'Audit'],
  ['map', 'Map'],
];

export function Delegation(props: DelegationProps) {
  const { tab, onTab, selectedAgent, onAgent, onCloseAgent, onRunSkill, timeline, audit } = props;

  const subtitle = (() => {
    switch (tab) {
      case 'live': {
        const n = LIVE_AGENTS.length;
        const since = relativeAgo(HISTORY.sessionStartTs);
        return n > 0
          ? `${n} active · session started ${since}`
          : `idle · session started ${since}`;
      }
      case 'timeline': return `snapshot · last commit ${relativeAgo(HISTORY.lastCommitTs)}`;
      case 'audit':    return `snapshot · last agent ${relativeAgo(HISTORY.lastAuditTs)}`;
      case 'map':      return 'studio floor · 49 agents';
    }
  })();

  return (
    <div className="hf-panel" style={{ position: 'relative', minHeight: 0 }}>
      <div className="hf-panel-head">
        <span className="title">Active delegation</span>
        <span className="sub">{subtitle}</span>
        <div className="right">
          <div className="hf-tabs">
            {TABS.map(([k, label]) => (
              <span
                key={k}
                className={`hf-tab ${tab === k ? 'active' : ''}`}
                onClick={(e) => { e.stopPropagation(); onTab(k); }}
              >{label}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="hf-panel-body" style={{ position: 'relative' }}>
        <div key={tab} className="hf-fade-in" style={{ minHeight: 0 }}>
          {tab === 'live' && <LiveView
            live={LIVE_AGENTS}
            recentStops={RECENT_STOPS}
            onAgent={onAgent}
            onRunSkill={onRunSkill}
          />}
          {tab === 'timeline' && <TimelineView entries={timeline} />}
          {tab === 'audit' && <AuditView entries={audit} />}
          {tab === 'map' && <StudioMapView selectedAgent={selectedAgent} onAgent={onAgent} />}
        </div>

        {selectedAgent && getAgentInfo(selectedAgent) && (
          <AgentPopover
            info={getAgentInfo(selectedAgent)!}
            onClose={(e) => { e.stopPropagation(); onCloseAgent(); }}
            onRunSkill={onRunSkill}
          />
        )}
      </div>

      <div className="hf-panel-foot">
        <span className="muted">history sources: <span className="mono">git log</span> · </span>
        <span className="mono muted">production/session-logs/agent-audit.log</span>
        <span style={{ marginLeft: 'auto' }} className="row gap4">
          <SlashChip cmd="/team-narrative" onRun={onRunSkill} />
          <SlashChip cmd="/team-combat" onRun={onRunSkill} />
        </span>
      </div>
    </div>
  );
}

/**
 * Live agents from the current session, derived from agent-audit.log:
 * SPAWN events newer than the most-recent `## Session End:` marker, with
 * matching STOPs paired off — unpaired SPAWNs are still live. Recently
 * stopped agents (last 5 min) are shown dimmed below.
 *
 * Hierarchy isn't shown because the audit log doesn't capture who-called-whom.
 */
function LiveView({ live, recentStops, onAgent, onRunSkill }: {
  live: readonly LiveAgent[];
  recentStops: readonly RecentStop[];
  onAgent: (slug: string, e: MouseEvent) => void;
  onRunSkill: (cmd: string) => void;
}) {
  if (live.length === 0 && recentStops.length === 0) {
    return (
      <div style={{
        position: 'relative', minHeight: 420,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 14, padding: 24, textAlign: 'center',
      }}>
        <div className="display" style={{ color: 'var(--text-0)' }}>No live agents</div>
        <div className="small muted" style={{ maxWidth: 360, lineHeight: 1.5 }}>
          Nothing spawned since the last session end. Run{' '}
          <span className="mono" style={{ color: 'var(--text-1)' }}>/dev-story</span> or any{' '}
          <span className="mono" style={{ color: 'var(--text-1)' }}>/team-*</span>{' '}
          skill — spawns appear here within a second.
        </div>
        <div className="row gap6 wrap" style={{ marginTop: 4 }}>
          <SlashChip cmd="/dev-story" onRun={onRunSkill} suggested />
          <SlashChip cmd="/team-narrative" onRun={onRunSkill} />
          <SlashChip cmd="/team-combat" onRun={onRunSkill} />
          <SlashChip cmd="/team-ui" onRun={onRunSkill} />
        </div>
        <div className="tiny muted" style={{ marginTop: 8 }}>
          Source: <span className="mono">production/session-logs/agent-audit.log</span>
        </div>
      </div>
    );
  }

  return (
    <div className="col gap10" style={{ padding: '2px 4px' }}>
      {live.length > 0 && (
        <div className="col gap6">
          <div className="tiny muted uppercase">Live now · {live.length}</div>
          {live.map((a) => <LiveAgentCard key={a.slug} agent={a} onAgent={onAgent} />)}
        </div>
      )}
      {recentStops.length > 0 && (
        <div className="col gap6">
          <div className="tiny muted uppercase">Just stopped · last 5 min</div>
          {recentStops.map((s) => <StoppedAgentCard key={`${s.slug}-${s.stoppedAtSec}`} stop={s} />)}
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 4 }}>
        Caller hierarchy isn't captured in the audit log, so this is a flat
        live list — not a tree.
      </div>
    </div>
  );
}

function LiveAgentCard({ agent, onAgent }: {
  agent: LiveAgent;
  onAgent: (slug: string, e: MouseEvent) => void;
}) {
  const info = getAgentInfo(agent.slug);
  return (
    <div
      className="row gap10 baseline"
      style={{
        padding: '8px 10px',
        border: '1px solid var(--line)',
        borderRadius: 4,
        background: 'var(--bg-2)',
        cursor: info ? 'pointer' : 'default',
      }}
      onClick={info ? (e) => onAgent(agent.slug, e) : undefined}
    >
      <span className="hf-dot live" />
      <span className="strong" style={{ minWidth: 180, fontSize: 12 }}>{agent.slug}</span>
      <span className="grow muted" style={{
        fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{info?.task ?? 'unknown agent'}</span>
      <span className="tiny mono faint">spawned {relativeAgo(agent.spawnedAtSec)}</span>
    </div>
  );
}

function StoppedAgentCard({ stop }: { stop: RecentStop }) {
  const info = getAgentInfo(stop.slug);
  return (
    <div className="row gap10 baseline" style={{
      padding: '6px 10px',
      borderBottom: '1px solid var(--line)',
      opacity: 0.7,
    }}>
      <span className="hf-dot ok" />
      <span className="strong" style={{ minWidth: 180, fontSize: 12 }}>{stop.slug}</span>
      <span className="grow muted" style={{
        fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{info?.task ?? 'unknown agent'}</span>
      <span className="tiny mono faint">
        {relativeAgo(stop.stoppedAtSec)}
        {stop.durationSec != null && ` · ${stop.durationSec}s`}
      </span>
    </div>
  );
}

const DOT_BY_STATE: Record<AgentState, string> = {
  live: 'live', hot: 'hot', warn: 'warn', ok: 'ok', idle: 'idle', dim: 'idle',
};

function TimelineView({ entries }: { entries: readonly TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="muted small" style={{ padding: 16 }}>
        No commits yet. <span className="mono">git log</span> is empty.
      </div>
    );
  }
  return (
    <div className="col gap2" style={{ fontSize: 12 }}>
      {entries.map(([time, agent, msg, dot], i) => (
        <div key={i} className="row gap10 baseline" style={{
          padding: '6px 8px',
          borderRadius: 3,
          borderBottom: i === entries.length - 1 ? 'none' : '1px solid var(--line)',
        }}>
          <span className="mono tiny faint" style={{ width: 44 }}>{time}</span>
          <span className={`hf-dot ${DOT_BY_STATE[dot]}`} />
          <span className="strong" style={{ width: 110, fontSize: 12 }}>{agent}</span>
          <span className="grow muted" style={{ fontSize: 12 }}>{msg}</span>
        </div>
      ))}
    </div>
  );
}

function AuditView({ entries }: { entries: readonly AuditEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="muted small mono" style={{ padding: 16 }}>
        No agent activity logged. <br />
        <span className="faint">production/session-logs/agent-audit.log is empty or missing.</span>
      </div>
    );
  }
  return (
    <div className="col mono" style={{ fontSize: 11, lineHeight: 1.6 }}>
      <div className="muted small" style={{ marginBottom: 6 }}>
        last {entries.length} events from <span className="mono">agent-audit.log</span>
      </div>
      {entries.map(([ts, action, agent, detail], i) => (
        <div
          key={i}
          className="row gap8"
          style={{ color: 'var(--text-2)', padding: '2px 6px', borderRadius: 2 }}
        >
          <span className="faint">{ts}</span>
          <span style={{ color: action === 'SPAWN' ? 'var(--live)' : 'var(--text-2)', width: 50 }}>
            {action}
          </span>
          <span style={{ color: 'var(--text-0)', width: 160 }}>{agent}</span>
          <span className="faint">{detail}</span>
        </div>
      ))}
    </div>
  );
}
