---
description: PR용 새 워크트리 생성
argument-hint: "<branch> 예: feature/my-task"
---
사용자가 새 PR 작업용 git worktree를 만들어달라고 했어.

다음을 수행해:

1. `bash .pi/bin/pi-wt new $@` 를 실행
2. 출력에서 워크트리 경로(`✓ created: ...`)와 이름을 추출
3. 다음 둘 중 선호 방식을 사용자에게 안내:
   - **새 Ghostty 윈도우**: `Cmd+N` → 그 셸에서 `pi-wt-here <이름>`
   - **현재 셸에서 그대로**: `pi-wt-here <이름>` (현재 pi 세션은 종료되고 새 워크트리에서 새 pi가 시작됨)
   - `pi-wt-here` 함수가 정의돼 있는지 모르겠으면 `~/.pi/agent/git/github.com/SpaceTime52/pi/.pi/shell/pi-wt.zsh` 를 zshrc에서 source 했는지 확인
4. 워크트리에서 바로 시작할 다음 액션이 있는지 확인 (예: 의존성 설치, 베이스 브랜치 sync, 기존 이슈 컨텍스트 로드)

실패하면:
- 이미 존재하는 워크트리인지 (`bash .pi/bin/pi-wt list` 로 확인)
- 브랜치 이름 충돌인지
- 메인 repo 식별 실패인지
원인을 분석해 사용자에게 알려.

핵심 원칙:
- 한 워크트리 = 한 PR = 한 pi 세션
- 작업 끝나면 PR 머지 후 `bash .pi/bin/pi-wt prune` 으로 자동 정리됨
- 자동 터미널 spawn은 하지 않음 (Ghostty의 위치 기억 문제로 제거됨, `pi-wt-here` 패턴 권장)
