// src/index.ts
import path from "node:path";

// src/actor-detection.ts
function asRecord(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return void 0;
  return value;
}
function unique(values) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}
function unquoteToken(token) {
  const trimmed = token?.trim().replace(/^["']|["']$/g, "").trim();
  return trimmed === "" ? void 0 : trimmed;
}
function readStringField(record, keys) {
  if (!record) return void 0;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return void 0;
}
function readStringArrayField(record, keys) {
  if (!record) return [];
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    return value.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
  }
  return [];
}
function inferActorsFromSubagentCommand(command) {
  const actors = [];
  const flagPattern = /(?:^|\s)--agent(?:=|\s+)(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  for (const match of command.matchAll(flagPattern)) {
    const actor = unquoteToken(match[1] ?? match[2] ?? match[3]);
    if (actor) actors.push(actor);
  }
  const runPattern = /(?:^|\s)subagent\s+(?:run|continue)\s+(?:--[^\s]+\s+)*([^\s]+)/;
  const runMatch = command.match(runPattern);
  const firstRunToken = unquoteToken(runMatch?.[1]);
  if (firstRunToken && !firstRunToken.startsWith("-") && !/^\d+$/.test(firstRunToken)) {
    actors.push(firstRunToken);
  }
  if (actors.length === 0 && /(?:^|\s)subagent\s+run(?:\s|$)/.test(command)) {
    actors.push("worker");
  }
  return unique(actors);
}
function inferActorsFromTool(toolName, args) {
  const lowerName = toolName.toLowerCase();
  const record = asRecord(args);
  if (lowerName === "subagent") {
    const command = readStringField(record, ["command"]);
    if (command) return inferActorsFromSubagentCommand(command);
    return unique([
      ...readStringArrayField(record, ["agents", "agentTypes", "agent_types"]),
      readStringField(record, ["agent", "subagent_type", "subagentType"]) ?? ""
    ]);
  }
  if (lowerName === "agent") {
    return unique([readStringField(record, ["subagent_type", "subagentType", "agent", "agentType"]) ?? ""]);
  }
  if (lowerName === "taskexecute" || lowerName === "task_execute") {
    return ["task agents"];
  }
  return [];
}

// src/format.ts
var MAIN_AGENT = "main assistant";
function formatActorList(actors) {
  if (actors.length <= 2) return actors.join(", ");
  return `${actors[0]}, ${actors[1]} +${actors.length - 2}`;
}
function getPlainStatusText(state) {
  const actorText = `agent: ${state.actor}`;
  const via = state.contributors.filter((actor) => actor !== MAIN_AGENT);
  const viaText = via.length > 0 ? ` \xB7 via ${formatActorList(via)}` : "";
  const detailText = state.detail ? ` \xB7 ${state.detail}` : "";
  if (state.phase === "idle") return `${actorText} \xB7 idle${viaText}`;
  if (state.phase === "done") return `\u2713 ${actorText} \xB7 done${viaText}`;
  if (state.phase === "delegating") return `${actorText}${detailText || " \xB7 delegated"}`;
  if (state.phase === "using-tool") return `${actorText}${detailText}`;
  return `${actorText} \xB7 preparing`;
}

// src/index.ts
var STATUS_KEY = "agent-attribution";
var TITLE_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
function getBaseTitle(pi, ctx) {
  const cwdName = path.basename(ctx.cwd || process.cwd()) || "workspace";
  const sessionName = pi.getSessionName();
  return sessionName ? `\u03C0 ${sessionName} \xB7 ${cwdName}` : `\u03C0 ${cwdName}`;
}
function getStatusText(ctx, state) {
  const theme = ctx.ui.theme;
  const plainText = getPlainStatusText(state);
  if (state.phase === "idle") return theme.fg("dim", plainText);
  if (state.phase === "done") return theme.fg("success", "\u2713 ") + theme.fg("dim", plainText.slice(2));
  return theme.fg("accent", `agent: ${state.actor}`) + theme.fg("dim", plainText.replace(`agent: ${state.actor}`, ""));
}
function index_default(pi) {
  let titleTimer;
  let titleFrame = 0;
  let currentState = {
    phase: "idle",
    actor: MAIN_AGENT,
    contributors: [MAIN_AGENT]
  };
  const activeToolActors = /* @__PURE__ */ new Map();
  const turnContributors = /* @__PURE__ */ new Set([MAIN_AGENT]);
  function stopTitleAnimation(ctx, titleActor = currentState.actor) {
    if (titleTimer) {
      clearInterval(titleTimer);
      titleTimer = void 0;
    }
    titleFrame = 0;
    if (ctx.hasUI) ctx.ui.setTitle(`${getBaseTitle(pi, ctx)} \xB7 ${titleActor}`);
  }
  function startTitleAnimation(ctx, label) {
    stopTitleAnimation(ctx);
    if (!ctx.hasUI) return;
    titleTimer = setInterval(() => {
      const frame = TITLE_FRAMES[titleFrame % TITLE_FRAMES.length];
      ctx.ui.setTitle(`${frame} ${label} \xB7 ${getBaseTitle(pi, ctx)}`);
      titleFrame++;
    }, 100);
  }
  function render(ctx, nextState) {
    currentState = nextState;
    if (!ctx.hasUI) return;
    ctx.ui.setStatus(STATUS_KEY, getStatusText(ctx, nextState));
  }
  function renderIdle(ctx, phase = "idle") {
    const nextState = {
      phase,
      actor: MAIN_AGENT,
      contributors: unique([...turnContributors])
    };
    stopTitleAnimation(ctx, nextState.actor);
    render(ctx, nextState);
  }
  pi.on("session_start", async (_event, ctx) => {
    turnContributors.clear();
    turnContributors.add(MAIN_AGENT);
    renderIdle(ctx);
  });
  pi.on("agent_start", async (_event, ctx) => {
    activeToolActors.clear();
    turnContributors.clear();
    turnContributors.add(MAIN_AGENT);
    render(ctx, {
      phase: "working",
      actor: MAIN_AGENT,
      contributors: unique([...turnContributors])
    });
    startTitleAnimation(ctx, MAIN_AGENT);
  });
  pi.on("tool_execution_start", async (event, ctx) => {
    const actors = inferActorsFromTool(event.toolName, event.args);
    if (actors.length > 0) {
      activeToolActors.set(event.toolCallId, actors);
      for (const actor of actors) turnContributors.add(actor);
      const actorLabel = formatActorList(actors);
      render(ctx, {
        phase: "delegating",
        actor: actorLabel,
        detail: `from ${MAIN_AGENT}`,
        contributors: unique([...turnContributors])
      });
      startTitleAnimation(ctx, actorLabel);
      return;
    }
    render(ctx, {
      phase: "using-tool",
      actor: MAIN_AGENT,
      detail: `using ${event.toolName}`,
      contributors: unique([...turnContributors])
    });
  });
  pi.on("tool_execution_end", async (event, ctx) => {
    activeToolActors.delete(event.toolCallId);
    const remainingActors = unique([...activeToolActors.values()].flat());
    if (remainingActors.length > 0) {
      const actorLabel = formatActorList(remainingActors);
      render(ctx, {
        phase: "delegating",
        actor: actorLabel,
        detail: `from ${MAIN_AGENT}`,
        contributors: unique([...turnContributors])
      });
      startTitleAnimation(ctx, actorLabel);
      return;
    }
    render(ctx, {
      phase: "working",
      actor: MAIN_AGENT,
      contributors: unique([...turnContributors])
    });
    startTitleAnimation(ctx, MAIN_AGENT);
  });
  pi.on("agent_end", async (_event, ctx) => {
    renderIdle(ctx, "done");
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    stopTitleAnimation(ctx);
    if (ctx.hasUI) ctx.ui.setStatus(STATUS_KEY, void 0);
  });
  pi.registerCommand("agent-attribution", {
    description: "Show which agent is currently preparing or contributed to the current Pi turn",
    handler: async (_args, ctx) => {
      render(ctx, currentState);
      ctx.ui.notify(getPlainStatusText(currentState), "info");
    }
  });
}
export {
  index_default as default
};
