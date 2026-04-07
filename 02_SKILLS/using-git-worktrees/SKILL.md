---
name: using-git-worktrees
description: 작업에 격리된 작업공간이 필요하거나, 브랜치를 동시에 다뤄야 하거나, 위험한 변경을 안전한 환경에서 진행해야 할 때 사용한다.
---

# Git Worktree 사용하기

## 개요

Git worktree는 같은 저장소를 공유하면서도 격리된 작업공간을 만들어 주므로, 브랜치를 전환하지 않고도 여러 브랜치에서 동시에 작업할 수 있게 해준다.

**핵심 원칙:** 체계적인 디렉터리 선택 + 안전성 검증 = 신뢰할 수 있는 격리.

**시작할 때 이렇게 알린다:** "격리된 작업공간을 준비하기 위해 using-git-worktrees 스킬을 사용하겠습니다."

## 디렉터리 선택 절차

다음 우선순서를 따른다:

### 1. 기존 디렉터리 확인

```bash
# 우선순서대로 확인
ls -d .worktrees 2>/dev/null     # 선호됨 (숨김)
ls -d worktrees 2>/dev/null      # 대안
```

**발견되면:** 그 디렉터리를 사용한다. 둘 다 있으면 `.worktrees`를 우선한다.

### 2. CLAUDE.md 확인

```bash
grep -i "worktree.*director" CLAUDE.md 2>/dev/null
```

**선호 설정이 명시되어 있으면:** 묻지 말고 그대로 사용한다.

### 3. 사용자에게 묻기

디렉터리도 없고 CLAUDE.md 선호 설정도 없다면:

```
worktree 디렉터리를 찾지 못했습니다. worktree를 어디에 만들까요?

1. .worktrees/ (프로젝트 로컬, 숨김)
2. ~/.config/pi/worktrees/<project-name>/ (전역 위치)

어느 쪽을 원하시나요?
```

## 안전성 검증

### 프로젝트 로컬 디렉터리(.worktrees 또는 worktrees)인 경우

**worktree를 만들기 전에 해당 디렉터리가 ignore되는지 반드시 확인해야 한다:**

```bash
# 디렉터리가 ignore되는지 확인 (로컬, 전역, 시스템 gitignore를 모두 반영)
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**ignore되지 않는다면:**

즉시 다음을 수행한다:
1. `.gitignore`에 적절한 항목을 추가한다
2. 그 변경을 커밋한다
3. worktree 생성을 진행한다

**왜 중요한가:** worktree 내용이 저장소에 실수로 커밋되는 일을 막기 위해서다.

### 전역 디렉터리(`~/.config/pi/worktrees`)인 경우

프로젝트 바깥에 있으므로 `.gitignore` 검증이 필요 없다.

## 생성 단계

### 1. 프로젝트 이름 감지

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. Worktree 생성

```bash
# 전체 경로 결정
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/pi/worktrees/*)
    path="~/.config/pi/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# 새 브랜치와 함께 worktree 생성
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. 프로젝트 설정 실행

프로젝트에 맞는 설정 작업을 자동 감지해 실행한다:

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. 깨끗한 기준선 확인

worktree가 깨끗한 상태에서 시작하는지 확인하기 위해 테스트를 실행한다:

```bash
# 예시 - 프로젝트에 맞는 명령을 사용
npm test
cargo test
pytest
go test ./...
```

**테스트가 실패하면:** 실패 내용을 보고하고, 계속 진행할지 조사할지 묻는다.

**테스트가 통과하면:** 준비 완료라고 보고한다.

### 5. 위치 보고

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

## 빠른 참고표

| 상황 | 조치 |
|-----------|--------|
| `.worktrees/`가 존재함 | 사용한다 (ignore 검증 포함) |
| `worktrees/`가 존재함 | 사용한다 (ignore 검증 포함) |
| 둘 다 존재함 | `.worktrees/`를 사용한다 |
| 둘 다 없음 | CLAUDE.md를 확인한 뒤 사용자에게 묻는다 |
| 디렉터리가 ignore되지 않음 | `.gitignore`에 추가 후 커밋 |
| 기준선 테스트가 실패함 | 실패를 보고하고 사용자에게 묻는다 |
| `package.json`/`Cargo.toml`이 없음 | 의존성 설치를 건너뛴다 |

## 흔한 실수

### ignore 검증을 건너뛰는 경우

- **문제:** worktree 내용이 추적되어 git status가 오염된다
- **해결:** 프로젝트 로컬 worktree를 만들기 전에 항상 `git check-ignore`를 사용한다

### 디렉터리 위치를 임의로 가정하는 경우

- **문제:** 일관성이 깨지고 프로젝트 관례를 위반하게 된다
- **해결:** 기존 디렉터리 > CLAUDE.md > 사용자에게 묻기 순서를 따른다

### 테스트가 실패하는데도 진행하는 경우

- **문제:** 새 버그와 기존 문제를 구분할 수 없게 된다
- **해결:** 실패를 보고하고, 명시적으로 허락받은 뒤 진행한다

### 설정 명령을 하드코딩하는 경우

- **문제:** 다른 도구를 쓰는 프로젝트에서 깨진다
- **해결:** 프로젝트 파일(`package.json` 등)을 기준으로 자동 감지한다

## 예시 워크플로

```
You: 격리된 작업공간을 준비하기 위해 using-git-worktrees 스킬을 사용하겠습니다.

[.worktrees/ 확인 - 존재함]
[ignore 검증 - git check-ignore가 .worktrees/가 ignore됨을 확인]
[worktree 생성: git worktree add .worktrees/auth -b feature/auth]
[npm install 실행]
[npm test 실행 - 47개 통과]

Worktree ready at /Users/me/myproject/.worktrees/auth
Tests passing (47 tests, 0 failures)
Ready to implement auth feature
```

## 위험 신호

**절대 하지 말 것:**
- ignore 여부를 확인하지 않고 worktree를 생성하지 않는다 (프로젝트 로컬)
- 기준선 테스트 검증을 건너뛰지 않는다
- 테스트가 실패하는데도 묻지 않고 진행하지 않는다
- 디렉터리 위치가 애매한데 추측하지 않는다
- CLAUDE.md 확인을 빼먹지 않는다

**항상 할 것:**
- 디렉터리 우선순서를 따른다: 기존 디렉터리 > CLAUDE.md > 사용자에게 묻기
- 프로젝트 로컬인 경우 디렉터리가 ignore되는지 검증한다
- 프로젝트 설정을 자동 감지해 실행한다
- 깨끗한 테스트 기준선을 확인한다

## 연계

**다음에서 호출됨:**
- **brainstorming** (4단계) - 설계가 승인되고 구현으로 넘어갈 때 반드시 필요
- **subagent-driven-development** - 어떤 작업이든 실행 전에 반드시 필요
- **executing-plans** - 어떤 작업이든 실행 전에 반드시 필요
- 격리된 작업공간이 필요한 모든 스킬

**함께 쓰면 좋은 스킬:**
- **finishing-a-development-branch** - 작업 완료 후 정리를 위해 반드시 필요
