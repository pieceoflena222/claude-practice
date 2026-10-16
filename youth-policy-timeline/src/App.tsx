import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AgeTimeline from './components/AgeTimeline';
import ConditionForm from './components/ConditionForm';
import PolicyCard from './components/PolicyCard';
import PolicyDetail from './components/PolicyDetail';
import StateView, { CardSkeletons } from './components/StateView';
import { describeReason, loadPolicies, type LoadResult } from './lib/api';
import { CATEGORIES, SIDO_CODES, ULSAN_SIGUNGU } from './lib/codes';
import { matchPolicy, sortByDeadline, type MatchResult, type Profile } from './lib/match';
import { clearProfile, loadProfile, saveProfile } from './lib/storage';

const DEFAULT_PROFILE: Profile = {
  age: 27,
  sido: '31',
  sigungu: '',
  employment: '미취업자',
  education: '대학 졸업',
  income: null,
};

type Status = 'idle' | 'loading' | 'error' | 'ready';
type View = 'cards' | 'timeline';

/** 상태 화면 확인용: ?demo=loading | empty | error */
const DEMO = new URLSearchParams(window.location.search).get('demo');

export default function App() {
  const saved = useMemo(() => loadProfile(), []);
  const [form, setForm] = useState<Profile>(saved ?? DEFAULT_PROFILE);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<LoadResult | null>(null);
  const [view, setView] = useState<View>('cards');
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');
  const [hideClosed, setHideClosed] = useState(true);
  const [selected, setSelected] = useState<MatchResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const closeDetail = useCallback(() => setSelected(null), []);

  const run = useCallback(async (p: Profile, scroll = true) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProfile(p);
    setStatus('loading');
    if (scroll) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      if (DEMO === 'loading') return; // 로딩 상태 유지
      if (DEMO === 'error') throw new Error('demo');
      const result = await loadPolicies({ size: 100, region: p.sigungu || undefined }, ctrl.signal);
      if (DEMO === 'empty') result.items = [];
      setData(result);
      setStatus('ready');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      setStatus('error');
    }
  }, []);

  // 저장된 조건이 있으면 바로 판정
  useEffect(() => {
    if (saved || DEMO) void run(saved ?? DEFAULT_PROFILE, false);
    return () => abortRef.current?.abort();
  }, [saved, run]);

  const submit = () => {
    saveProfile(form);
    void run(form);
  };

  const reset = () => {
    clearProfile();
    setForm(DEFAULT_PROFILE);
    setProfile(null);
    setData(null);
    setStatus('idle');
  };

  const matches = useMemo(() => {
    if (!data || !profile) return [];
    const now = new Date();
    return data.items.map((p) => matchPolicy(p, profile, now));
  }, [data, profile]);

  const applyFilters = useCallback(
    (list: MatchResult[]) => {
      const kw = keyword.trim();
      return list.filter(
        (m) =>
          (!category || m.policy.category.includes(category)) &&
          (!kw || `${m.policy.title} ${m.policy.summary} ${m.policy.supportContent}`.includes(kw)),
      );
    },
    [category, keyword],
  );

  const eligible = useMemo(() => matches.filter((m) => m.eligible), [matches]);
  const cardList = useMemo(
    () =>
      applyFilters(eligible)
        .filter((m) => !hideClosed || m.daysLeft === null || m.daysLeft >= 0)
        .sort(sortByDeadline),
    [eligible, applyFilters, hideClosed],
  );
  const timelineRows = useMemo(
    () =>
      applyFilters(matches.filter((m) => m.eligibleExceptAge)).sort((a, b) => {
        if (a.ageEndingSoon !== b.ageEndingSoon) return a.ageEndingSoon ? -1 : 1;
        return (a.policy.targetAge?.max ?? 99) - (b.policy.targetAge?.max ?? 99);
      }),
    [matches, applyFilters],
  );

  const urgentCount = eligible.filter((m) => m.daysLeft !== null && m.daysLeft >= 0 && m.daysLeft <= 7).length;
  const soonCount = eligible.filter((m) => m.ageEndingSoon).length;
  const regionText = profile
    ? `${SIDO_CODES[profile.sido] ?? ''}${
        profile.sigungu ? ` ${ULSAN_SIGUNGU.find((s) => s.code === profile.sigungu)?.name ?? ''}` : ''
      }`
    : '';

  return (
    <div className="app">
      <header className="header">
        <div className="container">
          <p className="eyebrow">울산 청년 정책 판정기</p>
          <h1>내 정책 타임라인</h1>
          <p className="lead">
            조건을 입력하면 나에게 해당되는 청년정책만 골라 마감 D-day와 함께 보여주고, 몇 살 전에 꼭 신청해야 하는지
            나이 타임라인으로 정리합니다.
          </p>
        </div>
      </header>

      {status === 'ready' && data?.source === 'sample' && (
        <div className="banner" role="status">
          <div className="container">
            <strong>샘플 데이터로 표시 중</strong> — 실제 정책이 아닌 예시 데이터입니다.
            {data.fallbackReason && <span className="banner-reason"> (사유: {describeReason(data.fallbackReason)})</span>}
          </div>
        </div>
      )}

      <main className="container layout">
        <aside className="layout-side">
          <ConditionForm value={form} onChange={setForm} onSubmit={submit} onReset={reset} loading={status === 'loading'} />
        </aside>

        <div className="layout-main" ref={resultRef}>
          {status === 'idle' && (
            <StateView kind="intro" title="조건을 입력하고 ‘내 정책 판정하기’를 눌러 주세요">
              나이·거주지·취업상태·학력·소득 5가지 조건으로 신청 가능한 정책을 골라 드립니다.
            </StateView>
          )}

          {status === 'loading' && (
            <>
              <StateView kind="loading" title="정책 정보를 불러오는 중입니다…" />
              <CardSkeletons count={3} />
            </>
          )}

          {status === 'error' && (
            <StateView
              kind="error"
              title="정책 정보를 불러오지 못했습니다"
              action={profile ? { label: '다시 시도', onClick: () => void run(profile) } : undefined}
            >
              잠시 후 다시 시도해 주세요. 문제가 계속되면 온통청년 사이트에서 직접 확인할 수 있습니다.
            </StateView>
          )}

          {status === 'ready' && profile && data && (
            <>
              <section className="summary" aria-label="판정 요약">
                <p className="summary-main">
                  만 {profile.age}세 · {regionText} · {profile.employment} · {profile.education}
                  {profile.income !== null ? ` · 연 ${profile.income.toLocaleString()}만원` : ''}
                </p>
                <div className="stats">
                  <div className="stat">
                    <span className="stat-num">{eligible.length}</span>
                    <span className="stat-label">신청 가능 후보</span>
                  </div>
                  <div className="stat stat-urgent">
                    <span className="stat-num">{urgentCount}</span>
                    <span className="stat-label">마감 7일 이내</span>
                  </div>
                  <div className="stat stat-warn">
                    <span className="stat-num">{soonCount}</span>
                    <span className="stat-label">곧 연령 자격 종료</span>
                  </div>
                </div>
                <p className="hint">
                  전체 {data.totalCount.toLocaleString()}건 중 {data.items.length}건을 불러와 판정했습니다.
                </p>
              </section>

              <div className="toolbar">
                <div className="tabs" role="tablist" aria-label="보기 방식">
                  <button role="tab" aria-selected={view === 'cards'} className="tab" onClick={() => setView('cards')}>
                    정책 카드
                  </button>
                  <button
                    role="tab"
                    aria-selected={view === 'timeline'}
                    className="tab"
                    onClick={() => setView('timeline')}
                  >
                    나이 타임라인
                  </button>
                </div>
                <div className="filters">
                  <select aria-label="분야" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">전체 분야</option>
                    {CATEGORIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <input
                    type="search"
                    aria-label="정책명 검색"
                    placeholder="정책명·내용 검색"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                  {view === 'cards' && (
                    <label className="check">
                      <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
                      마감 지난 정책 숨기기
                    </label>
                  )}
                </div>
              </div>

              {view === 'cards' &&
                (cardList.length === 0 ? (
                  <StateView kind="empty" title="조건에 맞는 정책이 없습니다">
                    {data.items.length === 0
                      ? '불러온 정책이 없습니다. 잠시 후 다시 시도해 주세요.'
                      : '분야·검색어를 바꾸거나 “마감 지난 정책 숨기기”를 해제해 보세요. 조건을 바꿔 다시 판정할 수도 있습니다.'}
                  </StateView>
                ) : (
                  <div className="grid">
                    {cardList.map((m) => (
                      <PolicyCard key={m.policy.id} m={m} onOpen={setSelected} />
                    ))}
                  </div>
                ))}

              {view === 'timeline' &&
                (timelineRows.length === 0 ? (
                  <StateView kind="empty" title="타임라인에 표시할 정책이 없습니다">
                    나이 외 조건이 맞는 정책이 없습니다. 분야·검색어를 바꾸거나 조건을 다시 입력해 보세요.
                  </StateView>
                ) : (
                  <AgeTimeline rows={timelineRows} age={profile.age} onOpen={setSelected} />
                ))}
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>
            데이터 출처: 온통청년(youthcenter.go.kr) 청년정책 오픈API. 판정 결과는 참고용이며, 최종 자격과 일정은 각 정책
            공고문을 확인하세요.
          </p>
        </div>
      </footer>

      {selected && <PolicyDetail m={selected} onClose={closeDetail} />}
    </div>
  );
}
