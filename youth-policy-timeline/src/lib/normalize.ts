import type { Eligibility, Policy } from '../types.js';
import { EARN_CODES, JOB_CODES, SCHOOL_CODES, SIDO_CODES, ULSAN_SIGUNGU } from './codes.js';
import { extractDates } from './date.js';

/**
 * 원본 응답 필드명은 확정할 수 없으므로, "있을 법한 필드명 후보"를 순서대로 찾아
 * 첫 번째로 값이 있는 것을 쓴다.
 *  - 앞쪽 후보: 온통청년 신규 규격(getPlcy) 추정 필드명
 *  - 뒤쪽 후보: 구 규격(youthPlcyList.do) 추정 필드명, 일반적인 영문 필드명
 * 실제 응답을 확인한 뒤 후보 순서/이름을 이 파일에서만 고치면 된다.
 */
const FIELD_CANDIDATES = {
  id: ['plcyNo', 'bizId', 'polyBizId', 'id'],
  title: ['plcyNm', 'polyBizSjnm', 'title', 'name'],
  category: ['lclsfNm', 'polyRlmNm', 'plcyLclsfNm', 'bizTycdNm', 'category'],
  subCategory: ['mclsfNm', 'plcyMclsfNm', 'polyRlmCd', 'subCategory'],
  summary: ['plcyExplnCn', 'polyItcnCn', 'summary', 'description'],
  supportContent: ['plcySprtCn', 'sporCn', 'supportContent'],
  applyPeriod: ['aplyYmd', 'rqutPrdCn', 'applyPeriod'],
  applyStart: ['aplyBgngYmd', 'bizPrdBgngYmd', 'applyStart'],
  applyEnd: ['aplyEndYmd', 'bizPrdEndYmd', 'applyEnd'],
  ageMin: ['sprtTrgtMinAge', 'minAge', 'ageMin'],
  ageMax: ['sprtTrgtMaxAge', 'maxAge', 'ageMax'],
  ageLimitYn: ['sprtTrgtAgeLmtYn'],
  ageText: ['ageInfo', 'sprtTrgtAgeCn', 'ageText'],
  condition: ['addAplyQlfcCndCn', 'sprtTrgtCn', 'ptcpPrpTrgtCn', 'aditRscn', 'targetCondition'],
  applyUrl: ['aplyUrlAddr', 'rqutUrla', 'refUrlAddr1', 'rfcSiteUrla1', 'applyUrl', 'url'],
  zipCd: ['zipCd', 'zipCode', 'regionCode'],
  regionText: ['rgtrUpInstCdNm', 'rgtrInstCdNm', 'polyBizSecd', 'sprvsnInstCdNm', 'region', 'cnsgNmor'],
  jobCd: ['jobCd', 'jobCode'],
  jobText: ['empmSttsCn', 'jobCn', 'employment'],
  schoolCd: ['schoolCd', 'schoolCode'],
  schoolText: ['accrRqisCn', 'schoolCn', 'education'],
  earnCd: ['earnCndSeCd', 'earnCondCode'],
  earnMin: ['earnMinAmt', 'incomeMin'],
  earnMax: ['earnMaxAmt', 'incomeMax'],
  earnText: ['earnEtcCn', 'incomeNote'],
} as const;

type Raw = Record<string, unknown>;

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '-' && v.trim().toLowerCase() !== 'null';
  return true;
}

function pick(raw: Raw, keys: readonly string[]): unknown {
  for (const k of keys) {
    if (isPresent(raw[k])) return raw[k];
  }
  return undefined;
}

function pickStr(raw: Raw, keys: readonly string[]): string {
  const v = pick(raw, keys);
  return v === undefined ? '' : String(v).trim();
}

function pickNum(raw: Raw, keys: readonly string[]): number | null {
  const v = pick(raw, keys);
  if (v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && String(v).match(/\d/) ? n : null;
}

/** "0013001,0013003" 같은 코드 목록을 라벨 배열로 변환. 표에 없는 값은 원본 그대로 */
function codesToLabels(value: string, table: Record<string, string>): string[] {
  if (!value) return [];
  return value
    .split(/[,\s/|]+/)
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => table[c] ?? c);
}

/** 텍스트에서 라벨 후보를 찾아냄 (구 규격의 자유서술형 조건 대비) */
function textToLabels(text: string, labels: string[]): string[] {
  if (!text) return [];
  if (/제한\s*없음|무관|누구나/.test(text)) return ['제한없음'];
  const compact = text.replace(/\s/g, '');
  return labels.filter((l) => compact.includes(l.replace(/[\s()·]/g, '').slice(0, 3)));
}

function parseAgeText(text: string): { min: number | null; max: number | null } | null {
  if (!text) return null;
  if (/제한\s*없음/.test(text)) return null;
  const nums = (text.match(/\d{1,2}/g) ?? []).map(Number).filter((n) => n >= 10 && n <= 70);
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  if (nums.length === 1) {
    if (/이하|까지/.test(text)) return { min: null, max: nums[0] };
    if (/이상|부터/.test(text)) return { min: nums[0], max: null };
  }
  return null;
}

