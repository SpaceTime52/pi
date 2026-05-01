---
description: 기존 PR을 워크트리로 체크아웃
argument-hint: "<PR-번호>"
---
사용자가 PR #$@ 를 리뷰/수정하려고 해.

다음을 수행해:

1. `gh pr view $@ --json title,state,baseRefName,headRefName,author,body,isDraft` 로 PR 메타 로드
2. PR 요약을 사용자에게 표시:
   - 제목, 작성자, base ← head 브랜치
   - 상태 (OPEN / MERGED / CLOSED, isDraft 여부)
   - body 발췌 (너무 길면 첫 200자 + `...`)
3. PR이 이미 머지/클로즈됐으면 그 사실을 먼저 강조해서 알리고, 그래도 워크트리 만들지 물어
4. `bash .pi/bin/pi-wt review $@` 로 워크트리 생성
5. 사용자 의도를 확인:
   - **리뷰만**: PR diff(`gh pr diff $@`)를 같이 로드해 분석 시작
   - **수정 작업**: `bash .pi/bin/pi-wt open pr-$@` 안내 후 새 pi 세션에서 진행 권장
   - **둘 다 이 세션에서**: 워크트리로 cd하고 그대로 진행

리뷰 시 우선 살필 것:
- diff에서 잠재 버그·누락된 테스트
- PR description과 실제 변경의 일치 여부
- 코멘트가 이미 달렸으면 미해결 conversation 위주

리뷰 코멘트 작성은 그 thread 자체에 답글로 남겨야 하고, 단일 summary로 여러 conversation을 한 번에 대체하지 마.
