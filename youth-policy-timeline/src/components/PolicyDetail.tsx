import { useEffect, useRef } from 'react';
import { TOTAL_SEARCH_URL } from '../lib/api';
import { downloadDeadlineIcs } from '../lib/ics';
import type { MatchResult } from '../lib/match';
import CheckChips from './CheckChips';
import { DdayBadge } from './PolicyCard';

interface Props {
  m: MatchResult;
  onClose: () => void;
}

export default function PolicyDetail({ m, onClose }: Props) {
  const p = m.policy;
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const applyHref = p.applyUrl || TOTAL_SEARCH_URL;
  const age = p.targetAge;
  const mapQuery = encodeURIComponent(`${p.region} 청년센터`);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="card-top">
            <span className="tag">{p.category}</span>
            {p.subCategory && <span className="tag tag-sub">{p.subCategory}</span>}
            <DdayBadge days={m.daysLeft} />
          </div>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        <h2 id="detail-title" className="modal-title">
          {p.title}
        </h2>

        <dl className="detail-list">
          <dt>지역</dt>
          <dd>{p.region}</dd>
          <dt>신청기간</dt>
          <dd>
            {p.applyStart ?? '정보 없음'} ~ {p.applyEnd ?? '상시·미정'}
          </dd>
          <dt>지원 연령</dt>
          <dd>{age ? `만 ${age.min ?? '?'}세 ~ ${age.max ?? '?'}세` : '제한 없음 또는 정보 없음'}</dd>
          {p.summary && (
            <>
              <dt>정책 소개</dt>
              <dd>{p.summary}</dd>
            </>
          )}
          {p.supportContent && (
            <>
              <dt>지원 내용</dt>
              <dd className="pre">{p.supportContent}</dd>
            </>
          )}
          {p.targetCondition && (
            <>
              <dt>추가 자격 조건</dt>
              <dd className="pre">{p.targetCondition}</dd>
            </>
          )}
        </dl>

        <h3 className="sub-title">내 조건과 비교</h3>
        <CheckChips checks={m.checks} detailed />
        <p className="hint">
          판정은 공개된 조건 필드 기준의 참고용입니다. 최종 자격은 반드시 공고문에서 확인하세요.
        </p>

        <div className="modal-actions">
          <a className="btn btn-primary" href={applyHref} target="_blank" rel="noopener noreferrer">
            {p.applyUrl ? '신청 페이지로 이동' : '온통청년에서 찾아보기'}
          </a>
          {p.applyEnd && (m.daysLeft ?? -1) >= 0 && (
            <button type="button" className="btn btn-outline" onClick={() => downloadDeadlineIcs(p, applyHref)}>
              마감일 캘린더에 추가(.ics)
            </button>
          )}
          <a
            className="btn btn-ghost"
            href={`https://map.naver.com/p/search/${mapQuery}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            주변 청년센터 지도 검색
          </a>
        </div>
      </div>
    </div>
  );
}
