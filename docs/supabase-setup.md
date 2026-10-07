# Supabase 연결 안내 — STEP 5~8

프로젝트 없이도 `npm run dev`로 로컬 모드를 사용합니다. `.env.local`을 만들 필요가 없습니다.
`npm run test:db`는 PGlite의 실제 PostgreSQL 엔진에서 SQL을 검증하며 외부 서버·Docker·psql이 필요하지 않습니다.

## 프로젝트가 준비된 뒤

1. Supabase의 새 프로젝트에서 SQL Editor를 엽니다. 기존 서비스 DB에는 먼저 백업과 스키마 충돌 검토가 필요합니다.
2. `supabase/migrations/202610060001_game_schema.sql`을 실행합니다.
3. `supabase/migrations/202610060002_seed_missions.sql`을 실행합니다. 60개 미션과 동행 관계가 들어갑니다.
   이어서 `supabase/migrations/202610070001_accounts.sql`을 적용합니다. 계정 이관과 기기 기록 보관이 추가됩니다.
   그 다음 `202610070002_progression.sql`, `202610070003_progression_seed.sql`을 순서대로 적용합니다.
   칭호 9개와 완료 트리거, 난이도별 새 템플릿 보상, 과거 완료 기록의 칭호 복원이 추가됩니다.
   마지막으로 `202610070004_analytics.sql`을 적용합니다. 분석 테이블·수집 RPC·미션 전환 트리거·계정 이관 연결을 추가합니다.
4. Authentication 설정에서 **Anonymous Sign-Ins**를 활성화합니다.
5. 프로젝트 URL, publishable 키, 서버 secret 키를 `.env.local`에 설정합니다.

```dotenv
NEXT_PUBLIC_DATA_MODE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_KEY
```

6. dev 서버를 재시작합니다. 배포 시에도 환경 변수 변경 후 다시 빌드해야 공개 변수가 반영됩니다.
7. 온보딩 → 추천 → 수락 → 체크리스트 → 완료를 수행합니다. SQL Editor에서 프로필 EXP, 세션·피드백을 확인합니다.
8. 브라우저 데이터가 분리된 두 브라우저 프로필로 각각 플레이하여 사용자별 기록이 분리되는지 확인합니다.

레거시 `anon` / `service_role` 키도 각각 공개 키 / 서버 키 자리에 사용할 수 있습니다.
공개 변수에는 `service_role`·secret 키를 넣지 않습니다. 실제 키를 README·SQL·채팅에 붙여 넣지 않습니다.
키가 없거나 잘못되면 연결 오류를 표시하며 로컬 저장으로 자동 전환하지 않습니다.

## 데이터 모델

| 테이블                  | 역할                                                                     |
| ----------------------- | ------------------------------------------------------------------------ |
| profiles                | Auth 소유자, 익명 감사 ID, EXP, 생성된 Level, 동시성 revision, 질문 상태 |
| missions                | 검수된 v1 템플릿과 검색 가능한 조건·안전 컬럼                            |
| mission_relationships   | 미션별 가능한 동행 유형                                                  |
| mission_sessions        | 개인 미션 스냅샷·조건·상태·체크리스트·초안·결과, 시작/완료 시각          |
| recommendation_feedback | 노출·수락·거절·완료·포기·좋아요·싫어요, 선택적 거절 사유                 |
| achievements            | 확장 가능한 칭호 조건(JSON)                                              |
| user_achievements       | 사용자별 획득 칭호, 획득 시각                                            |
| analytics_events        | 방문·미션 전환·공유 사실, 검증된 소유자·발생 시각·현지 날짜              |

익명 Auth 사용자도 인증된 사용자 ID를 받습니다. 따라서 DB 소유권은 항상 `user_id`에 연결하고,
`anonymous_id`는 임의로 제출한 브라우저 식별자를 신뢰하는 대신 프로필에서 발급합니다.
STEP 6 계정·기록 연결은 [추가 설정](account-setup.md)을 따릅니다.
STEP 7의 규칙과 검증은 [칭호·보상 안내](step-7-validation.md)에 있습니다.
STEP 8의 수집과 지표 정의는 [분석 안내](analytics-setup.md)에 있습니다.

`missions.template`, 세션·피드백의 `document`는 기존 런타임 검증 형식과 같은 JSON입니다.
조건·안전·평가·보상 등은 **generated column**으로 노출하여 같은 값을 두 곳에서 독립 수정하지 않도록 했습니다.
시각은 PostgreSQL `timestamptz`이고 RPC가 문서의 UTC ISO 시각과 함께 저장합니다.
세션 스냅샷은 추천 당시 내용을 유지하므로 이후 템플릿 수정이 완료 기록을 바꾸지 않습니다.
미션 ID는 기존 seed와 로컬 기록의 안정적인 문자열 ID를 유지합니다.

## 요청과 권한

