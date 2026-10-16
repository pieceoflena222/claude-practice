const pad = (n: number) => String(n).padStart(2, '0');

function toIso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 문자열에서 날짜를 모두 찾아 YYYY-MM-DD 배열로 반환 (20250101, 2025-01-01, 2025.1.1 등) */
export function extractDates(text: unknown): string[] {
  if (typeof text !== 'string' && typeof text !== 'number') return [];
  const s = String(text);
  const out: string[] = [];
  const re = /(20\d{2})\s*[.\-/년]?\s*(\d{1,2})\s*[.\-/월]?\s*(\d{1,2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const iso = toIso(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.push(iso);
  }
  return out;
}

export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 오늘 기준 남은 일수 (마감일 당일 = 0). applyEnd가 없으면 null */
export function daysUntil(applyEnd: string | null, now = new Date()): number | null {
  if (!applyEnd) return null;
  const [y, m, d] = applyEnd.split('-').map(Number);
  const end = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end - today) / 86400000);
}

export function formatDday(days: number | null): string {
  if (days === null) return '상시·미정';
  if (days < 0) return '마감';
  if (days === 0) return 'D-DAY';
  return `D-${days}`;
}
