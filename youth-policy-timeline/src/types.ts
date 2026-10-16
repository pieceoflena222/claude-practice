/** 모든 화면이 공통으로 사용하는 정책 모델 */
export interface Policy {
  id: string;
  title: string;
  /** 대분류 (일자리/주거/교육/복지문화/참여권리 등) */
  category: string;
  subCategory: string;
  /** 표시용 지역 문자열 (예: "울산 남구", "전국") */
  region: string;
  summary: string;
  supportContent: string;
  /** YYYY-MM-DD 또는 null */
  applyStart: string | null;
  /** YYYY-MM-DD 또는 null(상시·미정) */
  applyEnd: string | null;
  targetAge: { min: number | null; max: number | null } | null;
  targetCondition: string;
  applyUrl: string;
  /**
   * 판정용 보조 정보(확장 필드). normalizePolicy가 원본에서 추출한다.
   * 값이 비어 있으면 "조건 없음 또는 정보 없음"으로 취급한다.
   */
  eligibility: Eligibility;
  /** 원본 응답 1건 그대로 (매핑되지 않은 필드 포함) */
  raw: Record<string, unknown>;
}

export interface Eligibility {
  /** 법정 시군구 코드 목록(5자리). 비어 있으면 코드 정보 없음 */
  zipCodes: string[];
  /** 지역 텍스트 (코드가 없을 때 텍스트 매칭용) */
  regionText: string;
  /** 취업상태 라벨 목록 (예: "미취업자"). "제한없음" 포함 시 무관 */
  employment: string[];
  /** 학력 라벨 목록 (예: "대학 졸업"). "제한없음" 포함 시 무관 */
  education: string[];
  /** 소득 조건: none=무관, annual=연소득 범위, other=기타(텍스트), unknown=정보 없음 */
  incomeType: 'none' | 'annual' | 'other' | 'unknown';
  incomeMin: number | null;
  incomeMax: number | null;
  incomeNote: string;
}

export type DataSource = 'api-new' | 'api-legacy' | 'sample';

export interface PoliciesResponse {
  source: DataSource;
  fallback: boolean;
  /** 폴백 사유 (키 값은 절대 포함하지 않음) */
  reason?: string;
  totalCount: number;
  items: Policy[];
}
