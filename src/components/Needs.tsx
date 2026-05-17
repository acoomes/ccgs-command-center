import type { MouseEvent } from 'react';
import type { Need, NeedAction } from '../data/types';

interface NeedsProps {
  needs: Need[];
  resolving: Set<string>;
  expanded: boolean;
  onToggle: () => void;
  onResolve: (needId: string, action: NeedAction) => void;
}

export function Needs({ needs, resolving, expanded, onToggle, onResolve }: NeedsProps) {
  if (needs.length === 0) {
    return (
      <div className="hf-panel">
        <div className="hf-panel-head">
          <span className="hf-dot ok" />
          <span className="title">Needs you</span>
          <span className="sub">all clear</span>
        </div>
        <div className="hf-panel-body">
          <div className="display" style={{ color: 'var(--text-0)', marginBottom: 4 }}>Nothing waiting.</div>
          <div className="small muted">Agents are heads-down. Drive the next move.</div>
        </div>
      </div>
    );
  }

  const items = expanded ? needs : needs.slice(0, 1);
  const handleToggle = (e: MouseEvent) => { e.stopPropagation(); onToggle(); };

  return (
    <div className="hf-attn">
      <div className="hf-attn-head">
        <span className="marker">!</span>
        <span className="title">Needs you</span>
        <span className="muted small">{needs.length} waiting · oldest 12m</span>
        {needs.length > 1 && (
          <span onClick={handleToggle} className="muted small"
                style={{ marginLeft: 'auto', cursor: 'pointer' }}>
            {expanded ? '▾ collapse' : `▸ show ${needs.length - 1} more`}
          </span>
        )}
      </div>
      {items.map((it) => {
        const isResolving = resolving.has(it.id);
        return (
          <div key={it.id} className={`hf-attn-item ${isResolving ? 'resolving' : ''}`}>
            <div className="head">
              <span className="ttl">{it.title}</span>
              <span className="from">{it.from}</span>
            </div>
            {it.detail && <div className="detail">{it.detail}</div>}
            <div className="actions">
              {it.actions.map((a, j) => {
                const cls = ['hf-btn', a.primary && 'primary', a.hot && 'hot']
                  .filter(Boolean).join(' ');
                return (
                  <button
                    key={j}
                    className={cls}
                    onClick={(e) => { e.stopPropagation(); onResolve(it.id, a); }}
                    disabled={isResolving}
                  >{a.label}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
