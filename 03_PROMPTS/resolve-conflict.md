---
description: 현재 브랜치/PR의 merge conflict를 안전하게 해소
argument-hint: "[PR-번호/PR-URL/base-branch/추가 지시]"
---
먼저 `start_supervision` 도구를 사용해 아래 목표로 supervisor를 활성화해줘.

outcome:
현재 브랜치 또는 지정된 PR의 merge conflict를 안전하게 해소한다. 기본 전략은 head 브랜치에 base 브랜치를 일반 merge로 반영해 conflict를 해결하고, 테스트/검증을 통과시킨 뒤 커밋·푸시까지 진행하는 것이다. PR 자체를 merge하지 않고, merge queue에 넣지 않으며, auto-merge를 켜지 않고, force push도 하지 않는다. 직접 해결할 수 없는 충돌이나 의미 판단이 필요한 제품 결정이 있으면 필요한 사용자 액션을 구체적으로 요청한다.

자료 및 지시사항:
$@

그 다음 아래 원칙으로 작업해줘.

1. 대상 확인
   - 인자가 PR 번호/URL이면 `gh pr view`로 title, baseRefName, headRefName, mergeStateStatus, mergeable을 확인한다.
   - 인자가 branch 이름이면 그것을 base branch 후보로 본다.
   - 인자가 없으면 현재 브랜치의 PR을 `gh pr view --json ...`로 찾고, 없으면 repo default branch를 base로 사용한다.
   - 현재 브랜치와 원격 상태, `git status --short --branch`를 먼저 공유한다.

2. 안전장치
   - 시작 전 작업트리가 더럽고 conflict 해결 중 생성된 변경이 아니라면, 임의로 덮어쓰거나 stash하지 말고 어떤 파일이 막는지 보고한다.
   - rebase, force push, reset --hard는 사용자가 명시적으로 요청하지 않는 한 금지한다.
   - PR merge, merge queue, auto-merge 관련 동작은 금지한다.

3. conflict 유도/확인
   - `git fetch origin <base>` 후 head 브랜치에 `origin/<base>`를 일반 merge한다.
   - 이미 merge conflict 상태면 새 merge를 시작하지 말고 현재 conflict 상태를 분석한다.
   - conflict 파일은 `git diff --name-only --diff-filter=U`와 conflict marker 검색으로 확인한다.

4. 해결
   - 각 conflict마다 base와 head 양쪽 의도를 읽고, 기능을 보존하는 최소 변경으로 marker를 제거한다.
   - 단순히 한쪽을 전부 선택하지 말고 테스트/주변 코드/도메인 맥락으로 올바른 통합안을 만든다.
   - 해결한 파일은 staged 상태와 diff를 확인한다.

5. 검증 및 커밋
   - 프로젝트의 관련 typecheck/test/build를 실행한다.
   - 최소한 `git diff --check`를 실행한다.
   - 검증이 통과하면 merge conflict 해결 커밋을 만들고 원격 head branch에 push한다.
   - 검증 실패가 conflict 해결 때문이면 수정하고 재검증한다. 기존 unrelated 실패면 명확히 구분해 보고한다.

6. PR 상태 확인
   - PR이 있으면 push 후 `gh pr view --json mergeStateStatus,mergeable,statusCheckRollup,url`로 conflict 해소 여부를 확인한다.
   - 최종 보고에는 해결한 conflict 파일, 생성한 커밋, 실행한 검증, PR URL/mergeability를 포함한다.
