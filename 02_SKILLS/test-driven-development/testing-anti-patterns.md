# 테스트 안티패턴

**이 참고 문서를 불러올 때:** 테스트를 작성하거나 수정할 때, mock을 추가할 때, 혹은 프로덕션 코드에 테스트 전용 메서드를 넣고 싶어질 때.

## 개요

테스트는 mock의 동작이 아니라 실제 동작을 검증해야 한다. Mock은 격리를 위한 수단이지, 테스트 대상 그 자체가 아니다.

**핵심 원칙:** mock이 무엇을 하는지가 아니라, 코드가 무엇을 하는지 테스트한다.

**엄격한 TDD를 따르면 이런 안티패턴을 예방할 수 있다.**

## 철칙

```
1. NEVER test mock behavior
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
```

## 안티패턴 1: Mock 동작 테스트하기

**문제가 되는 예:**
```typescript
// ❌ BAD: Testing that the mock exists
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```

**왜 잘못됐는가:**
- 컴포넌트가 제대로 동작하는지가 아니라 mock이 동작하는지를 검증하고 있다
- mock이 있으면 테스트가 통과하고, 없으면 실패한다
- 실제 동작에 대해서는 아무것도 알려주지 못한다

**사람 파트너의 지적:** "지금 우리가 테스트하는 게 mock의 동작 아닌가요?"

**올바른 방법:**
```typescript
// ✅ GOOD: 실제 컴포넌트를 테스트하거나 mock하지 않는다
test('renders sidebar', () => {
  render(<Page />);  // sidebar를 mock하지 않는다
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

// 또는 격리를 위해 sidebar를 반드시 mock해야 한다면:
// mock 자체를 단언하지 말고, sidebar가 있을 때 Page의 동작을 테스트한다
```

### 게이트 함수

```
어떤 mock 요소에 대해 단언하기 전에:
  질문한다: "지금 내가 테스트하는 것이 실제 컴포넌트 동작인가, 아니면 mock의 존재 자체인가?"

  mock의 존재 자체를 테스트하고 있다면:
    중단한다 - 그 단언을 지우거나 컴포넌트를 unmock한다

  대신 실제 동작을 테스트한다
```

## 안티패턴 2: 프로덕션 코드에 테스트 전용 메서드 넣기

**문제가 되는 예:**
```typescript
// ❌ BAD: destroy() only used in tests
class Session {
  async destroy() {  // Looks like production API!
    await this._workspaceManager?.destroyWorkspace(this.id);
    // ... cleanup
  }
}

// In tests
afterEach(() => session.destroy());
```

**왜 잘못됐는가:**
- 프로덕션 클래스가 테스트 전용 코드로 오염된다
- 실수로 프로덕션에서 호출되면 위험할 수 있다
- YAGNI와 관심사 분리에 어긋난다
- 객체 생명주기와 엔티티 생명주기를 혼동하게 만든다

**올바른 방법:**
```typescript
// ✅ GOOD: Test utilities handle test cleanup
// Session has no destroy() - it's stateless in production

// In test-utils/
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) {
    await workspaceManager.destroyWorkspace(workspace.id);
  }
}

// In tests
afterEach(() => cleanupSession(session));
```

### 게이트 함수

```
BEFORE adding any method to production class:
  Ask: "Is this only used by tests?"

  IF yes:
    STOP - Don't add it
    Put it in test utilities instead

  Ask: "Does this class own this resource's lifecycle?"

  IF no:
    STOP - Wrong class for this method
```

## 안티패턴 3: 이해 없이 Mocking하기

**문제가 되는 예:**
```typescript
// ❌ BAD: Mock breaks test logic
test('detects duplicate server', () => {
  // Mock prevents config write that test depends on!
  vi.mock('ToolCatalog', () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined)
  }));

  await addServer(config);
  await addServer(config);  // Should throw - but won't!
});
```

**왜 잘못됐는가:**
- 테스트가 의존하던 부수 효과(config 쓰기)를 mock한 메서드가 없애 버렸다
- "안전하게" 하려는 과도한 mocking이 실제 동작을 깨뜨린다
- 테스트가 잘못된 이유로 통과하거나, 원인 모르게 실패한다

**올바른 방법:**
```typescript
// ✅ GOOD: Mock at correct level
test('detects duplicate server', () => {
  // Mock the slow part, preserve behavior test needs
  vi.mock('MCPServerManager'); // Just mock slow server startup

  await addServer(config);  // Config written
  await addServer(config);  // Duplicate detected ✓
});
```

### 게이트 함수

```
BEFORE mocking any method:
  STOP - Don't mock yet

  1. Ask: "What side effects does the real method have?"
  2. Ask: "Does this test depend on any of those side effects?"
  3. Ask: "Do I fully understand what this test needs?"

  IF depends on side effects:
    Mock at lower level (the actual slow/external operation)
    OR use test doubles that preserve necessary behavior
    NOT the high-level method the test depends on

  IF unsure what test depends on:
    Run test with real implementation FIRST
    Observe what actually needs to happen
    THEN add minimal mocking at the right level

  Red flags:
    - "I'll mock this to be safe"
    - "This might be slow, better mock it"
    - Mocking without understanding the dependency chain
```

