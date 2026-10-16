import type { Check } from '../lib/match';

const ICON = { ok: '✓', unknown: '?', fail: '✕' } as const;
const STATUS_TEXT = { ok: '일치', unknown: '확인 필요', fail: '불일치' } as const;

export default function CheckChips({ checks, detailed = false }: { checks: Check[]; detailed?: boolean }) {
  return (
    <ul className={`chips${detailed ? ' chips-detailed' : ''}`} aria-label="조건 일치 항목">
      {checks.map((c) => (
        <li key={c.key} className={`chip chip-${c.status}`} title={c.note}>
          <span aria-hidden="true">{ICON[c.status]}</span> {c.label}
          <span className="sr-only"> {STATUS_TEXT[c.status]}</span>
          {detailed && <span className="chip-note"> — {STATUS_TEXT[c.status]}: {c.note}</span>}
        </li>
      ))}
    </ul>
  );
}
