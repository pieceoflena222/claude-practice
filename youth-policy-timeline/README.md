# 내 정책 타임라인

울산에 사는 20~30대 취업준비생·사회초년생을 위한 청년정책 판정기입니다.
나이·거주지·취업상태·학력·소득을 입력하면 해당되는 정책만 골라 **신청 마감 D-day**와 함께 보여주고,
**나이 타임라인(만 19~39세)** 위에 지원 연령 구간을 배치해 "몇 살 전에 꼭 신청해야 하는지"를 보여줍니다.

- 데이터: 온통청년(youthcenter.go.kr) 청년정책 오픈API
- 기술: Vite + React + TypeScript, 순수 CSS, Vercel 서버리스 함수(`/api/policies.ts`)

## 폴더 구조

```
youth-policy-timeline/
├─ api/policies.ts               Vercel 서버리스 함수 (온통청년 API는 여기서만 호출)
├─ src/
│  ├─ App.tsx                    화면 조립 (로딩/빈 결과/오류 상태 포함)
│  ├─ components/                조건 입력 폼, 정책 카드, 상세, 나이 타임라인
│  ├─ lib/normalize.ts           normalizePolicy: 응답 필드명 후보를 순서대로 찾아 Policy로 변환
│  ├─ lib/match.ts               5개 조건 판정 로직
│  ├─ lib/api.ts                 /api/policies 호출 + 샘플 폴백
│  ├─ lib/codes.ts               코드표(취업상태·학력·소득·지역)
│  └─ data/sample-policies.json  샘플 정책 20건 (가상 데이터)
├─ .env.example                  YOUTH_API_KEY= (이름만)
└─ .env.local                    실제 키 (Git에 올라가지 않음)
```

## 1. 로컬 실행

```bash
cd youth-policy-timeline
npm install
npm run dev        # http://localhost:5173
```

- `npm run dev`(Vite)는 `/api` 서버 함수를 실행하지 않으므로 **항상 샘플 데이터 + 안내 배너**로 표시됩니다.
- 로컬에서 실제 API까지 확인하려면 Vercel CLI를 사용합니다.
  ```bash
  npm i -g vercel
  vercel dev        # .env.local 의 YOUTH_API_KEY 를 읽어 /api 함수까지 실행
  ```
- 상태 화면 확인용 주소: `?demo=loading`, `?demo=empty`, `?demo=error`
- 빌드 확인: `npm run build`

## 2. Vercel에서 GitHub 저장소 Import

1. https://vercel.com 로그인 → **Add New… → Project**
2. 이 GitHub 저장소를 **Import**
3. **Root Directory** 를 `youth-policy-timeline` 으로 지정 (저장소 루트에는 다른 앱이 있습니다)
4. Framework Preset: **Vite** (자동 인식). Build Command `npm run build`, Output Directory `dist` 그대로 둡니다.

## 3. 환경변수 YOUTH_API_KEY 등록

1. Vercel 프로젝트 → **Settings → Environment Variables**
2. Name: `YOUTH_API_KEY`, Value: 온통청년에서 발급받은 인증키
3. Environment: Production / Preview / Development 모두 체크 → **Save**

> 키는 서버 함수에서 `process.env.YOUTH_API_KEY` 로만 읽습니다. 브라우저 코드에는 키가 포함되지 않습니다.
> `.env.local` 은 `.gitignore` 대상이라 GitHub에 올라가지 않으므로, 배포 환경에는 반드시 위 단계로 등록해야 합니다.

## 4. 재배포 방법

환경변수는 **등록 이후의 배포부터** 적용됩니다.

- Vercel → **Deployments** → 최신 배포의 `⋯` → **Redeploy**, 또는
- 저장소에 새 커밋을 push 하면 자동 재배포됩니다.

## 5. "샘플 데이터로 표시 중" 배너가 사라지지 않을 때 점검 항목

배너 끝의 `(사유: …)` 를 먼저 확인하세요.

| 사유 | 점검 |
| --- | --- |
| 서버 함수(/api)가 없는 미리보기 환경 | `npm run dev` 로 실행 중이거나, Vercel Root Directory가 잘못되어 `api/` 폴더가 배포되지 않음 |
| 서버에 YOUTH_API_KEY 환경변수가 없음 | 변수 이름 철자(대소문자), 적용 환경(Production) 체크, 등록 후 **재배포** 했는지 |
| `api-new:HTTP_xxx`, `api-legacy:HTTP_xxx` | 인증키 승인 상태·만료 여부 (온통청년 마이페이지), 호출 한도 |
| `NOT_JSON` | 키 오류 시 HTML/XML 오류 페이지가 올 수 있음. 구 규격은 XML만 줄 수 있음 |
| `NO_POLICY_ARRAY` | 응답 구조가 예상과 다름 → Vercel **Logs** 에서 `[api/policies] … 원본 1건` 로그 확인 후 `src/lib/normalize.ts` 의 `findPolicyArray` 후보 수정 |
| `TIMEOUT`, `NETWORK_ERROR` | 온통청년 서버 장애 또는 Vercel 리전에서 접근 차단 여부 |

추가로, 배너가 사라졌는데 카드 내용이 비어 보이면 응답 필드명이 다른 것입니다.
Vercel Logs의 원본 1건과 `src/lib/normalize.ts` 의 `FIELD_CANDIDATES` 를 대조해 후보 이름을 추가하세요.
정규화된 각 정책의 `raw` 객체에는 매핑되지 않은 원본 필드가 모두 보관됩니다.

## 판정 규칙 요약

- 각 조건을 **일치(✓) / 확인 필요(?) / 불일치(✕)** 로 표시하고, 불일치가 하나도 없는 정책만 카드로 보여줍니다.
- 응답에 조건 정보가 없거나 "기타" 소득 기준처럼 자동 판정이 어려우면 "확인 필요"로 둡니다.
- 나이 타임라인은 **나이 외 조건이 불일치하지 않는 정책**을 보여주며, 연령 상한까지 1년 이하로 남은 정책을 "곧 자격 종료"로 강조합니다.
- 판정은 참고용입니다. 최종 자격과 일정은 각 정책 공고문을 확인하세요.
