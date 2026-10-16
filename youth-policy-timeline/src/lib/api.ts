import sample from '../data/sample-policies.json';
import type { DataSource, PoliciesResponse, Policy } from '../types';
import { findPolicyArray, normalizePolicy } from './normalize.js';

export const TOTAL_SEARCH_URL = 'https://www.youthcenter.go.kr/youthPolicy/ythPlcyTotalSearch';

export interface LoadParams {
  page?: number;
  size?: number;
  keyword?: string;
  category?: string;
  /** 법정 시군구 코드 5자리 */
  region?: string;
}

export interface LoadResult {
  items: Policy[];
  source: DataSource;
  totalCount: number;
  /** 샘플로 폴백한 사유 (화면 안내용) */
  fallbackReason?: string;
}

const REASON_TEXT: Record<string, string> = {
  NO_API_FUNCTION: '서버 함수(/api)가 없는 미리보기 환경',
  NO_KEY: '서버에 YOUTH_API_KEY 환경변수가 없음',
  NETWORK: '서버 함수 호출 실패',
  NOT_JSON: '응답이 JSON이 아님',
  SERVER_ERROR: '서버 함수 내부 오류',
};

export function describeReason(reason?: string): string {
  if (!reason) return '';
  return reason
    .split(',')
    .map((r) => r.trim())
    .map((r) => REASON_TEXT[r] ?? r)
    .join(', ');
}

export function loadSample(): Policy[] {
  const list = findPolicyArray(sample) ?? [];
  return list.map((item, i) => normalizePolicy(item, i));
}

/**
 * 화면 → /api/policies 호출. 실패하거나 서버가 폴백을 알리면 번들된 샘플 데이터를 쓴다.
 * 온통청년 API는 브라우저에서 직접 호출하지 않는다.
 */
export async function loadPolicies(params: LoadParams, signal?: AbortSignal): Promise<LoadResult> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 1));
  qs.set('size', String(params.size ?? 100));
  if (params.keyword) qs.set('keyword', params.keyword);
  if (params.category) qs.set('category', params.category);
  if (params.region) qs.set('region', params.region);

  let reason = '';
  try {
    const res = await fetch(`/api/policies?${qs.toString()}`, { signal, headers: { Accept: 'application/json' } });
    const ct = res.headers.get('content-type') ?? '';
    if (res.ok && ct.includes('json')) {
      const body = (await res.json()) as Partial<PoliciesResponse>;
      if (!body.fallback && Array.isArray(body.items) && body.source && body.source !== 'sample') {
        return { items: body.items, source: body.source, totalCount: body.totalCount ?? body.items.length };
      }
      reason = body.reason || 'SERVER_FALLBACK';
    } else {
      // Vite 개발 서버 등에서는 /api 요청에 index.html(200) 또는 404가 돌아온다
      reason = res.ok || res.status === 404 ? 'NO_API_FUNCTION' : `HTTP_${res.status}`;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw e;
    reason = 'NETWORK';
  }

  const items = loadSample();
  return { items, source: 'sample', totalCount: items.length, fallbackReason: reason };
}
