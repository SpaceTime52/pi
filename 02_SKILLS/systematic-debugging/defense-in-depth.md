# 다층 방어 검증

## 개요

잘못된 데이터 때문에 발생한 버그를 고칠 때는 한 곳에 검증만 추가해도 충분해 보일 수 있습니다. 하지만 그런 단일 검사는 다른 코드 경로, 리팩터링, 목(mock) 때문에 우회될 수 있습니다.

**핵심 원칙:** 데이터가 통과하는 모든 계층에서 검증합니다. 버그가 구조적으로 불가능해지게 만드세요.

## 왜 여러 계층이 필요한가

단일 검증: "버그를 고쳤다"
여러 계층: "버그가 발생할 수 없게 만들었다"

계층마다 잡아내는 경우가 다릅니다:
- 진입점 검증은 대부분의 버그를 잡아냅니다
- 비즈니스 로직은 엣지 케이스를 잡아냅니다
- 환경 가드는 특정 맥락에서의 위험을 막아줍니다
- 디버그 로깅은 다른 계층이 실패했을 때 원인 파악을 돕습니다

## 네 가지 계층

### 계층 1: 진입점 검증
**목적:** API 경계에서 명백히 잘못된 입력을 거부합니다

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory cannot be empty');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory does not exist: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory is not a directory: ${workingDirectory}`);
  }
  // ... proceed
}
```

### 계층 2: 비즈니스 로직 검증
**목적:** 이 작업에 맞게 데이터가 의미를 가지는지 보장합니다

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir required for workspace initialization');
  }
  // ... proceed
}
```

### 계층 3: 환경 가드
**목적:** 특정 맥락에서 위험한 동작을 막습니다

```typescript
async function gitInit(directory: string) {
  // In tests, refuse git init outside temp directories
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `Refusing git init outside temp dir during tests: ${directory}`
      );
    }
  }
  // ... proceed
}
```

### 계층 4: 디버그 계측
**목적:** 포렌식 분석을 위한 맥락을 남깁니다

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('About to git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... proceed
}
```

## 패턴 적용 방법

버그를 발견했다면:

1. **데이터 흐름 추적** - 잘못된 값은 어디서 시작되는가? 어디에서 사용되는가?
2. **모든 체크포인트 매핑** - 데이터가 통과하는 모든 지점을 나열합니다
3. **각 계층에 검증 추가** - 진입점, 비즈니스, 환경, 디버그
4. **각 계층 테스트** - 1계층을 우회해 보고, 2계층이 잡아내는지 확인합니다

## 세션에서 나온 예시

버그: 빈 `projectDir` 때문에 소스 코드 디렉터리에서 `git init`이 실행됨

**데이터 흐름:**
1. 테스트 설정 -> 빈 문자열
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init`이 `process.cwd()`에서 실행됨

**추가한 네 가지 계층:**
- 계층 1: `Project.create()`가 비어 있지 않은지/존재하는지/쓰기 가능한지 검증
- 계층 2: `WorkspaceManager`가 projectDir가 비어 있지 않은지 검증
- 계층 3: `WorktreeManager`가 테스트 중 tmpdir 밖에서의 git init을 거부
- 계층 4: git init 전에 스택 트레이스 로깅

**결과:** 1847개 테스트가 모두 통과했고, 버그는 재현이 불가능해졌습니다

## 핵심 인사이트

네 가지 계층이 모두 필요했습니다. 테스트 중에는 각 계층이 다른 계층이 놓친 버그를 잡아냈습니다:
- 서로 다른 코드 경로가 진입점 검증을 우회했습니다
- 목(mock)이 비즈니스 로직 검사를 우회했습니다
- 서로 다른 플랫폼의 엣지 케이스 때문에 환경 가드가 필요했습니다
- 디버그 로깅이 구조적 오용을 식별해 주었습니다

**검증 지점 하나에서 멈추지 마세요.** 모든 계층에 검사를 추가하세요.
