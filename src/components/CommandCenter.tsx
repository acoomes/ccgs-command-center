import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { SKILLS, type Skill } from '../data/skills';
import { INITIAL_NEEDS } from '../data/needs';
import { TIMELINE, AUDIT } from '../data/history';
import type { Need, NeedAction, Toast } from '../data/types';
import { Header } from './Header';
import { Pipeline } from './Pipeline';
import { ProjectClock } from './ProjectClock';
import { Needs } from './Needs';
import { Sprint } from './Sprint';
import { Delegation, type DelegationTab } from './Delegation';
import { SkillsPalette } from './SkillsPalette';
import { Toasts, BusyRibbon } from './Toasts';

export function CommandCenter() {
  // ── state ──
  const [tab, setTab] = useState<DelegationTab>('live');
  const [sprintExpanded, setSprintExpanded] = useState(false);
  const [needsExpanded, setNeedsExpanded] = useState(true);
  const [needs, setNeeds] = useState<Need[]>([...INITIAL_NEEDS]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [busySkill, setBusySkill] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // ── toasts ──
  const fireToast = useCallback((title: string, body: string, kind: Toast['kind'] = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body, kind, dying: false }]);
    setTimeout(() => setToasts((t) => t.map((x) => x.id === id ? { ...x, dying: true } : x)), 2800);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3100);
  }, []);

  // ── skill runs ──
  const runSkill = useCallback((cmd: string) => {
    setBusySkill(cmd);
    setTimeout(() => {
      setBusySkill(null);
      fireToast(cmd, 'spawned · output streaming to terminal', 'run');
    }, 1000);
  }, [fireToast]);

  // ── needs resolution ──
  const resolveNeed = useCallback((needId: string, action: NeedAction) => {
    setResolving((s) => new Set([...s, needId]));
    setTimeout(() => setNeeds((n) => n.filter((x) => x.id !== needId)), 470);
    fireToast(`✓ ${action.label}`, action.resolve);
    if (action.skill) runSkill(action.skill);
  }, [fireToast, runSkill]);

  // ── cmd-K ──
  const [query, setQuery] = useState('');
  const [selIdx, setSelIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered: readonly Skill[] = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\//, '');
    if (!q) return SKILLS.slice(0, 6);
    return SKILLS
      .filter(([cmd, hint]) =>
        cmd.slice(1).toLowerCase().includes(q) || hint.toLowerCase().includes(q))
      .slice(0, 7);
  }, [query]);

  useEffect(() => { setSelIdx(0); }, [query]);

  const onKey = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelIdx(Math.min(filtered.length - 1, selIdx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelIdx(Math.max(0, selIdx - 1));
    } else if (e.key === 'Enter' && filtered[selIdx]) {
      e.preventDefault();
      runSkill(filtered[selIdx][0]);
      setQuery('');
    } else if (e.key === 'Escape') {
      setQuery('');
      e.currentTarget.blur();
    }
  }, [filtered, selIdx, runSkill]);

  // global cmd/ctrl-K focus
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── handlers ──
  const handleAgent = useCallback((k: string, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedAgent(k);
  }, []);

  const handleRootClick = useCallback(() => setSelectedAgent(null), []);

  return (
    <div className="hf" onClick={handleRootClick}>
      <Header />
      <Pipeline />
      <ProjectClock />

      <div style={{
        display: 'grid',
        gridTemplateColumns: '340px 1fr 320px',
        gap: 10,
        minHeight: 692,
      }}>
        {/* LEFT — Needs You + Sprint */}
        <div className="col gap10" style={{ minHeight: 0 }}>
          <Needs
            needs={needs}
            resolving={resolving}
            expanded={needsExpanded}
            onToggle={() => setNeedsExpanded((x) => !x)}
            onResolve={resolveNeed}
          />
          <Sprint
            expanded={sprintExpanded}
            onToggle={() => setSprintExpanded((x) => !x)}
            onRunSkill={runSkill}
          />
        </div>

        {/* CENTER — Active delegation */}
        <Delegation
          tab={tab}
          onTab={setTab}
          selectedAgent={selectedAgent}
          onAgent={handleAgent}
          onCloseAgent={() => setSelectedAgent(null)}
          onRunSkill={runSkill}
          timeline={TIMELINE}
          audit={AUDIT}
        />

        {/* RIGHT — Skills cmd-K */}
        <SkillsPalette
          query={query}
          setQuery={setQuery}
          filtered={filtered}
          selIdx={selIdx}
          setSelIdx={setSelIdx}
          onKey={onKey}
          inputRef={inputRef}
          onRunSkill={runSkill}
        />
      </div>

      {busySkill && <BusyRibbon cmd={busySkill} />}
      <Toasts toasts={toasts} />
    </div>
  );
}
