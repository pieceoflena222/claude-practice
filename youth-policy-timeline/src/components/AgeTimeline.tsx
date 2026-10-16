import { formatDday } from '../lib/date';
import type { MatchResult } from '../lib/match';

const MIN_AGE = 19;
const MAX_AGE = 39;
const SPAN = MAX_AGE - MIN_AGE + 1; // 각 나이를 1칸으로 보고 [나이, 나이+1) 구간을 차지
const LABEL_AGES = [19, 24, 29, 34, 39];

const pct = (age: number) => ((Math.min(Math.max(age, MIN_AGE), MAX_AGE + 1) - MIN_AGE) / SPAN) * 100;

interface Props {
  rows: MatchResult[];
  age: number;
  onOpen: (m: MatchResult) => void;
}

type Phase = 'now' | 'future' | 'past';

function phaseOf(m: MatchResult, age: number): Phase {
  const a = m.policy.targetAge;
  if (a?.min != null && age < a.min) return 'future';
  if (a?.max != null && age > a.max) return 'past';
  return 'now';
}

function deadlineText(m: MatchResult, age: number, phase: Phase): string {
  const a = m.policy.targetAge;
  if (phase === 'future') return `만 ${a?.min}세부터 대상`;
  if (phase === 'past') return `만 ${a?.max}세까지였음 (연령 초과)`;
  if (a?.max == null) return '연령 상한 없음/정보 없음';
  const left = a.max - age;
  if (left === 0) return `만 ${a.max}세까지 — 지금이 마지막 나이`;
  return `만 ${a.max + 1}세 되기 전까지 신청 (${left}년 남음)`;
}

export default function AgeTimeline({ rows, age, onOpen }: Props) {
  const nowLeft = pct(age) + 100 / SPAN / 2;
  const ending = rows.filter((r) => r.ageEndingSoon && phaseOf(r, age) === 'now');
  const outOfAxis = age < MIN_AGE || age > MAX_AGE;

  return (
    <section className="panel timeline" aria-label="나이 타임라인">
      <div className="timeline-head">
        <h2 className="panel-title">나이 타임라인 (만 {MIN_AGE}~{MAX_AGE}세)</h2>
        <ul className="legend" aria-label="범례">
          <li><span className="lg lg-now" />지금 대상</li>
          <li><span className="lg lg-soon" />곧 자격 종료</li>
          <li><span className="lg lg-future" />앞으로 대상</li>
          <li><span className="lg lg-past" />연령 지남</li>
        </ul>
      </div>

      {ending.length > 0 ? (
        <div className="alert-soon" role="note">
          <strong>⏰ 곧 연령 자격이 끝나는 정책 {ending.length}개</strong>
          <ul>
            {ending.map((m) => (
              <li key={m.policy.id}>
                <button type="button" className="link-btn" onClick={() => onOpen(m)}>
                  {m.policy.title}
                </button>{' '}
                — 만 {(m.policy.targetAge?.max ?? 0) + 1}세 되기 전 신청
                {m.daysLeft !== null && m.daysLeft >= 0 && ` · 이번 모집 ${formatDday(m.daysLeft)}`}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="hint">현재 나이 기준으로 1년 안에 연령 자격이 끝나는 정책은 없습니다.</p>
      )}
      {outOfAxis && <p className="hint">입력한 나이(만 {age}세)가 표시 범위 밖이라 세로선이 가장자리에 표시됩니다.</p>}

      <div className="tl" role="list">
        <div className="tl-row tl-axis" aria-hidden="true">
          <div className="tl-label" />
          <div className="tl-track">
            {LABEL_AGES.filter((a) => Math.abs(a - age) >= 2).map((a) => (
              <span key={a} className="tl-tick" style={{ left: `${pct(a) + 100 / SPAN / 2}%` }}>
                {a}
              </span>
            ))}
            <span className="tl-tick tl-tick-now" style={{ left: `${nowLeft}%` }}>
              나 {age}
            </span>
          </div>
        </div>

        {rows.map((m) => {
          const a = m.policy.targetAge;
          const lo = a?.min ?? MIN_AGE;
          const hi = a?.max ?? MAX_AGE;
          const left = pct(lo);
          const width = Math.max(pct(hi + 1) - left, 1.5);
          const phase = phaseOf(m, age);
          const soon = m.ageEndingSoon && phase === 'now';
          const cls = `tl-bar tl-${soon ? 'soon' : phase}${a?.min == null ? ' open-start' : ''}${a?.max == null ? ' open-end' : ''}`;
          const label = deadlineText(m, age, phase);
          return (
            <div key={m.policy.id} className="tl-row" role="listitem">
              <div className="tl-label">
                <button type="button" className="link-btn tl-name" onClick={() => onOpen(m)}>
                  {m.policy.title}
                </button>
                <span className={`tl-sub${soon ? ' tl-sub-soon' : ''}`}>{label}</span>
              </div>
              <div className="tl-track">
                <div className="tl-grid" aria-hidden="true" />
                <button
                  type="button"
                  className={cls}
                  style={{ left: `${left}%`, width: `${width}%` }}
                  onClick={() => onOpen(m)}
                  aria-label={`${m.policy.title}: 만 ${a?.min ?? '?'}~${a?.max ?? '?'}세, ${label}`}
                >
                  <span className="tl-bar-text">
                    {a?.min ?? '?'}~{a?.max ?? '?'}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
        <div className="tl-now-line" style={{ left: `calc(var(--tl-label-w) + (100% - var(--tl-label-w)) * ${nowLeft / 100})` }} aria-hidden="true" />
      </div>
      <p className="hint">
        막대 = 지원 연령 구간(만 나이). 연령 기준일(신청일·공고일·출생연도 등)은 정책마다 달라 실제 마감 나이와 다를 수
        있습니다. 나이 외 조건(지역·취업상태·학력·소득)에서 불일치한 정책은 제외했습니다.
      </p>
    </section>
  );
}
