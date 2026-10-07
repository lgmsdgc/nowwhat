# NowWhat

생각하기 귀찮을 때, 뭐하지? 고르는 건 우리가 할게. 넌 하기만 해.

사용자의 상황에 맞는 행동 **하나**를 제안하는 모바일 중심 웹 서비스입니다.
현재는 **STEP 8: 분석 이벤트·전환 지표·완료 후 공유**까지 구현했습니다.
기본 로컬 모드에서는 Supabase나 LLM 키 없이 실제 핵심 흐름을 사용할 수 있습니다.
Supabase 프로젝트가 아직 없어 원격 연결은 검증하지 않았으며, 로컬 PostgreSQL로 SQL·권한·트랜잭션을 검증했습니다.

## 실행

Node.js 24.x, npm 11을 사용합니다. `.nvmrc`에 Node 버전을 지정했습니다.

```sh
npm ci
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인합니다.
외부 서비스 가입이나 환경 변수 없이 실행됩니다.
나눔스퀘어 라운드 폰트를 `next/font/local`로 제공하므로 빌드·사용 중 외부 폰트 요청이 없습니다.
폰트 출처와 라이선스는 [app/fonts/README.md](app/fonts/README.md)에 기록했습니다.
로컬 저장 동시성 처리를 위해 Web Locks API를 지원하는 최신 브라우저와
HTTPS 또는 `localhost` / `127.0.0.1` 환경이 필요합니다.

프로덕션 실행:

```sh
npm run build
npm start
```

## 현재 구현 범위

- Next.js 16.3.8 / React 19 / TypeScript strict / Tailwind CSS 4 / lucide-react
- 로그인 없이 익명 ID 발급, 6단계 질문: 동행·시간·1인당 예산·이동·에너지·강도
- 검수한 seed 미션 60개에서 조건에 맞는 미션 하나 추천 (12개 카테고리)
- 시간·비용·활동량·이동 범위·동행·야간 안전 필터
- 미완료 우선, 카테고리 선호, 강도 근접도를 반영한 weighted random
- 최근 노출 5개 우선 제외, 소진 시 오래된 노출부터 허용 (현재 미션·안전 조건은 유지)
- 버튼 한 번으로 즉시 재추천, 추천 흐름별 재추천 횟수·거절 기록 (현재 횟수 제한 없음)
- `이거 한다`로 바로 PLAY 시작, 시작 시 안전 조건 재검사
- 체크리스트, 시작 시간, 경과 시간, 포기와 완료
- 선택적 실제 비용·재미 평가·재도전 의사·140자 코멘트, 작성 중 자동 저장
- 새 미션 난이도 1~5별 100/120/140/160/180 EXP, 300 EXP마다 레벨 상승
- 프로필의 완료 수·총 EXP·레벨 진행도, 최근·좋아한·아쉬운 미션 기록
- 데이터 기반 칭호 9개, 획득 시각·진행도, 완료 후 이번에 획득한 칭호 표시
- 새로고침 복원, 홈에서 진행 중 미션 이어하기
- 입력 검증, 저장 실패 안내, 손상 데이터 백업 후 새 기록 만들기
- 모바일 UI, 키보드 입력, 포커스 표시, 동작 줄이기 지원
- 간결한 추천 카드, 펼쳐보는 상세 안내·조건, 한 줄의 실행·재추천 버튼
- 완료 2회 이후 선택적인 기록 저장 안내, 내 기록 화면
- Google / 이메일 인증 링크·OTP, 익명 ID 유지 가입, 기존 계정 로그인
- 익명 DB 기록을 기존 계정에 원자적으로 이관, 재시도 중복 방지
- 로컬 완료 기록을 출처 표시와 함께 보관 (로컬 EXP는 서버 보상에 추가하지 않음)
- 방문·온보딩·추천·거절·수락·시작·완료·포기·공유 이벤트, 재전송 큐와 중복 방지
- 수락률·완료율·사용자별 재추천·D1 재방문·공유/복사율을 계산하는 비공개 API와 CLI
- 완료 미션 공유, 문구·홈 링크 복사 (개인 코멘트·비용·세션 주소 제외)

무제한 시간/예산은 `null`, 비용 미입력과 `0원`은 별도로 저장합니다.
수락과 시작은 같은 동작이며 `acceptedAt`과 `startedAt`을 모두 남깁니다.
체크리스트를 모두 확인하면 완료할 수 있고, 포기에는 EXP를 지급하지 않습니다.
`baseExp`는 검수한 템플릿의 난이도 정책으로 정하고 추천 시 스냅샷에 저장합니다.
과거 세션의 보상은 다시 계산하지 않습니다. 재시도·새로고침에도 EXP·칭호를 중복 지급하지 않습니다.

**이후 단계:** 배포 준비(STEP 9).
홈의 예시 미션은 소개용입니다. 추천은 온보딩 완료 후 별도 화면에서 하나씩 보여줍니다.
공개 출시 전까지 검색 색인은 비활성화되어 있습니다.

## 구조와 중요한 코드

```text
app/                       라우트, 전역 스타일, 메타데이터, 오류 처리
  onboarding/              6단계 질문
  mission/[sessionId]/     추천 결과
  play/[sessionId]/        체크리스트와 완료 입력
  complete/[sessionId]/    완료 결과와 EXP
  api/game/               Auth 검증, 개인 기록 읽기·명령 실행
  account/                선택적 가입·로그인·최근 기록·기기 기록 이관
  profile/                레벨·통계·칭호·기록 필터
  api/profile/            RLS로 읽는 칭호 카탈로그와 개인 획득 기록
  api/analytics/          인증된 이벤트 수집·본인 최근 분석 기록 조회
  auth/callback/          PKCE 인증 교환과 기록 연결
  api/account/            검증된 계정 조회·이관 증명·로컬 기록 보관
