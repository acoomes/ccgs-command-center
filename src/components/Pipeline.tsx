import { PROJECT } from '../data/project';

const PHASES = ['Discover', 'Design', 'Architect', 'Plan', 'Build', 'QA', 'Release'];

export function Pipeline() {
  const currentPhase = PROJECT.phase.number ?? 0;
  const phaseDay = PROJECT.phase.day;

  return (
    <div className="hf-pipeline" style={{ marginBottom: 10 }}>
      {PHASES.map((label, i) => {
        const n = i + 1;
        const cls = currentPhase > 0 && n < currentPhase ? 'done'
                  : n === currentPhase ? 'now' : '';
        return (
          <div key={n} className={`step ${cls}`}>
            <span className="num">0{n}</span>
            <span className="lbl">{label}</span>
            {n === currentPhase && phaseDay && (
              <span className="hf-chip accent" style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px' }}>
                day {phaseDay}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
