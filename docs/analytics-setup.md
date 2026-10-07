# 분석 수집과 지표 — STEP 8

외부 SDK나 추가 환경 변수 없이 기본 local 모드에서 동작합니다.
Supabase 모드는 기존 다섯 SQL 다음에 `supabase/migrations/202610070004_analytics.sql`을 적용합니다.
실제 Supabase 프로젝트·Auth·PostgREST 연결은 아직 검증하지 않았습니다.

## 이벤트와 식별자

| 이벤트                  | 발생 기준                                                      |
| ----------------------- | -------------------------------------------------------------- |
| visit_started           | 어떤 경로에서든 사용자가 방문/포커스/동작한 방문의 첫 수집     |
| landing_view            | 홈 표시, 방문당 한 번                                          |
| onboarding_started      | 진행 중 미션 없이 질문 화면 표시, 방문당 한 번                 |
| onboarding_completed    | 유효한 답으로 마지막 추천 버튼 실행, 방문당 한 번              |
| mission_requested       | 처음 추천·재추천·완료 후 추천 요청 시도, 실패해도 남을 수 있음 |
| mission_shown           | 새 추천 세션 저장 성공                                         |
| mission_rejected        | 재추천으로 기존 세션 거절 확정, 선택적 사유                    |
| mission_accepted        | `이거 한다` 수락 확정                                          |
| mission_started         | 같은 동작으로 PLAY 시작 확정                                   |
| mission_completed       | 완료·보상 확정                                                 |
| mission_abandoned       | 사용자가 포기 확정                                             |
| mission_share_requested | 공유/복사 API 호출 직전                                        |
| mission_shared          | 공유/복사 API 성공, 채널 구분                                  |

`eventId`는 재전송에도 유지하고 의미별 `dedupeKey`로 새로고침·재시도 중복을 제거합니다.
게임 전환은 `session:<id>:<name>`, 방문·페이지·온보딩은 `visit:<id>:<name>`을 씁니다.
추천 요청과 공유는 별개의 실제 시도를 보존합니다.

`visitId`는 탭의 sessionStorage에 보관하며 새로고침 후에도 유지합니다.
30분 비활동 후 또는 시계가 역행하면 새 방문을 만듭니다. 저장이 차단되면 메모리만 사용합니다.
백그라운드에서 네트워크가 돌아오는 것만으로 방문을 만들지 않습니다.
인증 소유자 `user_id`, 최초 익명 출처 `anonymous_id`, 세션 ID, 추천 흐름 ID, 미션 ID를 연결합니다.
계정 이관은 저장된 이벤트의 소유자만 목적지로 합치고 최초 익명 출처를 유지합니다.
기기에 대기 중인 이전 계정의 전송 큐는 다른 계정으로 자동 업로드하지 않습니다.
로컬 기록 보관 기능도 분석 배열을 회원 계정에 자동 이관하지 않습니다.

허용 속성은 `requestKind`, `channel`, `rerollIndex`, `reason`뿐입니다.
코멘트·비용·별점·이메일·전체 URL·질문 답·정확한 위치를 분석에 포함하지 않습니다.
공유도 미션 제목·EXP·공개 홈 링크만 포함하며 개인 완료 주소를 쓰지 않습니다.

## 지표 정의

집계는 소유자+중복 키로 중복을 제거하고 **서로 다른 세션**을 셉니다.
분모가 0이면 비율은 `null`이며 0%로 단정하지 않습니다. 비율 단위는 0~1입니다.

- 수락률: 노출된 세션 중 수락한 세션 / 노출된 세션.
- 완료율: 위 수락 세션 중 완료한 세션 / 위 수락 세션.
- 재추천: 성공한 노출의 `rerollIndex > 0` 개수. 사용자별 요청 시도·노출·재추천·추천 흐름 수·흐름당 평균을 따로 반환합니다.
- D1: 관찰된 첫 방문의 **다음 현지 달력 날짜**에 `visit_started`가 있는 사용자 / 다음 날짜 관찰이 끝난 사용자.
  첫 방문 시간대를 기준으로 D1 날짜가 완전히 지난 사용자만 분모에 넣습니다. 아직 관찰 중인 사용자는 `pendingUsers`입니다.
- 공유: 완료 코호트 중 공유/복사 시도한 세션과 성공한 세션을 각각 집계합니다.
  `nativeShareRate`와 `clipboardCopyRate`를 분리하며 여러 번 실행해도 세션 전환율은 중복하지 않습니다.

네이티브 성공은 브라우저 공유 API가 성공한 것까지 확인합니다. 수신자가 읽었는지는 알 수 없습니다.
링크 복사는 외부 전달 완료가 아니며, `successfulActionRate`는 두 채널 중 하나의 성공 비율입니다.
취소·권한 거절은 성공 이벤트를 만들지 않습니다.

