/**
 * Shared mock factories for subagent __tests__.
 *
 * Leading-underscore naming excludes this file from the `*.test.ts` glob in
 * package.json (extensions/subagent/__tests__/*.test.ts).
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { mock } from "node:test";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { SubagentDeps } from "../core/deps.js";
import { createStore, type SubagentStore } from "../core/store.js";
import type { AgentConfig, CommandRunState, SingleResult } from "../core/types.js";
import type { SubagentToolExecuteContext } from "../tool/types.js";

// ━━━ ExtensionAPI mock ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MockExtensionAPI {
  sendMessage: ReturnType<typeof mock.fn>;
  sendUserMessage: ReturnType<typeof mock.fn>;
  appendEntry: ReturnType<typeof mock.fn>;
}

/**
 * Create a minimal ExtensionAPI stub with the three methods subagent uses.
 * Returned object is cast to ExtensionAPI at the consumer boundary because
 * it does not implement the full surface (on/registerTool/etc).
 */
export function makeMockPi(): MockExtensionAPI & ExtensionAPI {
  const base = {
    sendMessage: mock.fn(() => undefined),
    sendUserMessage: mock.fn(() => undefined),
    appendEntry: mock.fn(() => undefined),
  };
  return base as unknown as MockExtensionAPI & ExtensionAPI;
}

// ━━━ ExtensionContext mock ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface MockCtxOptions {
  cwd?: string;
  hasUI?: boolean;
  sessionFile?: string | undefined;
  /** onNotify spy to capture ui.notify calls */
  onNotify?: (message: string, type?: string) => void;
}

export function makeMockExtensionCtx(
  options: MockCtxOptions = {},
): SubagentToolExecuteContext & ExtensionContext {
  const onNotify = options.onNotify ?? (() => undefined);
  const setWidget = () => undefined;
  return {
    hasUI: options.hasUI ?? false,
    ui: {
      setWidget,
      select: () => Promise.resolve(undefined),
      confirm: () => Promise.resolve(false),
      input: () => Promise.resolve(undefined),
      notify: (msg: string, type?: "info" | "warning" | "error") => onNotify(msg, type),
      onTerminalInput: () => () => undefined,
      setStatus: () => undefined,
      setWorkingMessage: () => undefined,
      setHiddenThinkingLabel: () => undefined,
      setFooter: () => undefined,
      setTitle: () => undefined,
      custom: () => Promise.resolve(undefined),
      pasteToEditor: () => undefined,
      setEditorText: () => undefined,
      getEditorText: () => "",
      editor: () => Promise.resolve(undefined),
      setEditorComponent: () => undefined,
      setHeader: () => undefined,
      theme: {} as ExtensionContext["ui"]["theme"],
      getAllThemes: () => [],
      getTheme: () => undefined,
      setTheme: () => ({ success: true }),
      getToolsExpanded: () => false,
      setToolsExpanded: () => undefined,
    },
    cwd: options.cwd ?? "/tmp",
    sessionManager: {
      getSessionFile: () => options.sessionFile,
      getEntries: () => [],
      getCwd: () => options.cwd ?? "/tmp",
      getSessionDir: () => "/tmp",
      getSessionId: () => "test-session",
      getLeafId: () => "leaf-id",
      getLeafEntry: () => undefined,
      getEntry: () => undefined,
      getLabel: () => undefined,
      getBranch: () => [],
      getHeader: () => undefined,
      getTree: () => [],
      getSessionName: () => undefined,
    },
    modelRegistry: {
      getAll: () => [],
    } as unknown as ExtensionContext["modelRegistry"],
    model: undefined,
    isIdle: () => true,
    signal: undefined,
    abort: () => undefined,
    hasPendingMessages: () => false,
    shutdown: () => undefined,
    getContextUsage: () => undefined,
    compact: () => undefined,
    getSystemPrompt: () => "",
  } as unknown as SubagentToolExecuteContext & ExtensionContext;
}

// ━━━ SubagentDeps mock ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function makeMockDeps(): SubagentDeps & {
  pi: MockExtensionAPI & ExtensionAPI;
  store: SubagentStore;
} {
  return {
    pi: makeMockPi(),
    store: createStore(),
  };
}

// ━━━ AgentConfig fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function makeMockAgent(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    name: "worker",
    description: "test worker agent",
    systemPrompt: "You are a test worker.",
    source: "project",
    filePath: "/tmp/agents/worker.md",
    ...overrides,
  };
}

export function makeMockAgents(): AgentConfig[] {
  return [
    makeMockAgent({ name: "worker" }),
    makeMockAgent({ name: "reviewer", description: "reviews code" }),
    makeMockAgent({ name: "planner", description: "plans tasks" }),
  ];
}

// ━━━ Agents-dir fixture (on-disk) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Create a temp directory with `.pi/agents/*.md` files that satisfies
 * discoverAgents(cwd). Returns the cwd path to pass to mock ctx.
 *
 * Each agent file has frontmatter with name/description so
 * parseFrontmatter + loadAgentsFromDir pick them up.
 */
export function makeMockAgentsDir(
  agentNames: readonly string[] = ["worker", "reviewer", "planner"],
): { cwd: string; cleanup: () => void } {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "subagent-exec-test-"));
  const agentsDir = path.join(cwd, ".pi", "agents");
  fs.mkdirSync(agentsDir, { recursive: true });
  for (const name of agentNames) {
    const body = `---\nname: ${name}\ndescription: test ${name}\n---\nYou are ${name}.\n`;
    fs.writeFileSync(path.join(agentsDir, `${name}.md`), body);
  }
  return {
    cwd,
    cleanup: () => {
      try {
        fs.rmSync(cwd, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
  };
}

// ━━━ CommandRunState fixtures ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function makeRun(id: number, overrides: Partial<CommandRunState> = {}): CommandRunState {
  return {
    id,
    agent: "worker",
    task: `task-${id}`,
    status: "done",
    startedAt: Date.now() - 1000,
    elapsedMs: 1000,
    toolCalls: 0,
    lastLine: "last line",
    lastOutput: `output-${id}`,
    turnCount: 1,
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

export function makeSingleResult(overrides: Partial<SingleResult> = {}): SingleResult {
  return {
    agent: "worker",
    agentSource: "project",
    task: "test task",
    exitCode: 0,
    messages: [
      {
        role: "assistant",
        content: [{ type: "text", text: "done working" }],
      } as SingleResult["messages"][number],
    ],
    stderr: "",
    usage: {
      input: 10,
      output: 20,
      cacheRead: 0,
      cacheWrite: 0,
      cost: 0,
      contextTokens: 0,
      turns: 1,
    },
    ...overrides,
  };
}

// ━━━ Abort-all helper ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Abort every live run's controller. Useful after integration tests that
 * launched fire-and-forget runs — lets the background subprocess die and
 * the fire-and-forget promise settle.
 */
export function abortAllRuns(store: SubagentStore): void {
  for (const entry of store.globalLiveRuns.values()) {
    try {
      entry.abortController.abort();
    } catch {
      // ignore
    }
  }
}
