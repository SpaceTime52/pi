---
name: requesting-code-review
description: 최근 변경사항을 머지, 릴리스, 또는 다음 구현 단계 전에 집중적으로 검토받아야 할 때 사용한다.
---

# 코드 리뷰 요청

문제가 커지기 전에 잡아내기 위해 `reviewer` 서브에이전트를 호출한다. 리뷰어에게는 평가에 필요한 컨텍스트만 정확하게 전달하고, 현재 세션의 이력은 넘기지 않는다. 이렇게 하면 리뷰어는 당신의 사고 과정이 아니라 결과물 자체에 집중할 수 있고, 당신의 컨텍스트도 이후 작업을 위해 보존된다.

**핵심 원칙:** 리뷰는 일찍, 그리고 자주 요청한다.

## 리뷰를 요청해야 하는 시점

**필수:**
- subagent-driven development에서 각 작업이 끝난 뒤
- 큰 기능 구현을 마친 뒤
- main에 머지하기 전

**선택 사항이지만 가치 있음:**
- 막혔을 때(새로운 관점이 필요할 때)
- 리팩터링 전에(기준선 점검)
- 복잡한 버그를 수정한 뒤

## 리뷰 요청 방법

**1. git SHA를 구한다:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # 또는 origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**2. reviewer 서브에이전트를 호출한다:**

`subagent` 도구로 `agent: "reviewer"`를 호출하고, `code-reviewer.md`의 템플릿을 `task` 본문에 채운다.

**자리표시자:**
- `{WHAT_WAS_IMPLEMENTED}` - 방금 구현한 내용
- `{PLAN_OR_REQUIREMENTS}` - 구현물이 해야 하는 일
- `{BASE_SHA}` - 시작 커밋
- `{HEAD_SHA}` - 끝 커밋
- `{DESCRIPTION}` - 짧은 요약

**3. 피드백에 대응한다:**
- Critical 이슈는 즉시 수정한다
- Important 이슈는 다음으로 진행하기 전에 수정한다
- Minor 이슈는 나중에 처리할 항목으로 기록한다
- 리뷰어가 틀렸다면 근거를 들어 이의를 제기한다

## 예시

```
[방금 작업 2 완료: 검증 함수 추가]

당신: 계속 진행하기 전에 코드 리뷰를 요청하겠다.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[reviewer 서브에이전트 호출]
  WHAT_WAS_IMPLEMENTED: 대화 인덱스를 위한 검증 및 복구 함수
  PLAN_OR_REQUIREMENTS: docs/plans/deployment-plan.md의 작업 2
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: verifyIndex()와 repairIndex()를 추가했고 4가지 이슈 유형을 처리함

[서브에이전트 반환]:
  Strengths: 구조가 깔끔하고 실제 테스트를 사용함
  Issues:
    Important: 진행 표시기가 없음
    Minor: 보고 간격에 매직 넘버(100) 사용
  Assessment: 진행 가능

당신: [진행 표시기 수정]
[작업 3으로 계속]
```

## 워크플로와의 연계

**Subagent-Driven Development:**
- 각 작업이 끝날 때마다 리뷰한다
- 문제가 누적되기 전에 잡는다
- 다음 작업으로 넘어가기 전에 수정한다

**Executing Plans:**
- 각 배치(작업 3개) 후에 리뷰한다
- 피드백을 받고 반영한 뒤 계속 진행한다

**애드혹 개발:**
- 머지 전에 리뷰한다
- 막혔을 때 리뷰를 요청한다

## 위험 신호

**절대 하지 말 것:**
- "간단하니까"라는 이유로 리뷰를 건너뛴다
- Critical 이슈를 무시한다
- Important 이슈를 수정하지 않은 채 진행한다
- 타당한 기술 피드백에 감정적으로 맞선다

**리뷰어가 틀렸다면:**
- 기술적 근거를 들어 이의를 제기한다
- 동작함을 증명하는 코드/테스트를 제시한다
- 추가 설명을 요청한다

템플릿 위치: requesting-code-review/code-reviewer.md
