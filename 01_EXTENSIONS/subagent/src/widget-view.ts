import { truncateToWidth } from "@mariozechner/pi-tui";
import { formatDuration, previewText } from "./format.js";
import { formatRunTrees } from "./run-tree.js";
import { getActivity, getLastEventTime, getNestedRuns } from "./widget-state.js";
import type { NestedRunSnapshot, RunStatus, RunTree } from "./types.js";

const VISIBLE_ROOTS = 3, SCROLL_FRAMES_PER_STEP = 10, IDLE_MS = 120_000, SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
type WidgetTone = "accent" | "warning" | "muted" | "dim";
export interface MinimalRun { id: number; agent: string; task?: string; startedAt: number }
export interface CompletedRun { id: number; agent: string; task?: string; startedAt: number; finishedAt: number; status: RunStatus; summary?: string; runTrees?: RunTree[] }
export interface MinimalTheme { fg(color: WidgetTone, text: string): string }
export interface MinimalWidget { render(width: number): string[]; invalidate(): void }
interface Entry { text: string; depth: number; idle: boolean; meta?: boolean; status?: RunStatus }
interface DisplayRun extends MinimalRun { depth: number; activity?: string; lastEventAt?: number }

const offset = (runs: NestedRunSnapshot[], depth: number) => runs.map((run) => ({ ...run, depth: run.depth + depth }));
const snapshots = (run: MinimalRun): NestedRunSnapshot[] => [{
	id: run.id, agent: run.agent, task: run.task, startedAt: run.startedAt, depth: 1,
	activity: getActivity(run.id), lastEventAt: getLastEventTime(run.id),
}, ...offset(getNestedRuns(run.id), 1)];
const visibleRoots = (runs: MinimalRun[], frame: number) => runs.length <= VISIBLE_ROOTS ? runs
	: Array.from({ length: VISIBLE_ROOTS }, (_, i) => runs[(Math.floor(frame / SCROLL_FRAMES_PER_STEP) + i) % runs.length]!).filter(Boolean);

function display(run: DisplayRun, now: number, spin: string): Entry {
	const last = run.depth > 0 ? (run.lastEventAt ?? run.startedAt) : (run.lastEventAt ?? getLastEventTime(run.id) ?? run.startedAt);
	const idle = now - last > IDLE_MS, branch = run.depth > 0 ? `${"  ".repeat(run.depth - 1)}↳ ` : "";
	const activity = run.depth > 0 ? run.activity : (run.activity ?? getActivity(run.id));
	const task = run.task ? ` — ${previewText(run.task, 28)}` : "", prefix = idle ? "⏸" : spin;
	const suffix = idle ? ` idle ${formatDuration(now - last)}` : activity ? ` → ${activity}` : "";
	return { text: `${branch}${prefix} ${run.agent} #${run.id}${task} (${formatDuration(now - run.startedAt)})${suffix}`, depth: run.depth, idle };
}

function entries(runs: MinimalRun[], now: number, frame: number): Entry[] {
	const roots = visibleRoots(runs, frame), spin = SPINNER[frame % SPINNER.length];
	const shown = roots.flatMap((run) => [{ ...run, depth: 0, activity: getActivity(run.id), lastEventAt: getLastEventTime(run.id) }, ...getNestedRuns(run.id)]);
	const info = runs.length <= VISIBLE_ROOTS || roots.length === 0 ? undefined
		: { text: `⇅ roots ${roots.map((_, i) => ((runs.findIndex((run) => run.id === roots[0]?.id) + i) % runs.length) + 1).join(",")} / ${runs.length}`, depth: 0, idle: false, meta: true };
	return [...shown.map((run) => display(run, now, spin)), ...(info ? [info] : [])];
}

function tone(entry: Entry): WidgetTone {
	if (entry.meta) return "dim";
	if (entry.status) return entry.status === "ok" ? "accent" : "warning";
	if (entry.idle) return entry.depth === 0 ? "warning" : "dim";
	return entry.depth === 0 ? "accent" : entry.depth === 1 ? "muted" : "dim";
}

function completedIcon(status: RunStatus): string {
	if (status === "error") return "✗";
	if (status === "escalation") return "⚠";
	return "✓";
}

function completedSummary(run: CompletedRun): string {
	return run.summary ? ` — ${previewText(run.summary, 36)}` : "";
}

function completedEntries(run: CompletedRun): Entry[] {
	const task = run.task ? ` — ${previewText(run.task, 28)}` : "";
	const lines: Entry[] = [{
		text: `${completedIcon(run.status)} ${run.agent} #${run.id}${task} (${formatDuration(Math.max(0, run.finishedAt - run.startedAt))})${completedSummary(run)}`,
		depth: 0,
		idle: false,
		status: run.status,
	}];
	for (const line of formatRunTrees(run.runTrees).slice(0, 4)) lines.push({ text: `  ${line}`, depth: 1, idle: false });
	return lines;
}

export const buildNestedRunSnapshots = (runs: MinimalRun[]) => runs.flatMap(snapshots);
export const buildNestedRunSnapshotsForRun = (run: MinimalRun | undefined) => run ? snapshots(run) : [];
export const buildWidgetLinesWithFrame = (runs: MinimalRun[], now: number, frame: number) => entries(runs, now, frame).map((entry) => entry.text);
export const buildCompletedWidgetLines = (run: CompletedRun) => completedEntries(run).map((entry) => entry.text);

export function buildWidgetComponent(runs: MinimalRun[], now: number, frame: number) {
	const rendered = entries(runs, now, frame);
	return (_tui: unknown, theme: MinimalTheme): MinimalWidget => ({
		render(width: number) { return rendered.map((entry) => truncateToWidth(theme.fg(tone(entry), entry.text), Math.max(0, width))); },
		invalidate() {},
	});
}

export function buildCompletedWidgetComponent(run: CompletedRun) {
	const rendered = completedEntries(run);
	return (_tui: unknown, theme: MinimalTheme): MinimalWidget => ({
		render(width: number) { return rendered.map((entry) => truncateToWidth(theme.fg(tone(entry), entry.text), Math.max(0, width))); },
		invalidate() {},
	});
}