분석 도입 전 미션을 소급해서 가짜 노출/방문으로 만들지 않습니다. 과거 세션의 완료·공유가
나중에 수집되더라도 도입 이후의 노출·수락이 없는 세션은 이 전환 코호트에서 제외합니다.
기간 일부만 내보내면 분모·D1 첫 방문도 그 범위로 제한되므로 실제 신규 사용자 리텐션으로 단정하지 않습니다.
전체 기록을 보존한 동일 코호트로 비교하고 운영 시작 시점을 따로 관리해야 합니다.

## 저장·오류·권한

로컬은 `nowwhat:state:v1.analyticsEvents`에 최근 2,000개를 보관합니다. 기존 v1은 빈 배열로 복원합니다.
정상 게임 전환은 미션·EXP·이벤트를 한 번에 저장합니다. 저장 공간 부족 시 분석 배열을 비우고
게임 기록만 한 번 재시도합니다. 게임 저장도 실패하면 이전 기록을 보존하고 오류를 표시합니다.

DB의 미션 전환은 서버 트리거로 수집하며 게임 롤백 시 이벤트도 롤백합니다.
분석만 실패하면 SQLSTATE 경고를 남기고 플레이를 유지하므로 이벤트 손실이 가능합니다.
완료·보상의 원본은 `mission_sessions`와 프로필이며 분석 테이블로 보상을 판단하지 않습니다.

방문·공유 큐는 `nowwhat:analytics:outbox:v1:<anonymous_id>`에 최대 300개를 보관하고 20개씩 전송합니다.
HTTP 성공 후 전송한 ID만 지워 동시 추가를 보존합니다. 실패하면 다음 동작·포커스·온라인 복귀에 재시도합니다.
7일보다 오래된 이벤트·5분보다 미래인 이벤트와 용량을 넘는 가장 오래된 이벤트는 버리고 `dropped`에 셉니다.
손상된 큐는 덮어쓰지 않으며 플레이를 막지 않습니다. 저장 차단·큐 만료·계정 전환·서버 오류로 누락될 수 있는 best effort 수집입니다.

`POST /api/analytics`는 Bearer Auth `getUser`로 소유자를 검증하고 32KiB/20개 제한과 엄격한 스키마를 적용합니다.
service_role 전용 RPC가 익명 ID·세션 소유권·완료 상태·시간대·시각 범위·속성을 다시 검사합니다.
클라이언트는 게임 전환 이벤트를 제출할 수 없습니다. 직접 테이블 쓰기와 내부 RPC 실행은 막았습니다.
`GET /api/analytics`는 RLS로 **본인 최근 2,000개**와 집계만 반환하며 `scope: own-latest-2000`을 명시합니다.
공개 사용자별 통계나 전체 사용자 조회 API는 없습니다. 응답은 `no-store`입니다.

## 확인과 리포트

로컬 개발 브라우저의 Application → Local Storage에서 `nowwhat:state:v1` JSON을
개인 기기의 파일로 저장한 뒤 다음 명령으로 집계합니다. 전체 저장 문서에는 개인 완료 입력이
포함될 수 있으므로 공유할 검증 파일은 아래 형식의 분석 기록만 따로 추출합니다.

```sh
npm run analytics:report -- records.json
npm run test:db
```

CLI는 로컬 상태, `[{ownerId,event}]`, 또는 GET 응답 `{records,...}`를 받습니다.
DB 전체 운영 지표는 관리 권한의 SQL Editor에서 전체 기간을 내보내 아래 형식으로 저장합니다.
서버 secret 키는 브라우저·문서·채팅에 넣지 않습니다.

```sql
select coalesce(jsonb_agg(jsonb_build_object(
  'ownerId', user_id,
  'event', jsonb_build_object(
    'id', id, 'name', name, 'visitId', visit_id,
    'anonymousId', anonymous_id, 'sessionId', session_id,
    'recommendationRunId', recommendation_run_id, 'missionId', mission_id,
    'dedupeKey', dedupe_key, 'source', source, 'properties', properties,
    'timeZone', time_zone, 'localDate', local_date::text,
    'occurredAt', to_char(occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  )
) order by occurred_at, id), '[]'::jsonb) as records
from public.analytics_events;
```

브라우저 수집은 `AnalyticsTransport` 포트로 분리했습니다. PostHog를 붙일 때는 어댑터를 구현하고
게임 이벤트도 서버에서 전송하며 동일 ID·중복 키를 유지해야 합니다. 현재는 외부 SDK를 설치하거나 전송하지 않습니다.
DB 기록의 자동 만료 작업은 아직 없으며 출시 전에 보관 기간·삭제 방식·개인정보 안내를 결정합니다.
