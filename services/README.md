# Services

`gameplayService`는 명령을 받아 추천·거절·시작·체크·완료·포기 상태를 전환하는 순수 함수입니다.
시간·랜덤·ID·템플릿 목록을 주입받으며, 피드백과 보상 근거를 같은 상태 문서에 남깁니다.
`recommendationService`는 STEP 4의 수행 조건·안전 필터, 최근 노출 제외, 가중 추첨입니다.
후보 풀 구성과 실제 추첨을 분리하고 가중치 요인을 반환합니다.
`lib/recommendation/policy.ts`에 정책 상수, `preferences.ts`에 선호 집계가 있습니다.
안전·시간·예산·현재 미션 제외는 후보 소진 시에도 유지합니다.

저장 순서는 repositories가, 렌더링과 사용자 입력은 features가 담당합니다.
페이지에 비즈니스 규칙을 넣지 않습니다.
`progressionService`는 완료 순서와 조건으로 칭호의 진행도·최초 획득 세션을 판정합니다.
`profileService`는 완료 통계와 명시적인 좋아요·싫어요 기록을 집계합니다.
DB 모드의 실제 획득은 SQL 트리거에서 확정하며 `profileClientService`는 RLS 조회 결과만 가져옵니다.
`missionService`는 활성 DB 템플릿과 동행 관계를 읽어 도메인 스키마로 검증합니다.
`serverGameService`는 명령 검증 → 최신 기록 읽기 → 서버 시간·사용자 시간대의 상태 전환 → 원자적 저장을 담당합니다.
Supabase 구현은 `lib/supabase/server.ts`에서 서버 전용 GameDatabase 어댑터로 연결합니다.

`analyticsService`는 검증된 이벤트 생성·중복 제거·로컬 상태 변경 사실 추출을 맡습니다.
`analyticsClientService`는 방문·공유 수집과 best effort 큐 전송을 맡고 게임 명령은 네트워크 전송을 기다리지 않습니다.
`analyticsReportService`는 세션 전환·재추천·D1·공유 채널을 순수 함수로 집계합니다.
`shareService`는 완료 미션의 공개 문구만 만들고 시도·성공을 구분합니다. 비용·코멘트·세션 주소는 제외합니다.
전송 구현은 `lib/analytics/transport.ts`의 포트로 분리하여 추후 PostHog 등으로 교체할 수 있습니다.
