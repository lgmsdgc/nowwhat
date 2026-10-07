# STEP 7 — EXP · Level · Achievement

## 구현과 파일 구조

- `app/profile/page.tsx`, `features/profile/`: 모바일 플레이어 카드, EXP 진행도,
  칭호 컬렉션 9개, 최근·좋아한·아쉬운 미션, 완료에서 얻은 칭호 표시.
- `lib/progression/experience.ts`: 난이도 보상 정책과 레벨·누적 EXP.
- `services/progressionService.ts`, `profileService.ts`: 칭호 조건·최초 획득 세션·통계·기록 필터.
- `seed/achievements.ts`, `lib/validation/progression.ts`, `types/progression.ts`: 검수된 규칙과 타입.
- `app/api/profile/route.ts`, `profileClientService.ts`: Auth 검증 + 사용자 RLS 조회,
  응답 검증·no-store·타임아웃·오류 재시도·소유자 변경 시 이전 응답 취소.
- `supabase/migrations/202610070002_progression.sql`: 칭호 조건 제약, 완료 트리거,
  프로필 잠금과 원자적 지급, 최초 획득 세션 연결.
- `202610070003_progression_seed.sql`: 칭호 9개, 템플릿 보상 업데이트, 과거 DB 완료 기록의 칭호 복원.

## 보상과 이력 정책

| 난이도 | 새 템플릿 기본 EXP |
| ------ | ------------------ |
| 1      | 100                |
| 2      | 120                |
| 3      | 140                |
| 4      | 160                |
| 5      | 180                |

명시적인 `baseExp`는 검수한 템플릿별 보상으로 우선한다.
추천 시 저장한 스냅샷의 보상을 완료 시 지급하며, 과거 100 EXP 기록을 새 정책으로 재계산하지 않는다.
레벨은 `floor(EXP / 300) + 1`. 포기·거절에는 EXP와 칭호를 지급하지 않는다.
완료 재요청은 같은 결과를 반환하며 사용자별 칭호 PK가 중복 지급을 막는다.

로컬 모드는 기존 `nowwhat:state:v1` 문서를 그대로 유지하고 완료 기록에서 칭호를 복원한다.
완료 시각·세션 ID 순으로 정렬하여 최초 임계값을 넘긴 완료 시각과 세션을 기록한다.
DB 모드는 계산된 진행도와 실제 지급을 구분하여 서버에 저장된 획득 기록만 표시한다.
계정 이관은 합쳐진 DB 완료 이력으로 새로운 조건도 검사한다.
사용자가 바꿀 수 있는 로컬 보관 기록에는 DB EXP·칭호를 지급하지 않는다.

좋아한·아쉬운 미션 목록은 완료 후 명시적 👍/👎만 사용한다.
평가 미입력·별점만 입력·추천 거절은 이 목록에서 중립으로 남는다.
이는 별점을 보조 신호로 쓰는 추천 엔진의 카테고리 선호와 목적이 다르다.

## 칭호 확장

지원하는 `condition_type`: `completed_count`, `distinct_categories`.
`condition_value`: `{ "target": 3, "filter": { "category": "food" } }` 형식이다.
필터는 category, relationship, outdoor, zeroCost를 조합한다.
zeroCost는 실제 기록된 금액 0만 인정하며 미입력과 예산 0을 대신 사용하지 않는다.

같은 조건 유형의 새 칭호는 검수 후 DB 정의 추가만으로 지급·조회·표시할 수 있다.
로컬에서도 제공하려면 `seed/achievements.ts`에 추가한다.
새 유형은 SQL·TypeScript 판정과 검증을 함께 확장하고 일치 테스트를 추가한다.
한번 배포한 칭호의 ID·조건은 의미를 유지하고 변경된 도전에는 새 ID를 부여한다.
획득 기록을 직접 사용자 요청으로 수정하는 API는 없다.

## 자동 검증

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run format:check
```

136개: 단위 105 + 실제 PostgreSQL 통합 31.
보상 스냅샷 유지·레벨 경계·중복 완료·칭호 최초 획득·비용 미입력·v1 복원·선호 필터를 검증한다.
실제 PostgreSQL에서 RLS·직접 지급 금지·TS/SQL 판정 일치·새 DB 규칙·이관 후 임계값·backfill을 확인한다.
칭호 저장 실패를 주입하면 완료·피드백·EXP도 모두 롤백되며 재시도할 수 있다.
미션 추천 후 DB 보상 변경이 있어도 추천 당시 보상만 지급되는 것을 확인한다.

## 수동 확인

`npm run dev` 후 `/profile`을 연다. 완료 기록이 없으면 LV.1·0 EXP·0/9 칭호와 첫 미션 안내를 보여준다.
첫 미션을 완료하고 칭호 표시를 확인한 뒤 프로필에서 레벨·최근 기록을 확인한다.
👍/👎를 고르면 해당 필터에 나타난다. 새로고침해도 보상·칭호는 중복되지 않는다.
기존 완료 기록에서도 통계와 칭호가 복원되어야 한다.
390px 모바일에서 가로 넘침·버튼·긴 칭호 이름·빈 목록을 확인한다.

2026-10-07 production 서버 3001에서 실제 인앱 브라우저로 확인했다.
390px 모바일의 문서 폭과 scrollWidth가 모두 375px로 같아 가로 넘침이 없었다.
기존 완료 3회·300 EXP·LV.2·칭호 2개가 복원되었고 좋아요 2개와 싫어요 빈 목록을 확인했다.
별도 origin의 새 사용자는 0 EXP·LV.1·0/9에서 시작해 온보딩 → 추천 → PLAY → 완료를 수행했다.
첫 완료에서 100 EXP와 첫 칭호를 받고, 싫어요·코멘트가 프로필에 나타났으며
새로고침 후에도 완료 1회·100 EXP·칭호 1개로 유지됐다. 경고·오류 콘솔 로그는 없었다.
테스트용 기록은 사용자 origin 3000과 분리했다.
캡처는 `artifacts/step-7-profile-mobile.png`, `artifacts/step-7-complete-mobile.png`에 저장했다.

원격 Supabase 프로젝트가 없어 실제 Auth/PostgREST 연결은 미검증이다.
로컬 모드는 실제 브라우저에서, SQL은 PGlite PostgreSQL에서 확인한다.
다음 단계는 STEP 8의 분석 이벤트와 전환 지표다.