```text
Browser → Supabase anonymous Auth → Bearer token
Browser → /api/game → Auth getUser(token) → 소유자 확인
Server → 사용자 권한 get_game_state() + 활성 미션 조회
Server → 명령·조건 검증 + 서버 시각 + 순수 상태 전환
Server → service_role 전용 commit_game_state() → 한 트랜잭션
```

- 모든 테이블에 RLS가 활성화되어 있습니다. 개인 테이블은 본인의 읽기만 허용합니다.
- 공개 읽기는 활성 미션·관계·칭호만 허용합니다. EXP·세션·칭호 획득의 직접 쓰기는 막았습니다.
- `get_game_state()`는 인자를 받아 소유자를 바꾸지 않고 `auth.uid()`만 사용합니다.
- `commit_game_state()`는 PUBLIC/anon/authenticated 실행 권한을 제거하고 service_role만 허용합니다.
- SECURITY DEFINER 함수는 `search_path=''`와 명시적 스키마를 사용합니다.
- 서버는 검증된 Auth ID와 DB 기록으로만 상태를 계산합니다. API는 state/EXP/user_id/임의 시각을 받지 않습니다.
- 프로필 잠금과 revision 비교 후 저장합니다. 충돌 시 최대 3회 다시 읽어 계산하고, 실패하면 오류를 반환합니다.
- 완료 재시도는 같은 결과를 반환합니다. 완료 기록 수정·이력 삭제·다른 사용자의 ID 덮어쓰기를 차단합니다.
- 완료 세션 보상의 합으로 EXP를 갱신하고 Level은 `exp / 300 + 1`로 생성합니다.
  레벨 정책 변경 시 TypeScript와 SQL 마이그레이션을 함께 변경해야 합니다.
- 입력 크기 16KiB, 엄격한 명령 스키마, DB 제약, no-store 응답, 네트워크 시간 제한을 적용합니다.
- 게임 명령은 브라우저 시각을 신뢰하지 않습니다. IANA 시간대를 검증하고 서버 시각을 해당 시간대로 변환해 야간 안전을 판단합니다.
  시간대는 사용자 환경 값이므로 위치 증명으로 사용하지 않습니다.
- `/api/analytics`는 검증된 소유자와 32KiB 이하의 엄격한 이벤트만 받습니다.
  클라이언트 발생 시각은 방문·공유 분석에만 쓰며 과거 7일~미래 5분 범위를 검사합니다.
  비용·코멘트·임의 속성·게임 전환 이벤트 제출을 거절하고 게임 이벤트는 DB 기록의 시각을 씁니다.
- 분석 트리거는 같은 게임 트랜잭션 안에서 기록합니다. 게임 롤백 시 이벤트도 롤백됩니다.
  분석 전용 저장 오류는 경고를 남기고 플레이를 유지하므로 누락 가능성이 있습니다.
  `/api/analytics` GET은 본인 최근 2,000개만 읽으며 전체 사용자 통계를 공개하지 않습니다.

서버 secret 키는 RLS를 우회하는 권한을 가집니다. `lib/supabase/server.ts`의 `server-only` 경계 밖으로 가져오지 않습니다.
현재 API는 bearer 기반이며 인증 쿠키를 자동으로 받지 않습니다.
브라우저 Auth 세션이 사라지면 기존 익명 DB 기록은 남지만 접근을 복원할 수 없습니다. 계정을 연결한 뒤에는 해당 Google/Email 로그인으로 다시 접근합니다.
여러 탭은 Web Locks로 요청을 직렬화하고 BroadcastChannel과 창 포커스로 화면을 갱신합니다.

## 로컬 기록과 시드 관리

모드 전환 시 `nowwhat:state:v1`은 삭제·자동 업로드하지 않습니다. DB 모드는 새 익명 Auth 기록으로 시작합니다.
계정 화면에서 기기 기록 보관을 선택하면 완료 기록만 별도 출처로 옮깁니다. 로컬 EXP는 지급하지 않으며 원본은 보존합니다.

```sh
npm run db:seed:generate
npm run db:progression:generate
npm run test:db
```

시드 수정은 `seed/*.ts`에서 하고 SQL을 재생성합니다. 개발 초기에는 시드 SQL을 다시 실행할 수 있습니다.
원격에 적용한 마이그레이션은 수정하지 말고 새 번호의 마이그레이션을 추가해 변경을 배포합니다.
STEP 7만 추가하는 기존 DB에는 마지막 두 SQL만 적용합니다. 보상 업데이트는 템플릿만 변경하며
이미 추천되었거나 완료된 세션 스냅샷과 EXP는 그대로 유지합니다.
`types/database.ts`는 현재 수동 관리 계약입니다. 원격 프로젝트가 생기면 CLI로 전체 DB 타입을 생성하고 비교할 수 있습니다.

공식 자료: [익명 Auth](https://supabase.com/docs/guides/auth/auth-anonymous),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[서버 사용자 검증](https://supabase.com/docs/reference/javascript/auth-getuser),
[DB 함수 권한](https://supabase.com/docs/guides/database/functions), [PGlite](https://pglite.dev/docs/).
