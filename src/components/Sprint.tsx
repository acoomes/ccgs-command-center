import type { MouseEvent } from 'react';
import { PROJECT } from '../data/project';
import type { SprintInfo, SprintPriority, SprintStory, SprintStoryStatus } from '../data/project';
import { SlashChip } from './SlashChip';

interface SprintProps {
  expanded: boolean;
  onToggle: () => void;
  onRunSkill: (cmd: string) => void;
}

const PRIORITY_LABELS: Record<SprintPriority, string> = {
  must:   'Must have',
  should: 'Should have',
  nice:   'Nice to have',
};

const STATUS_LABEL: Record<SprintStoryStatus, string> = {
  todo:    'TODO',
  inprog:  'IN PROG',
  review:  'REVIEW',
  blocked: 'BLOCKED',
  done:    'DONE',
};

export function Sprint({ expanded, onToggle, onRunSkill }: SprintProps) {
  const handleToggle = (e: MouseEvent) => { e.stopPropagation(); onToggle(); };
  const sprint = PROJECT.sprint;
  const hasActive = sprint.hasActive;

  return (
    <div className="hf-panel grow" style={{ minHeight: 0 }}>
      <div className="hf-panel-head">
        <span className="title">Sprint</span>
        <span className="sub">{subtitle(sprint)}</span>
        {hasActive && (
          <div className="right">
            <span className="mono tnum">{progressLabel(sprint.stories)}</span>
            <span onClick={handleToggle} className="hf-chip" style={{ cursor: 'pointer' }}>
              {expanded ? 'collapse' : 'expand'}
            </span>
          </div>
        )}
      </div>

      {hasActive
        ? <SprintBody sprint={sprint} expanded={expanded} />
        : <SprintEmptyState onRunSkill={onRunSkill} />}

      <div className="hf-panel-foot">
        <SlashChip cmd="/sprint-plan" onRun={onRunSkill} />
        <SlashChip cmd="/sprint-status" onRun={onRunSkill} />
        <SlashChip cmd="/story-readiness" onRun={onRunSkill} />
      </div>
    </div>
  );
}

function subtitle(s: SprintInfo): string {
  if (!s.hasActive) return 'no active sprint';
  const tag = s.number != null ? `S-${String(s.number).padStart(2, '0')}` : 'sprint';
  const window = s.start && s.end ? ` · ${s.start} → ${s.end}` : '';
  return `${tag}${window}`;
}

function progressLabel(stories: SprintStory[]): string {
  if (!stories.length) return '— stories';
  const done = stories.filter((s) => s.status === 'done').length;
  return `${done}/${stories.length} done`;
}

function SprintBody({ sprint, expanded }: {
  sprint: Extract<SprintInfo, { hasActive: true }>;
  expanded: boolean;
}) {
  if (!sprint.stories.length) {
    return (
      <div className="hf-panel-body" style={{ padding: '16px 14px' }}>
        <div className="small muted">
          Sprint file <span className="mono">production/sprints/{sprint.file}</span> has no
          stories yet. Add tables under <span className="mono">### Must Have</span> /
          <span className="mono"> ### Should Have</span> /
          <span className="mono"> ### Nice to Have</span>.
        </div>
      </div>
    );
  }

  const groups: SprintPriority[] = ['must', 'should', 'nice'];
  const shown = expanded ? groups : ['must' as SprintPriority];

  return (
    <div className="hf-panel-body col" style={{ gap: 12, padding: '12px 12px 10px' }}>
      {sprint.goal && (
        <div className="small" style={{ color: 'var(--text-1)', lineHeight: 1.4 }}>
          {sprint.goal}
        </div>
      )}
      {shown.map((priority) => {
        const items = sprint.stories.filter((s) => s.priority === priority);
        if (!items.length) return null;
        return (
          <div key={priority} className="col gap6">
            <div className="tiny muted uppercase">
              {PRIORITY_LABELS[priority]} · {items.length}
            </div>
            <div className="col" style={{ gap: 6 }}>
              {items.map((s) => <StoryCard key={s.id} story={s} />)}
            </div>
          </div>
        );
      })}
      {!expanded && (
        <div className="tiny muted">
          {sprint.stories.filter((s) => s.priority !== 'must').length} more in
          Should / Nice — expand to see all. Status source: {sprint.statusSource}.
        </div>
      )}
    </div>
  );
}

function StoryCard({ story }: { story: SprintStory }) {
  return (
    <div className={`hf-story s-${story.status}`}>
      <div className="id">{story.id}</div>
      <div className="pts">{story.est || ''}</div>
      <div className="ttl">{story.title || '—'}</div>
      <div className="owner">{story.owner || '—'}</div>
      <div className="stat">{STATUS_LABEL[story.status]}</div>
    </div>
  );
}

function SprintEmptyState({ onRunSkill }: { onRunSkill: (cmd: string) => void }) {
  return (
    <div className="hf-panel-body" style={{
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      alignItems: 'flex-start', gap: 10, padding: '20px 18px',
    }}>
      <div className="display" style={{ color: 'var(--text-0)' }}>No active sprint</div>
      <div className="small muted" style={{ maxWidth: 280, lineHeight: 1.5 }}>
        Run <span className="mono" style={{ color: 'var(--text-1)' }}>/sprint-plan</span> once
        you've crossed into Production. Sprint files live in{' '}
        <span className="mono" style={{ color: 'var(--text-1)' }}>production/sprints/</span>;
        this panel picks them up automatically.
      </div>
      <div className="row gap6 wrap" style={{ marginTop: 4 }}>
        <SlashChip cmd="/sprint-plan" onRun={onRunSkill} suggested />
        <SlashChip cmd="/create-epics" onRun={onRunSkill} />
      </div>
    </div>
  );
}
