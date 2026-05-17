import { useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import type { AgentState, Wing, Department, WingKey } from '../data/types';
import { REAL_STUDIO_MAP as STUDIO_MAP } from '../data/realAgents';

interface StudioMapProps {
  selectedAgent: string | null;
  onAgent: (key: string, e: MouseEvent) => void;
}

type Filter = 'all' | 'active' | 'blocked';

const dotStyle = (state: AgentState, ring = 3): CSSProperties => {
  const liveShadow = `0 0 0 ${ring}px rgba(127, 184, 176, 0.18)`;
  const warnShadow = `0 0 0 ${ring}px rgba(212, 166, 87, 0.18)`;
  const hotShadow = `0 0 0 ${ring}px rgba(226, 101, 76, 0.22)`;
  return {
    background:
      state === 'live' ? 'var(--live)' :
      state === 'hot' ? 'var(--hot)' :
      state === 'warn' ? 'var(--warn)' :
      state === 'dim' ? 'transparent' : 'var(--text-3)',
    border: state === 'dim' ? '1px dashed var(--line-3)' : 'none',
    boxShadow:
      state === 'live' ? liveShadow :
      state === 'warn' ? warnShadow :
      state === 'hot' ? hotShadow : 'none',
  };
};

export function StudioMapView({ selectedAgent, onAgent }: StudioMapProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const matches = (state: AgentState, name: string) => {
    if (filter === 'active' && state !== 'live' && state !== 'hot') return false;
    if (filter === 'blocked' && state !== 'hot' && state !== 'warn') return false;
    if (query && !name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  };

  // Counts for toolbar
  let total = 0, active = 0, blocked = 0;
  Object.values(STUDIO_MAP).forEach((wing) => {
    total++;
    if (wing.dirState === 'live') active++;
    if (wing.dirState === 'hot' || wing.dirState === 'warn') blocked++;
    wing.departments.forEach((dept) => {
      if (dept.lead) {
        total++;
        if (dept.leadState === 'live') active++;
        if (dept.leadState === 'hot' || dept.leadState === 'warn') blocked++;
      }
      dept.specs.forEach(([, state]) => {
        if (state === 'dim') return;
        total++;
        if (state === 'live') active++;
        if (state === 'hot' || state === 'warn') blocked++;
      });
    });
  });

  return (
    <div className="col gap8">
      <div className="hf-map-toolbar">
        <div className="hf-seg">
          <button className={filter === 'all' ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setFilter('all'); }}>
            All · {total}
          </button>
          <button className={filter === 'active' ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setFilter('active'); }}>
            Active · {active}
          </button>
          <button className={filter === 'blocked' ? 'active' : ''}
                  onClick={(e) => { e.stopPropagation(); setFilter('blocked'); }}>
            Needs attention · {blocked}
          </button>
        </div>
        <div className="hf-input" style={{ flex: '0 1 240px', padding: '4px 10px' }}>
          <span className="prefix" style={{ fontSize: 11 }}>⌕</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClick={(e) => { e.stopPropagation(); (e.target as HTMLInputElement).focus(); }}
            onMouseDown={(e) => e.stopPropagation()}
            placeholder="find an agent…"
            style={{ fontSize: 12 }}
          />
          {query && (
            <span className="kbd" onClick={() => setQuery('')} style={{ cursor: 'pointer' }}>×</span>
          )}
        </div>
        <span className="row gap10 small muted" style={{ marginLeft: 'auto' }}>
          <span className="row gap4 baseline"><span className="hf-dot live" />active</span>
          <span className="row gap4 baseline"><span className="hf-dot warn" />waiting</span>
          <span className="row gap4 baseline"><span className="hf-dot hot" />blocked</span>
          <span className="row gap4 baseline"><span className="hf-dot idle" />idle</span>
        </span>
      </div>

      <div key={`${filter}-${query}`} className="hf-wing-stagger col gap8">
        {(Object.entries(STUDIO_MAP) as [WingKey, Wing][]).map(([wingKey, wing]) => (
          <WingView
            key={wingKey}
            wingKey={wingKey}
            wing={wing}
            filter={filter}
            query={query}
            matches={matches}
            selectedAgent={selectedAgent}
            onAgent={onAgent}
          />
        ))}
      </div>

      <div className="row between small muted" style={{ padding: '4px 6px' }}>
        <span>org structure mirrors .claude/agents/ folder</span>
        <span>click any agent for details · ⌕ filter live</span>
      </div>
    </div>
  );
}

interface WingViewProps {
  wingKey: WingKey;
  wing: Wing;
  filter: Filter;
  query: string;
  matches: (state: AgentState, name: string) => boolean;
  selectedAgent: string | null;
  onAgent: (key: string, e: MouseEvent) => void;
}

