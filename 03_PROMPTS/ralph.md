---
description: 현재 Pi Task DAG에서 AFK 가능한 task를 Ralph loop로 실행
argument-hint: "[추가 지시/검증 명령/iteration 제한]"
---
현재 Pi Task DAG를 Ralph-style AFK loop로 진행해줘.

추가 지시:
$@

진행 방식:
1. `ralph-loop` skill의 절차를 따른다.
2. TaskList로 unblocked pending AFK task를 찾는다.
3. agentType이 있는 task만 TaskExecute로 실행한다.
4. TaskOutput으로 결과를 확인한다.
5. 필요한 경우 fresh-reviewer subagent로 diff/branch를 fresh context 리뷰한다.
6. required finding은 새 follow-up task로 만들고, blocker/HITL이면 사용자에게 명확히 보고한다.

금지:
- merge/deploy/production write/force push 금지.
- acceptance criteria가 검증되지 않은 상태에서 완료 주장 금지.
