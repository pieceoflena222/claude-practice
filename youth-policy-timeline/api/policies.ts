/**
 * Vercel 서버리스 함수: GET /api/policies
 *
 * 쿼리: page(기본 1), size(기본 20, 최대 100), keyword, category, region(법정 시군구 코드 5자리)
 *
 * 순서: A(신규 규격 getPlcy) → B(구 규격 youthPlcyList.do) → C(샘플 폴백 신호)
 *  - 어떤 경우에도 예외를 던지지 않고 200 + JSON을 돌려준다.
 *  - C의 경우 { fallback: true } 를 돌려주면 화면이 번들된 샘플 데이터를 사용한다.
 *  - API 키는 process.env.YOUTH_API_KEY 로만 읽고, 로그·응답·에러 메시지에 절대 넣지 않는다.
 */
import { findPolicyArray, findTotalCount, normalizePolicy } from '../src/lib/normalize.js';
import type { DataSource, PoliciesResponse } from '../src/types.js';

interface Req {
  query?: Record<string, string | string[] | undefined>;
}
interface Res {
  status(code: number): Res;
  setHeader(name: string, value: string): void;
  json(body: unknown): void;
}

const TIMEOUT_MS = 8000;

function q(req: Req, name: string): string {
  const v = req.query?.[name];
  return (Array.isArray(v) ? v[0] : v ?? '').toString().trim();
}

type Attempt =
  | { ok: true; data: unknown; list: Record<string, unknown>[] }
  | { ok: false; reason: string };

async function fetchJson(url: string): Promise<Attempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, reason: `HTTP_${res.status}` };
    const text = await res.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'NOT_JSON' };
    }
    const list = findPolicyArray(data);
    if (!list) return { ok: false, reason: 'NO_POLICY_ARRAY' };
    return { ok: true, data, list };
  } catch (e) {
    return { ok: false, reason: (e as Error)?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}

function buildUrlA(key: string, p: Params): string {
  const u = new URL('https://www.youthcenter.go.kr/go/ythip/getPlcy');
  u.searchParams.set('apiKeyNm', key);
  u.searchParams.set('pageNum', String(p.page));
  u.searchParams.set('pageSize', String(p.size));
  u.searchParams.set('rtnType', 'json');
  if (p.keyword) u.searchParams.set('plcyNm', p.keyword);
  if (p.category) u.searchParams.set('lclsfNm', p.category);
  if (p.region) u.searchParams.set('zipCd', p.region);
  return u.toString();
}

function buildUrlB(key: string, p: Params): string {
  const u = new URL('https://www.youthcenter.go.kr/opi/youthPlcyList.do');
  u.searchParams.set('openApiVlak', key);
  u.searchParams.set('pageIndex', String(p.page));
  u.searchParams.set('display', String(p.size));
  if (p.keyword) u.searchParams.set('query', p.keyword);
  // 구 규격의 분야코드(bizTycdSel)·지역코드(srchPolyBizSecd)는 신규 규격과 코드 체계가 달라
  // 잘못된 필터가 걸리지 않도록 전달하지 않는다. (분류·지역 필터는 화면에서 다시 적용)
  return u.toString();
}

interface Params {
  page: number;
  size: number;
  keyword: string;
  category: string;
  region: string;
}

/** 원본 1건을 로그로 남긴다. 키가 섞여 있을 가능성에 대비해 키 값을 마스킹한다. */
function logSample(label: string, item: unknown, key: string) {
  try {
    let s = JSON.stringify(item);
    if (key) s = s.split(key).join('***');
    console.log(`[api/policies] ${label} 원본 1건:`, s.slice(0, 4000));
  } catch {
    /* 로그 실패는 무시 */
  }
}

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');

  const params: Params = {
    page: Math.max(1, Number(q(req, 'page')) || 1),
    size: Math.min(100, Math.max(1, Number(q(req, 'size')) || 20)),
    keyword: q(req, 'keyword').slice(0, 50),
    category: q(req, 'category').slice(0, 20),
    region: /^\d{5}$/.test(q(req, 'region')) ? q(req, 'region') : '',
  };

  const fallback = (reason: string) => {
    const body: PoliciesResponse = { source: 'sample', fallback: true, reason, totalCount: 0, items: [] };
    res.status(200).json(body);
  };

  try {
    const key = process.env.YOUTH_API_KEY ?? '';
    if (!key) {
      console.warn('[api/policies] YOUTH_API_KEY 환경변수가 없어 샘플 데이터로 폴백합니다.');
      return fallback('NO_KEY');
    }

    const attempts: { source: DataSource; url: string }[] = [
      { source: 'api-new', url: buildUrlA(key, params) },
      { source: 'api-legacy', url: buildUrlB(key, params) },
    ];
    const reasons: string[] = [];

    for (const a of attempts) {
      const r = await fetchJson(a.url);
      if (!r.ok) {
        reasons.push(`${a.source}:${r.reason}`);
        console.warn(`[api/policies] ${a.source} 실패: ${r.reason}`);
        continue;
      }
      if (r.list.length > 0) logSample(a.source, r.list[0], key);
      const body: PoliciesResponse = {
        source: a.source,
        fallback: false,
        totalCount: findTotalCount(r.data, r.list.length),
        items: r.list.map((item, i) => normalizePolicy(item, i)),
      };
      return res.status(200).json(body);
    }

    return fallback(reasons.join(', '));
  } catch {
    // 정규화 중 예기치 못한 오류 등 — 예외를 던지지 않고 폴백
    return fallback('SERVER_ERROR');
  }
}
