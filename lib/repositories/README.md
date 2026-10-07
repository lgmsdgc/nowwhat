# Repositories

`localRepository.ts`의 `StoragePort`와 `LocalRepository`가 localStorage 읽기·쓰기 경계를 맡습니다.
버전 1 문서는 입력·세션·피드백을 포함하며 Zod로 검증합니다.
각 명령마다 최신 문서를 읽고, 전환 결과를 한 번의 `setItem`으로 저장합니다.
브라우저 어댑터 `lib/storage/browserStore.ts`는 Web Locks로 탭 간 쓰기를 직렬화합니다.
저장 실패는 UI에 전달하고, 손상 기록은 백업 성공 후에만 초기화할 수 있습니다.
알 수 없는 버전은 덮어쓰지 않습니다.
`remoteRepository.ts`는 익명 Auth token과 명령만 `/api/game`에 전송합니다.
서버가 검증한 저장 결과만 UI에 공개하며, 연결 오류를 로컬 성공으로 대체하지 않습니다.
`services/serverGameService.ts`의 `GameDatabase` 포트에 Supabase RPC 어댑터를 연결합니다.
DB 트랜잭션은 프로필 잠금과 revision으로 동시 쓰기를 제어합니다.
모드 전환 시 기존 로컬 기록은 유지하며 자동 이관하지 않습니다.

STEP 8은 로컬 v1 문서에 기본값 `analyticsEvents: []`를 추가해 과거 기록을 복원합니다.
로컬 게임 전환 이벤트는 정상 시 게임과 한 번에 저장합니다. 저장 공간 부족 시 분석 배열을 비우고
게임 기록만 한 번 재시도하며, 게임 자체도 저장할 수 없으면 기존 오류를 표시합니다.
클라이언트 분석만 저장하는 실패는 플레이에 전달하지 않습니다.
원격 명령에는 검증된 방문 ID·시간대만 추가하고 미션 전환 사실·시각은 DB가 결정합니다.
