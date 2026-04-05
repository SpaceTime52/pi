/**
 * Shared helpers for subagent __tests__.
 *
 * This file is intentionally named with a leading underscore so that the
 * `*.test.ts` test glob in package.json (extensions/subagent/__tests__/*.test.ts)
 * does not pick it up as a test file.
 */

import type { mock } from "node:test";

type NodeTestMockFn = ReturnType<typeof mock.fn>;

/**
 * Cast a mocked function to the node:test MockFn shape so callers can access
 * `.mock.calls`, `.mock.callCount()`, etc. without repeating inline casts.
 */
export function asMock(fn: unknown): NodeTestMockFn {
  return fn as unknown as NodeTestMockFn;
}
