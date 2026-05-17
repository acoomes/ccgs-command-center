import type { ChangeEvent, KeyboardEvent, MouseEvent, RefObject } from 'react';
import { SKILLS, type Skill } from '../data/skills';
import { SlashChip } from './SlashChip';

interface SkillsPaletteProps {
  query: string;
  setQuery: (q: string) => void;
  filtered: readonly Skill[];
  selIdx: number;
  setSelIdx: (i: number) => void;
  onKey: (e: KeyboardEvent<HTMLInputElement>) => void;
  inputRef: RefObject<HTMLInputElement>;
  onRunSkill: (cmd: string) => void;
}

const RECENT: readonly string[] = [
  '/dev-story S-041',
  '/code-review',
  '/design-review',
  '/team-narrative',
  '/asset-audit',
  '/balance-check',
];

const TEAMS: readonly string[] = [
  '/team-narrative',
  '/team-combat',
  '/team-ui',
  '/team-qa',
  '/team-polish',
];

export function SkillsPalette(props: SkillsPaletteProps) {
  const { query, setQuery, filtered, selIdx, setSelIdx, onKey, inputRef, onRunSkill } = props;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => setQuery(e.target.value);
  const stopAndFocus = (e: MouseEvent<HTMLInputElement>) => {
    e.stopPropagation();
    (e.target as HTMLInputElement).focus();
  };

  return (
    <div className="hf-panel" style={{ minHeight: 0 }}>
      <div className="hf-panel-head">
        <span className="title">Skills</span>
        <span className="sub">launch · trail · suggested</span>
        <span className="right">
          <span className="hf-chip mono">{SKILLS.length}</span>
        </span>
      </div>
      <div className="hf-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="hf-input">
          <span className="prefix">›</span>
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={onKey}
            placeholder="type a command…"
            onClick={stopAndFocus}
            onMouseDown={(e) => e.stopPropagation()}
          />
          <span className="kbd">⌘K</span>
        </div>

        <div key={query} className="hf-result-list col" style={{ gap: 2 }}>
          <div className="tiny muted uppercase" style={{ marginBottom: 4 }}>
            {query
              ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
              : 'Suggested next'}
          </div>
          {filtered.length === 0 && (
            <div className="small muted" style={{ padding: '4px 6px' }}>
              No matching skill. Try a shorter query.
            </div>
          )}
          {filtered.map(([cmd, hint], i) => (
            <div
              key={cmd}
              onMouseEnter={() => setSelIdx(i)}
              onClick={(e) => { e.stopPropagation(); onRunSkill(cmd); setQuery(''); }}
              className={`hf-result ${i === selIdx ? 'selected' : ''}`}
            >
              <span className="cmd">{cmd}</span>
              <span className="hint">{hint}</span>
              {i === selIdx ? <span className="ent">↵</span> : <span className="ent">&nbsp;</span>}
            </div>
          ))}
        </div>

        <div className="col gap6" style={{ marginTop: 4 }}>
          <div className="tiny muted uppercase">Recent · this session</div>
          <div className="row gap4 wrap">
            {RECENT.map((cmd) => <SlashChip key={cmd} cmd={cmd} onRun={onRunSkill} />)}
          </div>
        </div>

        <div className="col gap6">
          <div className="tiny muted uppercase">Team orchestration</div>
          <div className="row gap4 wrap">
            {TEAMS.map((cmd) => <SlashChip key={cmd} cmd={cmd} onRun={onRunSkill} />)}
          </div>
        </div>
      </div>
      <div className="hf-panel-foot">
        <span className="muted">{SKILLS.length} skills</span>
        <span className="muted">·</span>
        <span className="muted">⌘K focuses · type to filter</span>
      </div>
    </div>
  );
}
