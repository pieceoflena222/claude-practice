import type { FormEvent } from 'react';
import { EDUCATION_OPTIONS, EMPLOYMENT_OPTIONS, SIDO_CODES, ULSAN_SIGUNGU } from '../lib/codes';
import type { Profile } from '../lib/match';

interface Props {
  value: Profile;
  onChange: (p: Profile) => void;
  onSubmit: () => void;
  onReset: () => void;
  loading: boolean;
}

// 강원(42/51)·전북(45/52)은 신·구 코드가 공존하므로 선택지는 이름 기준으로 하나만 노출
const SIDO_OPTIONS = Object.entries(SIDO_CODES).filter(
  ([code, name], i, arr) => arr.findIndex(([, n]) => n === name) === i && code,
);

export default function ConditionForm({ value, onChange, onSubmit, onReset, loading }: Props) {
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => onChange({ ...value, [k]: v });
  const ageInvalid = !Number.isFinite(value.age) || value.age < 15 || value.age > 45;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!ageInvalid) onSubmit();
  };

  return (
    <form className="panel form" onSubmit={submit} aria-label="조건 입력">
      <h2 className="panel-title">내 조건 입력</h2>

      <div className="field">
        <label htmlFor="age">나이 (만 나이)</label>
        <div className="input-suffix">
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={15}
            max={45}
            value={Number.isFinite(value.age) ? value.age : ''}
            onChange={(e) => set('age', e.target.value === '' ? NaN : Number(e.target.value))}
            aria-invalid={ageInvalid}
            required
          />
          <span>세</span>
        </div>
        {ageInvalid && <p className="field-error">15~45 사이의 만 나이를 입력하세요.</p>}
      </div>

      <div className="field">
        <label htmlFor="sido">거주지</label>
        <div className="row-2">
          <select
            id="sido"
            value={value.sido}
            onChange={(e) => onChange({ ...value, sido: e.target.value, sigungu: '' })}
          >
            {SIDO_OPTIONS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          {value.sido === '31' && (
            <select aria-label="구·군" value={value.sigungu} onChange={(e) => set('sigungu', e.target.value)}>
              <option value="">구·군 전체</option>
              {ULSAN_SIGUNGU.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="employment">취업상태</label>
        <select id="employment" value={value.employment} onChange={(e) => set('employment', e.target.value)}>
          {EMPLOYMENT_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="education">학력</label>
        <select id="education" value={value.education} onChange={(e) => set('education', e.target.value)}>
          {EDUCATION_OPTIONS.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="income">연소득 (본인 기준, 선택)</label>
        <div className="input-suffix">
          <input
            id="income"
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            placeholder="모르면 비워두기"
            value={value.income ?? ''}
            onChange={(e) => set('income', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
          />
          <span>만원</span>
        </div>
        <p className="hint">비워두면 소득 조건은 "확인 필요"로 표시됩니다.</p>
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={loading || ageInvalid}>
          {loading ? '판정 중…' : '내 정책 판정하기'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          초기화
        </button>
      </div>
      <p className="hint">입력값은 이 브라우저에만 저장됩니다(로그인·서버 저장 없음).</p>
    </form>
  );
}
