import type { Toast } from '../data/types';

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{
      position: 'fixed', bottom: 18, right: 18,
      display: 'flex', flexDirection: 'column-reverse',
      gap: 8, zIndex: 50, pointerEvents: 'none',
    }}>
      {toasts.map((t) => (
        <div key={t.id} className={`hf-toast ${t.kind === 'run' ? 'run' : ''}`} style={{
          opacity: t.dying ? 0 : 1,
          transform: t.dying ? 'translateY(8px)' : 'translateY(0)',
          transition: 'opacity 240ms ease, transform 240ms ease',
        }}>
          <div className="ttl">{t.title}</div>
          {t.body && <div className="body">{t.body}</div>}
        </div>
      ))}
    </div>
  );
}

interface BusyRibbonProps {
  cmd: string;
}

export function BusyRibbon({ cmd }: BusyRibbonProps) {
  return (
    <div className="hf-busy">
      <span className="arrow">▶</span>
      <span>running <span className="mono">{cmd}</span></span>
      <span className="dots"><span /><span /><span /></span>
    </div>
  );
}
