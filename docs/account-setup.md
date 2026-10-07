# STEP 6 — 계정과 기록 연결

프로젝트가 없으면 로컬 모드의 `/account`에서 화면과 기존 기록을 확인합니다.
실제 가입·로그인 버튼은 비활성화되며, 가입 없이 미션을 계속 사용할 수 있습니다.

## Supabase 설정

1. [기본 연결](supabase-setup.md)의 환경 변수와 세 마이그레이션을 순서대로 적용합니다.
2. Auth 설정에서 Anonymous Sign-Ins, Email, **Manual Linking**을 활성화합니다.
3. Email Confirmations를 켜고 Site URL을 서비스 주소로 지정합니다.
4. Redirect URLs에 `http://localhost:3000/auth/callback`, `http://127.0.0.1:3000/auth/callback`과
   배포된 서비스의 `https://YOUR_DOMAIN/auth/callback`을 등록합니다.
   현재 SDK는 PKCE의 `sb_flow_id` 쿼리를 콜백 URL에 붙입니다. 허용 주소가 이 쿼리도 처리하는지 확인합니다.
5. Google OAuth provider를 활성화하고 Google Cloud에서 발급한 Client ID/secret을 Supabase 설정에 넣습니다.
   Google의 authorized redirect URI는 Supabase가 표시하는 Auth callback URL입니다.
   앱의 callback URL은 위 Redirect URLs 설정에서 관리합니다.
6. 이메일에 코드를 표시하려면 Magic Link와 Change Email 템플릿에 `{{ .Token }}`을 포함합니다.
   인증 링크 `{{ .ConfirmationURL }}`도 유지하면 링크와 코드 중 하나를 선택할 수 있습니다.
   가입 연결은 `email_change`, 기존 로그인은 `email` 유형의 OTP를 사용합니다.
7. 브라우저·서버를 재시작하고 원격 확인 절차를 실행합니다.

회원가입에 별도 비밀번호를 받지 않습니다. 이메일은 인증 링크 또는 OTP로 로그인합니다.
인증 링크는 요청한 브라우저에서 열어 PKCE verifier와 연결합니다.
인증 교환 후의 callback 새로고침은 검증된 회원 세션으로 연결을 마무리합니다.
이관 실패 재시도는 이미 교환한 인증 코드를 다시 소비하지 않고, 교환 자체의 네트워크 실패는 코드 정보를 메모리에 유지해 재시도합니다.
외부 `next` 주소로 리디렉션하지 않고 `/auth/callback`과 `/account`만 사용합니다.
callback에서 인증 코드 교환 전 URL의 인증 파라미터를 제거하고 referrer를 비활성화합니다.

## 세 가지 흐름

### 익명 사용자 → 새 계정

`처음 저장해요`를 선택하고 Google 또는 Email을 연결합니다.
Google은 `linkIdentity()`, Email은 `updateUser({ email })` 이후 인증을 사용합니다.
익명 Auth ID가 유지되므로 세션·EXP·피드백을 별도 복사하지 않습니다.
완료가 2회 이상이면 완료 화면에 저장 안내가 나오며 가입을 강제하지 않습니다.

### 익명 사용자 → 이미 가입한 계정

`이미 가입했어요`를 선택하면 로그인 전에 검증된 익명 소유권으로 이관 증명을 준비합니다.
Google OAuth 또는 Email OTP로 기존 계정에 로그인한 뒤 회원 소유권도 검증합니다.
256비트 무작위 token은 요청한 브라우저 localStorage에 남고 DB에는 SHA-256 hash만 저장합니다.
유효시간은 24시간이며, 회원 ID에 귀속된 일회용 증명으로 이관합니다. token은 URL·로그에 넣지 않습니다.
로그아웃 전에 증명 발급이 실패하면 로그인 전환도 시작하지 않아 기록 접근을 잃는 일을 줄입니다.

SQL은 source/target 프로필을 일정한 순서로 잠그고 세션·피드백·EXP·칭호를 한 트랜잭션에서 합칩니다.
세션 UUID와 원래 미션 내용·비용·평가·코멘트는 유지합니다. EXP는 DB 완료 보상만 합칩니다.
같은 증명 재시도와 같은 목적지에 대한 복수 증명은 중복 이관하지 않습니다.
타 사용자에게 재사용, 익명 목적지, 만료·위조 증명, 이미 다른 계정에 이관된 source는 거절합니다.
실패하면 원본·목적지·증명을 롤백하므로 원인을 해결한 뒤 다시 시도할 수 있습니다.