## 안티패턴 4: 불완전한 Mock

**문제가 되는 예:**
```typescript
// ❌ BAD: Partial mock - only fields you think you need
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' }
  // Missing: metadata that downstream code uses
};

// Later: breaks when code accesses response.metadata.requestId
```

**왜 잘못됐는가:**
- **부분적인 mock은 구조적 가정을 숨긴다** - 내가 알고 있는 필드만 mock했다
- **하위 코드가 포함하지 않은 필드에 의존할 수 있다** - 조용히 실패한다
- **테스트는 통과하지만 통합은 실패한다** - mock은 불완전하고 실제 API는 완전하다
- **거짓된 자신감** - 이 테스트는 실제 동작에 대해 아무것도 증명하지 못한다

**철칙:** mock은 현재 테스트에서 바로 쓰는 필드만이 아니라, 현실의 COMPLETE data structure 그대로 만들어야 한다.

**올바른 방법:**
```typescript
// ✅ GOOD: Mirror real API completeness
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  metadata: { requestId: 'req-789', timestamp: 1234567890 }
  // All fields real API returns
};
```

### 게이트 함수

```
BEFORE creating mock responses:
  Check: "What fields does the real API response contain?"

  Actions:
    1. Examine actual API response from docs/examples
    2. Include ALL fields system might consume downstream
    3. Verify mock matches real response schema completely

  Critical:
    If you're creating a mock, you must understand the ENTIRE structure
    Partial mocks fail silently when code depends on omitted fields

  If uncertain: Include all documented fields
```

## 안티패턴 5: 통합 테스트를 나중 일로 미루기

**문제가 되는 예:**
```
✅ Implementation complete
❌ No tests written
"Ready for testing"
```

**왜 잘못됐는가:**
- 테스트는 구현의 일부이지, 선택적인 후속 작업이 아니다
- TDD를 했다면 이런 상황을 더 일찍 잡아냈을 것이다
- 테스트 없이 완료됐다고 주장할 수 없다

**올바른 방법:**
```
TDD cycle:
1. Write failing test
2. Implement to pass
3. Refactor
4. THEN claim complete
```

## Mock이 지나치게 복잡해질 때

**경고 신호:**
- mock 설정이 테스트 로직보다 길다
- 테스트를 통과시키려고 모든 것을 mock하고 있다
- 실제 컴포넌트에는 있는 메서드가 mock에는 없다
- mock이 바뀌면 테스트가 깨진다

**사람 파트너의 질문:** "여기서 정말 mock을 써야 하나요?"

**생각해 볼 점:** 복잡한 mock보다 실제 컴포넌트를 쓰는 통합 테스트가 더 단순한 경우가 많다

## TDD는 이런 안티패턴을 막아준다

**TDD가 도움이 되는 이유:**
1. **먼저 테스트를 쓴다** → 지금 무엇을 테스트하는지 강제로 생각하게 만든다
2. **실패하는 것을 본다** → mock이 아니라 실제 동작을 테스트하고 있음을 확인하게 해준다
3. **최소한으로 구현한다** → 테스트 전용 메서드가 끼어들 틈이 없다
4. **실제 의존성을 본다** → mock하기 전에 테스트에 정말 필요한 것이 무엇인지 알 수 있다

**mock의 동작을 테스트하고 있다면, TDD를 위반한 것이다** - 실제 코드에 대해 먼저 실패하는 테스트를 보지도 않고 mock부터 넣은 것이다.

## 빠른 참고표

| 안티패턴 | 해결 방법 |
|--------------|-----|
| Assert on mock elements | 실제 컴포넌트를 테스트하거나 unmock한다 |
| Test-only methods in production | test utilities로 옮긴다 |
| Mock without understanding | 먼저 의존성을 이해하고, 최소한으로 mock한다 |
| Incomplete mocks | 실제 API를 완전하게 반영한다 |
| Tests as afterthought | TDD - 먼저 테스트를 쓴다 |
| Over-complex mocks | 통합 테스트를 고려한다 |

## 위험 신호

- assertion이 `*-mock` test ID를 검사한다
- 테스트 파일에서만 호출되는 메서드가 있다
- mock 설정이 테스트의 50%를 넘는다
- mock을 제거하면 테스트가 실패한다
- 왜 이 mock이 필요한지 설명할 수 없다
- "안전하게 하려고" mock한다

## 핵심 요약

**Mock은 격리를 위한 도구이지, 테스트 대상이 아니다.**

TDD를 따라가다가 mock의 동작을 테스트하고 있다는 사실이 드러났다면, 이미 잘못된 방향으로 간 것이다.

해결책: 실제 동작을 테스트하거나, 애초에 왜 mock을 쓰고 있는지 다시 점검한다.
