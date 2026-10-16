import type { ReactNode } from 'react';

interface Props {
  kind: 'loading' | 'empty' | 'error' | 'intro';
  title: string;
  children?: ReactNode;
  action?: { label: string; onClick: () => void };
}

const ICON = { loading: '', empty: '🔍', error: '⚠️', intro: '🧭' } as const;

export default function StateView({ kind, title, children, action }: Props) {
  return (
    <div
      className={`state state-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'loading' ? 'polite' : undefined}
      aria-busy={kind === 'loading'}
    >
      {kind === 'loading' ? <span className="spinner" aria-hidden="true" /> : <span className="state-icon" aria-hidden="true">{ICON[kind]}</span>}
      <p className="state-title">{title}</p>
      {children && <div className="state-desc">{children}</div>}
      {action && (
        <button type="button" className="btn btn-outline" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function CardSkeletons({ count = 6 }: { count?: number }) {
  return (
    <div className="grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card skeleton">
          <div className="sk sk-line sk-short" />
          <div className="sk sk-line" />
          <div className="sk sk-line sk-mid" />
          <div className="sk sk-block" />
        </div>
      ))}
    </div>
  );
}