진행 중 미션이 목적지에 없으면 source 미션을 이어갈 수 있습니다.
둘 다 진행 중이면 목적지 미션을 유지하고 source의 추천은 rejected, PLAY는 abandoned로 기록합니다.
이 종료에는 EXP를 지급하지 않으며 로그인 UI에서 이 정책을 안내합니다.
이관한 source 프로필은 `merged_into`로 표시하고 이후 읽기·쓰기를 막습니다.
source Auth 사용자를 삭제하지 않으며, 이미 발급한 다른 증명은 유효시간 내 같은 목적지로 재시도할 수 있습니다.
한 source에서 동시에 대기하는 증명은 최대 10개입니다. 만료 증명 정리는 운영 단계에서 추가할 수 있습니다.

### localStorage → 회원 계정

회원 계정 화면의 `기기 기록 보관하기`를 사용자가 눌렀을 때만 원본을 전송합니다.
완료 기록의 비용·평가·재도전 의사·코멘트·실제 소요시간을 보관합니다.
미션 제목은 DB의 검수 템플릿에서 가져오며, source 익명 ID와 세션 UUID로 계정 내 중복을 제거합니다.
한 요청에 200개 이하의 세션·2,000개 이하의 피드백, 본문 1MiB 이하를 허용하고 사용자별 보관 기록은 최대 500개입니다.
기록이 손상되었거나 알 수 없는 미션 ID가 있으면 전체 요청을 거절하고 원본을 남깁니다.

로컬 데이터만으로는 이전 행동이나 소유권을 서버가 증명할 수 없습니다.
따라서 `local_mission_history`에 source=`local`로 별도 보관하고 EXP를 추가하지 않습니다.
현재 PLAY·추천·질문 상태는 이관하지 않습니다. 새 계정의 진행 상태와 충돌시키지 않기 위한 정책입니다.
로그인 성공이나 가져오기 후에도 로컬 문서는 삭제하지 않습니다.

## 추가 파일과 경계

```text
app/account/                    가입·로그인·최근 기록
app/auth/callback/              PKCE 교환·이관 재시도
app/api/account/                검증된 사용자 정보·기기 보관 기록 조회
app/api/account/migration/      익명 증명 발급·회원 이관
app/api/account/import/         로컬 완료 기록 보관
features/account/               화면·입력·저장 안내·Auth UI 상태
services/accountService.ts      브라우저 Auth·연결 API 호출
services/localImportService.ts  검증·출처 기록·보상 분리
services/authCallbackService.ts callback 동시 실행·교환·이관 재시도
lib/validation/account.ts       요청·계정·기록 타입 검증
supabase/migrations/202610070001_accounts.sql
```

이관·보관 쓰기는 service_role 전용 SQL 함수로 제한합니다. API가 Auth getUser로 ID와 익명 여부를 검증합니다.
브라우저가 source_user_id나 target_user_id를 지정할 수 없습니다.
이관 ticket 테이블은 RLS와 grants로 브라우저 읽기도 금지하며 보관 기록은 본인만 조회합니다.
계정이 바뀌면 이전 데이터·대기 명령·응답을 화면에 적용하지 않도록 스토어 세대를 변경합니다.
callback에는 개인 정보를 서버 렌더링하거나 캐시하지 않습니다.

## 원격 확인 절차

1. 익명으로 2개 미션을 완료하고 저장 안내를 확인합니다.
2. Google 또는 Email로 새 가입한 뒤 Auth user ID와 EXP가 그대로인지 확인합니다.
3. 로그아웃하고 같은 계정에 다시 로그인해 이전 기록을 조회합니다.
4. 다른 익명 세션으로 미션을 완료하고 `이미 가입했어요`로 로그인해 합쳐지는지 확인합니다.
5. 두 계정에 PLAY가 있을 때 source는 종료, 목적지는 유지되는지 확인합니다.
6. 연결 재시도 버튼과 callback 새로고침으로 EXP가 늘지 않는지 확인합니다.
7. 로컬 기록 보관을 두 번 요청해 한 번만 저장되고 서버 EXP는 그대로인지 확인합니다.
8. 잘못된 OTP, 취소된 Google 연결, 다른 브라우저의 PKCE 링크, DB 오류를 확인합니다.

원격 프로젝트가 없어 이 절차는 아직 실행하지 않았습니다.
실제 PostgreSQL의 이관·RLS·롤백은 자동 테스트, SDK 호출 방식은 가짜 Auth 포트를 사용하는 단위 테스트로 검증합니다.

공식 자료: [익명 사용자 변환](https://supabase.com/docs/guides/auth/auth-anonymous),
[Google identity 연결](https://supabase.com/docs/reference/javascript/auth-linkidentity),
[OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp),
[PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow).
