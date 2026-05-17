import { PROJECT } from '../data/project';
import { HISTORY } from '../data/history';

// Compact session-age label. Mirrors relativeAge() but tighter for the
// statusline ("14m", "2h", "—") rather than "14m ago".
function sessionAgeLabel(startTs: number | null, nowSec: number): string {
  if (startTs == null) return '—';
  const s = Math.max(0, nowSec - startTs);
  if (s < 60)    return '<1m';
  if (s < 3600)  return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function Header() {
  const dirtyChip = PROJECT.git.dirtyCount > 0
    ? <span className="hf-chip hot">{PROJECT.git.dirtyCount} dirty</span>
    : <span className="hf-chip"><span className="hf-dot ok" style={{ marginRight: 4 }} />clean</span>;

  return (
    <div className="row gap10 baseline" style={{ marginBottom: 10 }}>
      <div className="row gap8 baseline">
        <span style={{
          width: 18, height: 18, borderRadius: 4,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          display: 'inline-block',
        }} />
        <span className="display">{PROJECT.name}</span>
        {PROJECT.engine && <span className="hf-chip">{PROJECT.engine}</span>}
        {PROJECT.reviewMode && <span className="hf-chip">{PROJECT.reviewMode} review</span>}
      </div>
      <div className="grow" />
      <div className="hf-statusline">
        <span className="seg">
          <span className="k">session</span>
          <span className="v tnum" title="time since last `## Session End:` marker">
            {sessionAgeLabel(HISTORY.sessionStartTs, PROJECT.generatedAt)}
          </span>
        </span>
        <span className="sep">·</span>
        <span className="seg">
          <span className="k">branch</span>
          <span className="v">{PROJECT.git.branch ?? '—'}</span>
        </span>
        <span className="sep">·</span>
        <span className="seg">{dirtyChip}</span>
      </div>
    </div>
  );
}
