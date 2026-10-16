import { formatDday } from '../lib/date';
import type { MatchResult } from '../lib/match';
import CheckChips from './CheckChips';

interface Props {
  m: MatchResult;
  onOpen: (m: MatchResult) => void;
}

export function DdayBadge({ days }: { days: number | null }) {
  const cls =
    days === null ? 'dday dday-none' : days < 0 ? 'dday dday-closed' : days <= 7 ? 'dday dday-urgent' : 'dday';
  return (
    <span className={cls} aria-label={`신청 마감 ${formatDday(days)}`}>
      {formatDday(days)}
    </span>
  );
}

export default function PolicyCard({ m, onOpen }: Props) {
  const p = m.policy;
  const urgent = m.daysLeft !== null && m.daysLeft >= 0 && m.daysLeft <= 7;
  return (
    <article className={`card${urgent ? ' card-urgent' : ''}`}>
      <div className="card-top">
        <span className="tag">{p.category}</span>
        {m.ageEndingSoon && <span className="tag tag-warn">곧 연령 자격 종료</span>}
        <DdayBadge days={m.daysLeft} />
      </div>
      <h3 className="card-title">{p.title}</h3>
      <p className="card-meta">
        {p.region} · {p.applyEnd ? `~${p.applyEnd} 마감` : '상시·기간 미정'}
      </p>
      {p.summary && <p className="card-summary">{p.summary}</p>}
      <CheckChips checks={m.checks} />
      <button type="button" className="btn btn-outline card-btn" onClick={() => onOpen(m)}>
        자세히 보기
      </button>
    </article>
  );
}
