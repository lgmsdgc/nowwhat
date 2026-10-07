# Verification

`npm test`로 Vitest 테스트 177개(단위 134 + DB 43)를 실행합니다. `npm run test:db`로 DB 테스트 43개만 실행할 수 있습니다.

- `unit/gameplay.test.ts`: 수행 조건과 안전, 세션 상태 전환, 재추천, 완료 입력,
  보상 중복 방지, 레벨 경계, 포기.
- `unit/storage.test.ts`: 익명 ID·답 복원, 최신 기록 재읽기, 쓰기 실패,
  손상·새 버전 보존, 백업 우선 복구, 입력 검증.
- `unit/recommendation.test.ts`: 안전 필터, 최근 노출과 소진 처리, 가중치,
  선호 중복 제거·상한·최신 선택, 추첨 경계·비율, 저장 피드백 서비스 연동.
- `unit/missions.test.ts`: 60개 템플릿 고유성·타입·안전·커버리지,
  모든 7,680개 입력 조합 × 낮/밤 = 15,360개 조건의 수행 가능성.

전체 화면 흐름은 인앱 브라우저의 Playwright 조작으로 검증했습니다.
독립 실행 가능한 Playwright 테스트 스위트는 아직 추가하지 않았습니다.
브라우저 검증 절차는 `docs/step-3-validation.md`, `docs/step-4-validation.md`와 루트 README에 있습니다.
`npm run check`는 포맷·ESLint·타입·테스트·production build를 확인합니다.

- `unit/connection.test.ts`: 설정·키·API 요청 검증, 응답 보안, 원격 저장소 오류, 서버 시간대와 충돌 재시도.
- `unit/account.test.ts`: Auth 호출 순서·identity/로그인 구분·OTP·PKCE·이관 증명·로컬 보상 경계 11개.
- `unit/authCallback.test.ts`: callback 동시 실행, 네트워크·이관 재시도, 회원 세션으로 새로고침 복구 4개.
- `unit/progression.test.ts`: 난이도 보상·역사적 보상 유지·칭호 조건·완료 임계값·v1 복원·좋아요 목록 11개.
- `unit/profileClient.test.ts`: 비공개 칭호 조회·응답 검증·DB 오류·취소 처리 4개.
- `unit/analytics.test.ts`: 방문 복원·날짜 경계·이벤트 중복·개인정보 거절·큐 재전송·저장 부족·전환율·D1·공유 집계 23개.
- `unit/share.test.ts`: 공유 문구·호출 순서·취소·복사·권한 오류·분석 실패 경계 6개.
- `integration/database.test.ts`: PGlite PostgreSQL에 여섯 마이그레이션을 적용한 RLS·권한·트랜잭션·계정 이관·칭호·로컬 기록 보관·분석 테스트 43개.

STEP 5 결과는 `docs/step-5-validation.md`에 있습니다. 실제 Supabase Auth/PostgREST 연결은 프로젝트 준비 후 검증합니다.
STEP 6 결과는 `docs/step-6-validation.md`, 원격 계정 설정은 `docs/account-setup.md`에 있습니다.
STEP 7 결과와 칭호 확장 규칙은 `docs/step-7-validation.md`에 있습니다.
STEP 8의 지표·보관 한도·실제 모바일 검증은 `docs/analytics-setup.md`, `docs/step-8-validation.md`에 있습니다.