components/layout/         AppShell, Brand, LocalStateGate
components/ui/             공통 Button
components/analytics/      방문·페이지 이벤트 연결
features/landing/          홈, 진행 중 미션 이어하기
features/onboarding/       질문 UI, 선택 상태, 생성 연출
features/mission/          단일 미션 카드, 수락·거절
features/gameplay/         세션 안내, PLAY, 완료 입력·결과
features/profile/          프로필·EXP 진행도·칭호 컬렉션·기록 UI
features/account/          가입·이관 UI, 완료 후 저장 안내
services/                  gameplayService, recommendationService, missionService, serverGameService, accountService, localImportService
lib/repositories/          LocalRepository, RemoteRepository
lib/storage/               브라우저 스토어, Web Locks, 탭 간 동기화
lib/analytics/             방문 식별·최대 300개 전송 큐·전송 어댑터
lib/validation/            Zod 입력·저장 문서 검증
lib/progression/           EXP 합산, 레벨·난이도 보상 정책
lib/recommendation/        추천 정책 상수, 카테고리 선호 집계
lib/utils/                 금액·시간 포맷, 공통 유틸리티
lib/supabase/              브라우저 익명 Auth, 서버 전용 DB 어댑터
lib/config/                명시적인 local/supabase 저장 모드
lib/http/                  크기 제한·요청 검증·비공개 API 응답
types/                     도메인·온보딩·DB 타입
data/                      질문 선택지와 답변 표시
seed/missions.ts           60개 검수 템플릿 집계, 기존 16개 ID 유지
seed/*Missions.ts          동행별 11개씩 추가한 템플릿
seed/missionFactory.ts     템플릿 검증·기본값, 공통 수행 조건
seed/achievements.ts       로컬과 DB 시드에서 공유하는 칭호 9개
supabase/migrations/       스키마·RLS·원자적 저장 RPC·60개 시드
scripts/                   TypeScript seed → SQL 생성, 분석 JSON 집계
tests/unit/                상태 전환·안전·저장소 테스트
tests/integration/         실제 PostgreSQL에서 SQL·RLS·트랜잭션 테스트
docs/                      설계와 검증 기록
```

- `page.tsx`는 화면 조합만 맡습니다. 브라우저 상호작용은 `features/`에 있습니다.
- `gameplayService.transition()`은 순수 함수로 상태 전환을 계산합니다.
  저장소와 UI를 알지 않으며 시간·랜덤·ID를 주입받아 검증할 수 있습니다.
- `recommendationService`는 수행 가능성 검사 → 최근 노출 제외 → 가중치 계산 → 누적 확률 추첨을 담당합니다.
  `buildRecommendationPool`은 후보·가중치 요소·노출 제외 완화 여부를 반환해 UI 없이 검증할 수 있습니다.
- `lib/recommendation/policy.ts`에서 미완료 1.8 / 완료 1.0, 카테고리 0.6~1.4,
  강도 1.0~1.5와 최근 노출·선호 기록 범위를 관리합니다.
- 선호는 최근 완료 40회의 완료 세션별 최신 좋아요/싫어요를 한 번만 반영합니다.
  명시적 선택이 없으면 재미 4~5점은 긍정, 1~2점은 부정, 3점·미입력은 중립입니다.
  거절 이유를 카테고리 싫어요로 간주하지 않습니다.
- `LocalRepository`는 명령마다 최신 기록을 읽고 전체 문서를 한 번에 저장합니다.
  완료 결과·EXP 근거·피드백을 함께 저장하며 같은 완료 요청은 보상을 반복하지 않습니다.
- `browserStore`는 Web Locks로 여러 탭의 쓰기를 순서대로 처리하고
  `storage` 이벤트로 다른 탭의 화면을 갱신합니다. 저장 성공 후에만 UI 상태를 공개합니다.
- DB 모드는 브라우저에서 명령만 `/api/game`으로 보내고, 서버가 Auth `getUser`로 소유권을 확인합니다.
  서버의 시간·DB 템플릿·기록으로 전환을 계산한 뒤 서버 전용 RPC에서 세션·피드백·EXP를 함께 저장합니다.
  프로필 revision 충돌 시 최신 상태를 다시 읽고 최대 3번 시도합니다.
- DB 오류를 로컬 저장 성공으로 바꾸지 않습니다. 모드 전환도 기존 로컬 기록을 덮어쓰거나 자동 이관하지 않습니다.
- 새 가입은 익명 ID에 identity를 연결합니다. 기존 계정 로그인은 익명 소유권으로 발급한 일회용 증명과
  로그인 후 검증된 회원 ID로 이관합니다. SQL 트랜잭션이 세션·피드백·보상을 합치고 재시도에는 중복 지급하지 않습니다.
- 로컬 완료 기록은 `local_mission_history`에 비용·평가·코멘트와 함께 보관합니다.
  사용자 수정이 가능한 로컬 EXP를 신뢰하지 않으며, 원본 localStorage는 유지합니다.
- `progressionService`는 완료 기록에서 칭호 조건·진행도·최초 획득 시각을 판정합니다.
  로컬의 기존 v1 기록을 변경 없이 복원하고, DB 모드에서는 서버에 저장된 획득 기록만 표시합니다.
- DB의 완료 트리거는 칭호 지급을 세션·피드백·EXP와 같은 트랜잭션으로 처리합니다.
  계정 이관 때도 합쳐진 기록으로 조건을 재검사하며 로컬 보관 기록에는 보상을 지급하지 않습니다.
- `profileService`는 최근 기록과 명시적인 좋아요·싫어요를 집계합니다.
  미입력 평가는 중립으로 남고 추천 거절은 싫어한 미션 목록에 포함하지 않습니다.
- 미션 내용과 입력은 세션에 스냅샷으로 남겨 이후 템플릿 변경과 분리합니다.
- 타입과 런타임 검증은 `types/`, `lib/validation/models.ts`에서 관리합니다.
- `analyticsService`는 상태 변경 사실에서 이벤트를 만들고, `analyticsClientService`는 방문·공유 전송을 맡습니다.
  DB의 미션 전환 이벤트는 서버 트리거가 기록하며 클라이언트에서 임의로 제출할 수 없습니다.
- `analyticsReportService`는 중복 제거 후 세션 단위 전환과 현지 날짜 기준 D1을 집계합니다.
  공유 시도·네이티브 공유 성공·클립보드 복사를 나누고 복사를 외부 전달 완료로 간주하지 않습니다.
- 분석은 best effort입니다. 오류·큐 한도·로컬 저장 부족으로 이벤트가 누락될 수 있으며 플레이 기록을 우선합니다.
  식별·저장 한도·집계 기준은 [분석 안내](docs/analytics-setup.md)를 확인하세요.

자세한 계획은 [설계 문서](docs/architecture.md),
최근 화면 정리는 [UI 간결화](docs/ui-refinement.md),
검증 항목은 [STEP 3](docs/step-3-validation.md), [STEP 4](docs/step-4-validation.md), [STEP 5](docs/step-5-validation.md), [STEP 6](docs/step-6-validation.md), [STEP 7](docs/step-7-validation.md), [STEP 8](docs/step-8-validation.md)을 확인하세요.

## 검증

```sh
npm test                  # 단위 134개 + PostgreSQL 통합 43개 = 177개
npm run test:db           # 로컬 PostgreSQL 통합 테스트만 실행 (Docker 불필요)
npm run db:seed:generate  # seed/*.ts 변경 후 SQL 재생성
npm run db:progression:generate # 칭호·템플릿 보상 SQL 재생성
npm run analytics:report -- records.json # 분석 기록 JSON에서 지표 출력
npm run test:watch
npm run check             # 포맷 → ESLint → 타입 → 테스트 → production build
npm run format            # 포맷 적용
```

브라우저 확인:

1. 홈에서 시작하고 6개 질문에 답합니다. `혼자 / 15분 / 0원 / 집에서만 / 아무것도 하기 싫음`으로도 미션이 나옵니다.
2. 질문 중 새로고침해서 답과 현재 단계가 복원되는지 확인합니다.
3. 미션 화면에서 `한 번만 다시`를 누르면 이유 입력 없이 즉시 다른 미션이 나옵니다. 재추천 횟수가 증가합니다.
4. `이거 한다`로 PLAY에 진입한 뒤 체크리스트 일부를 확인하고 새로고침합니다.
5. 나머지를 확인하고 완료 입력을 엽니다. 금액 `-1`은 거절되고, 미입력과 `0`은 각각 저장됩니다.
6. 평가·코멘트를 입력한 뒤 새로고침하고 완료 입력을 다시 열어 자동 저장을 확인합니다.
7. 완료 후 EXP·시간·평가를 확인합니다. 새로고침해도 EXP는 중복 지급되지 않습니다.
8. 같은 조건으로 다음 미션을 시작하고 포기합니다. 완료 수와 EXP는 늘지 않습니다.
9. Tab·방향키·Space로 입력을 조작하고 390px 모바일에서 가로 넘침을 확인합니다.
10. 완료 후 공유하거나 `문구와 링크 복사`를 누릅니다. 공유 취소는 성공으로 집계하지 않습니다.

## 저장과 환경 변수

현재 저장 키는 `nowwhat:state:v1`입니다. 같은 브라우저의 같은 origin에서 기록을 유지합니다.
`localhost`와 `127.0.0.1`, 다른 포트는 저장 공간이 서로 다릅니다.
손상 기록은 자동으로 삭제하지 않습니다. 사용자가 복구를 선택하면 원문을
`nowwhat:state:v1:backup:<UUID>`에 먼저 저장한 뒤 새 기록을 만듭니다.
저장 공간을 비우면 기록이 사라지며, 현재 단계에는 기기 간 동기화가 없습니다.
로컬 모드의 시간과 완료 여부는 로컬 기록입니다. DB 모드의 보상은 서버가 검증·확정합니다.

Supabase 연결은 [설정 안내](docs/supabase-setup.md)를 따릅니다.
`.env.example`을 `.env.local`로 복사하고 `NEXT_PUBLIC_DATA_MODE=supabase`, 공개 URL/키와 서버 secret 키를 설정합니다.
비밀 키에 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. `.env.local`은 Git에서 제외합니다.
서비스 키는 `server-only` 경계 안에서만 사용하고, 사용자 데이터는 RLS로 격리합니다.
익명 Auth 사용자도 `auth.users` ID가 있어 `user_id`로 소유권을 확인하며, `anonymous_id`는 감사용 식별자입니다.
가입·익명 계정 연결·기존 계정 이관의 설정은 [STEP 6 안내](docs/account-setup.md)를 확인하세요.
로컬 모드에서는 가입 화면과 기록을 확인할 수 있고 실제 Google/Email 연결은 비활성화되어 있습니다.

2026-10-06 STEP 2 초기 설치 점검에서 런타임 감사는 취약점 0건이었으며,
ESLint 하위 개발 의존성 경고 5건은 상위 호환 수정이 필요해 유지했습니다.
이 수치는 초기 설치 시점의 점검 기록입니다.

## 다음 단계

STEP 9에서 Vercel 환경 변수·배포 설정·출시 전 점검을 준비합니다.
원격 Supabase 프로젝트가 준비되면 STEP 5~8 마이그레이션, 실제 Google/Email Auth와 이벤트 API 연결을 확인합니다.