function WingView({ wingKey, wing, filter, query, matches, selectedAgent, onAgent }: WingViewProps) {
  const showAll = filter === 'all' && !query;

  const visibleDepts = wing.departments.map((dept) => {
    const leadVisible = !!dept.lead && !!dept.leadState && matches(dept.leadState, dept.lead);
    const visibleSpecs = dept.specs.filter(([name, state]) => state !== 'dim' && matches(state, name));
    const dimSpecs = dept.specs.filter(([, state]) => state === 'dim');
    return { dept, leadVisible, visibleSpecs, dimSpecs };
  }).filter(({ leadVisible, visibleSpecs }) =>
    leadVisible || visibleSpecs.length > 0 || showAll
  );

  if (visibleDepts.length === 0 && !matches(wing.dirState, wing.director)) {
    return null;
  }

  const totalAgents = wing.departments.reduce(
    (n, d) => n + (d.lead ? 1 : 0) + d.specs.filter((s) => s[1] !== 'dim').length, 0
  );

  return (
    <div className="hf-wing">
      <div className={`hf-wing-head ${wingKey}`}>
        <span className="icon" />
        <span
          className="director"
          onClick={(e) => wing.dirKey && (e.stopPropagation(), onAgent(wing.dirKey, e))}
          style={{ cursor: wing.dirKey ? 'pointer' : 'default' }}
        >
          {wing.director}
        </span>
        <span className="hf-dot" style={dotStyle(wing.dirState)} />
        <span className="role">opus</span>
        <div className="right">
          <span>{wing.departments.length} depts</span>
          <span>·</span>
          <span>{totalAgents} agents</span>
        </div>
      </div>
      <div className="hf-wing-body">
        {visibleDepts.map((dv, di) => (
          <DeptCard
            key={di}
            data={dv}
            showAll={showAll}
            selectedAgent={selectedAgent}
            onAgent={onAgent}
          />
        ))}
      </div>
    </div>
  );
}

interface DeptCardProps {
  data: {
    dept: Department;
    leadVisible: boolean;
    visibleSpecs: ReadonlyArray<readonly [string, AgentState, string?]>;
    dimSpecs: ReadonlyArray<readonly [string, AgentState, string?]>;
  };
  showAll: boolean;
  selectedAgent: string | null;
  onAgent: (key: string, e: MouseEvent) => void;
}

function DeptCard({ data, showAll, selectedAgent, onAgent }: DeptCardProps) {
  const { dept, leadVisible, visibleSpecs, dimSpecs } = data;
  const showLead = !!dept.lead && (showAll || leadVisible);
  const showSpecs = showAll ? dept.specs : [...visibleSpecs, ...(showAll ? dimSpecs : [])];

  if (!showLead && showSpecs.filter((s) => s[1] !== 'dim').length === 0 && !showAll) {
    return null;
  }

  const totalCount = (dept.lead ? 1 : 0) + dept.specs.filter((s) => s[1] !== 'dim').length;

  return (
    <div className="hf-dept" style={{ minWidth: 156 }}>
      <div className="hf-dept-head">
        <span className="name">{dept.name}</span>
        <div className="right">
          <span>{totalCount}</span>
        </div>
      </div>
      <div className="hf-dept-body">
        {dept.lead ? (
          <div
            className="lead"
            onClick={(e) => dept.leadKey && (e.stopPropagation(), onAgent(dept.leadKey, e))}
            style={{ cursor: dept.leadKey ? 'pointer' : 'default' }}
          >
            <span className="hf-dot" style={dotStyle(dept.leadState ?? 'idle')} />
            <span className="role">{dept.lead}</span>
            <span className="badge">lead</span>
          </div>
        ) : (
          <div className="lead no-lead">
            <span className="hf-dot idle" />
            <span className="role">no lead</span>
            <span className="badge">flat</span>
          </div>
        )}
        {showSpecs.length > 0 && (
          <div className="spec-list">
            {showSpecs.map(([name, state, k], si) => {
              const isSelected = !!selectedAgent && selectedAgent === k;
              const cls = `hf-spec ${state === 'dim' ? 'dim' : ''} ${isSelected ? 'selected' : ''}`;
              return (
                <div
                  key={si}
                  className={cls}
                  onClick={(e) => k && (e.stopPropagation(), onAgent(k, e))}
                  style={{ cursor: k ? 'pointer' : 'default' }}
                >
                  <span className="hf-dot" style={dotStyle(state, 2)} />
                  <span className="name">{name}</span>
                  {state === 'hot' && (
                    <span className="hf-chip hot" style={{ fontSize: 9, padding: '0 5px' }}>blocked</span>
                  )}
                  {state === 'live' && k && (
                    <span className="mono" style={{ fontSize: 9, color: 'var(--live)' }}>●</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
