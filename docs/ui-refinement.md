# UI 간결화 — 2026-10-07

추천 화면을 중심으로 홈·질문·플레이·완료의 정보 밀도와 시각적 우선순위를 맞췄습니다.
서비스·저장소·추천·보상·분석 로직과 데이터 모델은 변경하지 않았습니다.

- 추천: 작은 아이콘·제목·한 줄 소개·시간/1인 예산, 한 줄의 실행/재추천 버튼.
  자세한 방법·난이도·예상 재미는 `하는 방법`, 입력 조건은 `내 조건`에서 확인합니다.
  두 일반 안내 문구만 접고, 그 외 진행 조건은 기본 화면에 모두 표시합니다.
- 홈: 한 가지 소개와 시작 버튼, 평평한 예시 카드. 회전 카드·스티커·영문 장식·동행 배지를 제거했습니다.
- 질문: 질문·선택지·진행 단계 중심. 선택지별 보조 설명을 제거하고 시간·예산·안전 강도 안내는 유지합니다.
- 플레이: 제목·경과 시간·체크리스트 중심. 격려 문구·저장 안내를 줄였습니다.
- 완료: 보상·소요시간·비용·레벨 중심. 미입력 평가를 생략하고 칭호·공유·가입 안내를 작게 정리했습니다.
- 공통: 간단한 내비게이션과 푸터, 52px 버튼, 덜 강한 타이포그래피, 짧은 등장 애니메이션.
  입력 선택·키보드 포커스·44px 이상 터치 영역·동작 줄이기 지원은 유지합니다.

주요 파일은 `features/mission/`, `features/landing/`, `features/onboarding/OnboardingFlow.tsx`,
`features/gameplay/`, `components/layout/AppShell.tsx`, `components/ui/Button.tsx`, `app/globals.css`입니다.

## 검증

- 포맷·ESLint·타입·177개 기존 테스트와 production build 통과.
- 로컬 개발 서버에서 390px 및 320px 모바일 viewport와 데스크톱을 확인했습니다.
  실제 clientWidth/scrollWidth는 각각 390/390, 305/305, 1265/1265로 가로 넘침이 없습니다.
- 상세/조건 펼치기, 버튼 한 번으로 재추천, 수락→체크→완료→새 추천 정상.
- EXP +100·칭호 지급·다음 레벨 진행도, 미입력 평가 생략, 질문 선택 복원을 확인했습니다.
- 기존 127.0.0.1의 사용자 플레이 기록 대신 별도 localhost origin에서 검증했습니다.

캡처는 `artifacts/ui-clean-mission-mobile.png`, `ui-clean-onboarding-mobile.png`,
`ui-clean-complete-mobile.png`, `ui-clean-mission-desktop.png`에 보관했습니다.
임시 테스트 탭과 viewport 설정은 검증 후 정리합니다.
