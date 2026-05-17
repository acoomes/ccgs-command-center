import type { MouseEvent } from 'react';
import type { AgentDetail } from '../data/types';
import { SlashChip } from './SlashChip';

interface AgentPopoverProps {
  info: AgentDetail;
  onClose: (e: MouseEvent) => void;
  onRunSkill: (cmd: string) => void;
}

export function AgentPopover({ info, onClose, onRunSkill }: AgentPopoverProps) {
  const statusColor =
    info.status === 'Blocked' ? 'var(--hot)' :
    info.status === 'Active' ? 'var(--live)' : 'var(--text-1)';

  return (
    <div className="hf-pop" onClick={(e) => e.stopPropagation()}>
      <div className="hf-pop-head">
        <div className="col gap2">
          <span className="role">{info.role}</span>
          <span className="row gap6 small muted">
            <span>tier {info.tier}</span>
            <span>·</span>
            <span className="mono">{info.model}</span>
            <span>·</span>
            <span className="strong" style={{ color: statusColor }}>{info.status}</span>
          </span>
        </div>
        <span className="close" onClick={onClose}>✕</span>
      </div>
      <div className="hf-pop-body">{info.task}</div>
      <div className="hf-pop-foot">
        <span className="mono tiny">started {info.started}</span>
        <span className="muted">·</span>
        <span className="tiny">{info.spawned}</span>
      </div>
      <div className="hf-pop-foot" style={{ borderTop: 'none', paddingTop: 0 }}>
        <SlashChip cmd="/code-review" onRun={onRunSkill} />
        <SlashChip cmd="/design-review" onRun={onRunSkill} />
        <span style={{ marginLeft: 'auto' }} className="hf-btn ghost" onClick={onClose}>close</span>
      </div>
    </div>
  );
}
