---
description: Grill → PRD → Pi Task DAG → AFK loop 순서로 기능 작업을 준비
argument-hint: "[아이디어/요구사항/링크]"
---
사용자의 기능 아이디어를 진짜 구현 가능한 Pi 작업 그래프로 정리해줘.

자료 및 요구사항:
$@

진행 순서:
1. `grill-with-docs` 방식으로 요구사항과 기존 코드/문서의 언어를 맞춘다.
2. 충분히 정렬되면 `to-prd` 방식으로 PRD를 만든다.
3. PRD를 `to-tasks` 방식으로 tracer-bullet vertical slice Task DAG로 쪼갠다.
4. 사용자의 승인을 받은 뒤 TaskCreate/TaskUpdate로 materialize한다.
5. 사용자가 원하면 `ralph-loop` 방식으로 AFK task부터 실행한다.

원칙:
- 구현은 시작하지 말고 alignment와 task graph 생성까지 한다.
- 애매한 부분은 한 번에 하나씩 질문한다.
- AFK 가능한 구현 task에는 agentType으로 `afk-implementer`를 추천한다.
- HITL decision은 별도 task로 남긴다.