function regionLabel(zipCodes: string[], regionText: string): string {
  if (zipCodes.length === 0) return regionText || '정보 없음';
  const sidos = Array.from(new Set(zipCodes.map((c) => SIDO_CODES[c.slice(0, 2)] ?? c.slice(0, 2))));
  if (sidos.length >= 10) return '전국';
  if (sidos.length === 1 && sidos[0] === '울산') {
    const names = ULSAN_SIGUNGU.filter((s) => zipCodes.includes(s.code)).map((s) => s.name);
    if (names.length === ULSAN_SIGUNGU.length) return '울산 전체';
    return `울산 ${names.join('·')}`;
  }
  return sidos.join('·');
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^www\./i.test(url)) return `https://${url}`;
  return '';
}

export function normalizePolicy(raw: Raw, index = 0): Policy {
  const F = FIELD_CANDIDATES;

  // 신청기간: 시작/종료 필드가 따로 있으면 우선, 없으면 기간 문자열에서 날짜 추출
  const periodText = pickStr(raw, F.applyPeriod);
  const periodDates = extractDates(periodText);
  const startDates = extractDates(pickStr(raw, F.applyStart));
  const endDates = extractDates(pickStr(raw, F.applyEnd));
  const applyStart = startDates[0] ?? periodDates[0] ?? null;
  const applyEnd = endDates[0] ?? (periodDates.length >= 2 ? periodDates[periodDates.length - 1] : null);

  // 연령
  const ageLimitYn = pickStr(raw, F.ageLimitYn).toUpperCase();
  const ageMin = pickNum(raw, F.ageMin);
  const ageMax = pickNum(raw, F.ageMax);
  let targetAge: Policy['targetAge'] = null;
  if (ageLimitYn === 'N') {
    targetAge = null; // 연령 제한 없음
  } else if ((ageMin !== null && ageMin > 0) || (ageMax !== null && ageMax > 0)) {
    targetAge = { min: ageMin && ageMin > 0 ? ageMin : null, max: ageMax && ageMax > 0 ? ageMax : null };
  } else {
    targetAge = parseAgeText(pickStr(raw, F.ageText));
  }

  // 지역
  const zipCodes = pickStr(raw, F.zipCd)
    .split(/[,\s]+/)
    .map((c) => c.trim())
    .filter((c) => /^\d{5}$/.test(c));
  const regionText = pickStr(raw, F.regionText);

  // 취업상태 / 학력
  const jobCd = pickStr(raw, F.jobCd);
  const employment = jobCd
    ? codesToLabels(jobCd, JOB_CODES)
    : textToLabels(pickStr(raw, F.jobText), Object.values(JOB_CODES));
  const schoolCd = pickStr(raw, F.schoolCd);
  const education = schoolCd
    ? codesToLabels(schoolCd, SCHOOL_CODES)
    : textToLabels(pickStr(raw, F.schoolText), Object.values(SCHOOL_CODES));

  // 소득
  const earnCd = pickStr(raw, F.earnCd);
  const earnText = pickStr(raw, F.earnText);
  let incomeType = (EARN_CODES[earnCd] ?? (earnCd ? 'other' : 'unknown')) as Eligibility['incomeType'];
  if (incomeType === 'unknown' && earnText) incomeType = /무관|제한\s*없음/.test(earnText) ? 'none' : 'other';
  const incomeMin = pickNum(raw, F.earnMin);
  const incomeMax = pickNum(raw, F.earnMax);

  const condition = pickStr(raw, F.condition);
  const id = pickStr(raw, F.id) || `policy-${index}`;

  return {
    id,
    title: pickStr(raw, F.title) || '(제목 없음)',
    category: pickStr(raw, F.category) || '기타',
    subCategory: pickStr(raw, F.subCategory),
    region: regionLabel(zipCodes, regionText),
    summary: pickStr(raw, F.summary),
    supportContent: pickStr(raw, F.supportContent),
    applyStart,
    applyEnd,
    targetAge,
    targetCondition: [condition, periodText && !applyEnd ? `신청기간: ${periodText}` : '']
      .filter(Boolean)
      .join('\n'),
    applyUrl: normalizeUrl(pickStr(raw, F.applyUrl)),
    eligibility: {
      zipCodes,
      regionText,
      employment,
      education,
      incomeType,
      incomeMin: incomeMin && incomeMin > 0 ? incomeMin : null,
      incomeMax: incomeMax && incomeMax > 0 ? incomeMax : null,
      incomeNote: earnText,
    },
    raw,
  };
}

/** 응답 JSON에서 정책 배열 후보를 찾는다 (A·B 규격 모두 대비) */
export function findPolicyArray(data: unknown): Raw[] | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, any>;
  const candidates: unknown[] = [
    d.result?.youthPolicyList,
    d.youthPolicyList,
    d.youthPolicyList?.youthPolicy,
    d.result?.youthPolicy,
    d.youthPolicy,
    d.data?.youthPolicyList,
    d.items,
    d.data,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Raw[];
    if (c && typeof c === 'object' && !Array.isArray(c) && (c as Raw).plcyNm) return [c as Raw];
  }
  return null;
}

export function findTotalCount(data: unknown, fallback: number): number {
  const d = (data ?? {}) as Record<string, any>;
  const v =
    d.result?.pagging?.totCount ??
    d.result?.paging?.totCount ??
    d.pagging?.totCount ??
    d.totalCnt ??
    d.youthPolicyList?.totalCnt ??
    d.totCount;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
