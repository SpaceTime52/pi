# 코드 품질 리뷰어 프롬프트 템플릿

코드 품질 리뷰어 서브에이전트를 호출할 때 이 템플릿을 사용한다.

**목적:** 구현이 잘 만들어졌는지 검증한다(깔끔함, 테스트 가능성, 유지보수성)

**반드시 스펙 준수 리뷰를 통과한 뒤에만 호출한다.**

```
subagent tool:
  parameters:
    type: "run"
    agent: "reviewer"
    task: |
      Use template at requesting-code-review/code-reviewer.md

      WHAT_WAS_IMPLEMENTED: [from implementer's report]
      PLAN_OR_REQUIREMENTS: Task N from [plan-file]
      BASE_SHA: [commit before task]
      HEAD_SHA: [current commit]
      DESCRIPTION: [task summary]
```

**표준적인 코드 품질 검토 항목 외에도, 리뷰어는 다음을 확인해야 한다:**
- 각 파일이 잘 정의된 인터페이스와 함께 하나의 명확한 책임만 갖고 있는가?
- 각 단위가 독립적으로 이해하고 테스트할 수 있도록 분해되어 있는가?
- 구현이 계획에서 정한 파일 구조를 따르고 있는가?
- 이번 구현으로 이미 큰 새 파일이 생겼거나, 기존 파일 크기가 크게 증가했는가? (기존부터 컸던 파일 크기는 지적하지 말고, 이번 변경이 얼마나 기여했는지에 집중한다.)

**코드 리뷰어 반환 항목:** 강점, 이슈(Critical/Important/Minor), 평가
