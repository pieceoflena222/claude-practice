import type { Policy } from '../types';
import { SIDO_CODES, ULSAN_SIGUNGU } from './codes';
import { daysUntil } from './date';

export interface Profile {
  /** 만 나이 */
  age: number;
  /** 시도 코드 2자리 (예: "31" 울산) */
  sido: string;
  /** 시군구 코드 5자리, 선택 안 하면 "" */
  sigungu: string;
  employment: string;
  education: string;
  /** 연소득(만원). 모르면 null */
  income: number | null;
}

export type CheckStatus = 'ok' | 'unknown' | 'fail';
export type CheckKey = 'age' | 'region' | 'employment' | 'education' | 'income';

export interface Check {
  key: CheckKey;
  label: string;
  status: CheckStatus;
  note: string;
}

export interface MatchResult {
  policy: Policy;
  checks: Check[];
  /** 불일치 항목이 하나도 없음 (= 현재 신청 가능 후보) */
  eligible: boolean;
  /** 나이를 제외한 조건에 불일치가 없음 (타임라인에서 미래/과거 구간 표시용) */
  eligibleExceptAge: boolean;
  daysLeft: number | null;
  /** 지원 연령 상한까지 남은 햇수 (상한 없으면 null) */
  yearsLeftByAge: number | null;
  /** 곧 연령 자격이 끝나는 정책 */
  ageEndingSoon: boolean;
}

/** 연령 상한까지 이 햇수 이하로 남으면 "곧 자격 종료"로 강조 */
export const AGE_ENDING_SOON_YEARS = 1;

const LABELS: Record<CheckKey, string> = {
  age: '나이',
  region: '지역',
  employment: '취업상태',
  education: '학력',
  income: '소득',
};

const sidoName = (code: string) => SIDO_CODES[code.slice(0, 2)] ?? '';

function checkAge(p: Policy, age: number): Check {
  const a = p.targetAge;
  if (!a || (a.min === null && a.max === null))
    return { key: 'age', label: LABELS.age, status: 'unknown', note: '연령 제한 없음 또는 정보 없음' };
  const range = `만 ${a.min ?? '?'}~${a.max ?? '?'}세`;
  if (a.min !== null && age < a.min) return { key: 'age', label: LABELS.age, status: 'fail', note: `${range} (아직 대상 아님)` };
  if (a.max !== null && age > a.max) return { key: 'age', label: LABELS.age, status: 'fail', note: `${range} (연령 초과)` };
  return { key: 'age', label: LABELS.age, status: 'ok', note: range };
}

function checkRegion(p: Policy, prof: Profile): Check {
  const base = { key: 'region' as const, label: LABELS.region };
  const myName = SIDO_CODES[prof.sido] ?? '';
  const codes = p.eligibility.zipCodes;
  if (codes.length > 0) {
    const sameSido = codes.filter((c) => sidoName(c) === myName);
    if (sameSido.length === 0) return { ...base, status: 'fail', note: `${p.region} 대상` };
    if (prof.sigungu && !codes.includes(prof.sigungu)) {
      const gu = ULSAN_SIGUNGU.find((s) => s.code === prof.sigungu)?.name ?? '선택 지역';
      return { ...base, status: 'fail', note: `${p.region} 대상 (${gu} 제외)` };
    }
    return { ...base, status: 'ok', note: p.region };
  }
  const text = p.eligibility.regionText || p.region;
  if (!text || /전국|중앙/.test(text)) return { ...base, status: 'unknown', note: text || '지역 정보 없음' };
  if (myName && text.includes(myName)) return { ...base, status: 'ok', note: text };
  const other = Object.values(SIDO_CODES).find((n) => n !== myName && text.includes(n));
  if (other) return { ...base, status: 'fail', note: `${text} 대상` };
  return { ...base, status: 'unknown', note: text };
}

function checkList(key: 'employment' | 'education', list: string[], mine: string): Check {
  const base = { key, label: LABELS[key] };
  if (list.length === 0) return { ...base, status: 'unknown', note: '조건 정보 없음' };
  if (list.some((l) => /제한\s*없음/.test(l))) return { ...base, status: 'ok', note: '제한 없음' };
  if (list.includes(mine)) return { ...base, status: 'ok', note: mine };
  return { ...base, status: 'fail', note: `${list.join(', ')} 대상` };
}

function checkIncome(p: Policy, income: number | null): Check {
  const base = { key: 'income' as const, label: LABELS.income };
  const e = p.eligibility;
  if (e.incomeType === 'none') return { ...base, status: 'ok', note: '소득 무관' };
  if (e.incomeType === 'other' || e.incomeType === 'unknown')
    return { ...base, status: 'unknown', note: e.incomeNote || '소득 기준 별도 확인 필요' };
  // annual
  const range = `연 ${e.incomeMin ? `${e.incomeMin.toLocaleString()}만원 이상 ` : ''}${
    e.incomeMax ? `${e.incomeMax.toLocaleString()}만원 이하` : ''
  }`.trim();
  if (income === null) return { ...base, status: 'unknown', note: `${range} (소득 미입력)` };
  if (e.incomeMax !== null && income > e.incomeMax) return { ...base, status: 'fail', note: `${range} 초과` };
  if (e.incomeMin !== null && income < e.incomeMin) return { ...base, status: 'fail', note: `${range} 미달` };
  if (e.incomeMax === null && e.incomeMin === null) return { ...base, status: 'unknown', note: '연소득 기준 금액 정보 없음' };
  return { ...base, status: 'ok', note: range };
}

export function matchPolicy(p: Policy, prof: Profile, now = new Date()): MatchResult {
  const checks = [
    checkAge(p, prof.age),
    checkRegion(p, prof),
    checkList('employment', p.eligibility.employment, prof.employment),
    checkList('education', p.eligibility.education, prof.education),
    checkIncome(p, prof.income),
  ];
  const eligible = checks.every((c) => c.status !== 'fail');
  const eligibleExceptAge = checks.every((c) => c.key === 'age' || c.status !== 'fail');
  const max = p.targetAge?.max ?? null;
  const yearsLeftByAge = max === null ? null : max - prof.age;
  return {
    policy: p,
    checks,
    eligible,
    eligibleExceptAge,
    daysLeft: daysUntil(p.applyEnd, now),
    yearsLeftByAge,
    ageEndingSoon: yearsLeftByAge !== null && yearsLeftByAge >= 0 && yearsLeftByAge <= AGE_ENDING_SOON_YEARS,
  };
}

/** 정렬: 마감 임박(마감 안 지난 것) → 상시 → 마감 지남 */
export function sortByDeadline(a: MatchResult, b: MatchResult): number {
  const rank = (m: MatchResult) => (m.daysLeft === null ? 1e6 : m.daysLeft < 0 ? 2e6 - m.daysLeft : m.daysLeft);
  return rank(a) - rank(b);
}
