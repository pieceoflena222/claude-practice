import type { Profile } from './match';

const KEY = 'my-policy-timeline.profile.v1';

/** 로그인 없이 브라우저 localStorage에만 저장. 차단된 환경에서도 앱이 동작하도록 모두 try/catch */
export function loadProfile(): Profile | null {
  try {
    const s = window.localStorage.getItem(KEY);
    if (!s) return null;
    const p = JSON.parse(s) as Partial<Profile>;
    if (typeof p.age !== 'number' || typeof p.sido !== 'string') return null;
    return {
      age: p.age,
      sido: p.sido,
      sigungu: typeof p.sigungu === 'string' ? p.sigungu : '',
      employment: typeof p.employment === 'string' ? p.employment : '미취업자',
      education: typeof p.education === 'string' ? p.education : '대학 졸업',
      income: typeof p.income === 'number' ? p.income : null,
    };
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* 저장 불가 환경은 무시 */
  }
}

export function clearProfile(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
