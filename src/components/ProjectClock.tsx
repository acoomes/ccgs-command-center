import { useCountUp } from '../hooks/useCountUp';
import { PROJECT, projectDay, lastSessionAge } from '../data/project';

const Divider = () => (
  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)' }} />
);

export function ProjectClock() {
  const targetDay     = projectDay();
  const targetSession = PROJECT.session.count;
  const targetPhaseDay = PROJECT.phase.day ?? 0;

  const projDay    = useCountUp(targetDay, 1100);
  const phaseDay   = useCountUp(targetPhaseDay, 800);
  const sessionNum = useCountUp(targetSession, 950);

  const phaseLabel = PROJECT.phase.number
    ? `Phase ${PROJECT.phase.number}`
    : 'Phase';

  return (
    <div className="hf-panel" style={{ marginBottom: 10 }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 24 }}>
        <div className="col">
          <span className="tiny muted uppercase">Project</span>
          <span className="row gap6 baseline">
            <span className="serif tnum" style={{ fontSize: 24, color: 'var(--text-0)', lineHeight: 1 }}>
              Day {projDay}
            </span>
          </span>
        </div>
        <Divider />
        <div className="col grow" style={{ minWidth: 0 }}>
          <div className="row between baseline" style={{ marginBottom: 6 }}>
            <span className="row gap6 baseline">
              <span className="tiny muted uppercase">Sprint</span>
              <span className="small muted">no active sprint</span>
            </span>
            <span className="tiny muted">
              run <span className="mono">/sprint-plan</span> to start one
            </span>
          </div>
          <div className="hf-bar" style={{ opacity: 0.35 }}>
            <span style={{ flex: 1, background: 'var(--text-3)' }} />
          </div>
        </div>
        <Divider />
        <div className="col">
          <span className="tiny muted uppercase">{phaseLabel}</span>
          {PROJECT.phase.number ? (
            <span className="serif tnum" style={{ fontSize: 24, color: 'var(--text-0)', lineHeight: 1 }}>
              day {phaseDay}
            </span>
          ) : (
            <span className="serif tnum" style={{ fontSize: 24, color: 'var(--text-2)', lineHeight: 1 }}>—</span>
          )}
          {PROJECT.phase.stage && (
            <span className="tiny muted" style={{ marginTop: 2 }}>{PROJECT.phase.stage}</span>
          )}
        </div>
        <Divider />
        <div className="col">
          <span className="tiny muted uppercase">Session</span>
          <span className="row gap4 baseline">
            <span className="serif tnum" style={{ fontSize: 24, color: 'var(--text-0)', lineHeight: 1 }}>
              #{sessionNum}
            </span>
            <span className="tiny muted">{lastSessionAge()}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
