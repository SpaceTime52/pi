import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getReviewData: vi.fn(), loadReviewDetail: vi.fn(), buildReviewHtml: vi.fn(), openQuietGlimpse: vi.fn() }));
vi.mock("../lib/git-review-data.ts", () => ({ getReviewData: mocks.getReviewData }));
vi.mock("../lib/git-detail.ts", () => ({ loadReviewDetail: mocks.loadReviewDetail }));
vi.mock("../src/ui.ts", () => ({ buildReviewHtml: mocks.buildReviewHtml }));
vi.mock("../lib/glimpse-window.js", () => ({ openQuietGlimpse: mocks.openQuietGlimpse }));

import registerDiffReview from "../src/diff-review.ts";

class FakeWindow extends EventEmitter { sent: string[] = []; closed = false; send(js: string) { this.sent.push(js); } close() { this.closed = true; this.emit("closed"); } }
function createContext() { const notify = vi.fn(); const pasteToEditor = vi.fn(); const getEditorText = vi.fn(() => "existing"); return { cwd: "/repo", ui: { notify, pasteToEditor, getEditorText } }; }

describe("diff-review behavior", () => {
	beforeEach(() => { vi.resetAllMocks(); mocks.buildReviewHtml.mockReturnValue("<html>"); });

	it("opens the window, serves details, appends feedback, and suppresses duplicates", async () => {
		const registerCommand = vi.fn();
		const on = vi.fn();
		const win = new FakeWindow();
		mocks.getReviewData.mockResolvedValue({ repoRoot: "/repo", baseRef: "origin/main", mergeBase: "base", hasHead: true, files: [{ id: "f1", path: "src/a.ts", status: "modified", oldPath: "src/a.ts", newPath: "src/a.ts", present: true }], commits: [{ sha: "c1", shortSha: "c1", subject: "Commit", author: "me", date: "2024", kind: "commit" }] });
		mocks.loadReviewDetail.mockResolvedValue({ title: "detail", content: "body" });
		mocks.openQuietGlimpse.mockResolvedValue(win);
		registerDiffReview({ exec: vi.fn(), registerCommand, on });
		const handler = registerCommand.mock.calls[0][1].handler;
		const ctx = createContext();
		await handler("", ctx);
		await handler("", ctx);
		win.emit("message", { type: "detail", requestId: "1", tab: "branch", id: "f1" });
		await Promise.resolve();
		win.emit("message", { type: "submit", overallComment: "Overall", comments: [{ tab: "branch", id: "f1", label: "src/a.ts", body: "Fix this" }] });
		expect(ctx.ui.notify).toHaveBeenCalledWith("A diff review window is already open.", "warning");
		expect(ctx.ui.pasteToEditor).toHaveBeenCalledWith("\n\nPlease address the following diff review feedback\n\nOverall\n\n1. [branch diff] src/a.ts\n   Fix this");
		expect(win.sent[0]).toContain("detail-data");
	});

	it("handles cancel, empty reviews, errors, and shutdown", async () => {
		const registerCommand = vi.fn();
		const on = vi.fn();
		const win = new FakeWindow();
		mocks.getReviewData.mockResolvedValueOnce({ repoRoot: "/repo", baseRef: null, mergeBase: null, hasHead: true, files: [], commits: [] });
		mocks.getReviewData.mockResolvedValueOnce({ repoRoot: "/repo", baseRef: null, mergeBase: null, hasHead: true, files: [{ id: "f1", path: "src/a.ts", status: "modified", oldPath: "src/a.ts", newPath: "src/a.ts", present: true }], commits: [] });
		mocks.openQuietGlimpse.mockResolvedValue(win);
		mocks.loadReviewDetail.mockRejectedValue(new Error("boom"));
		registerDiffReview({ exec: vi.fn(), registerCommand, on });
		const handler = registerCommand.mock.calls[0][1].handler;
		const shutdown = on.mock.calls[0][1];
		const ctx = createContext();
		await handler("", ctx);
		await handler("", ctx);
		win.emit("message", { type: "detail", requestId: "1", tab: "branch", id: "f1" });
		await Promise.resolve();
		win.emit("message", { type: "cancel" });
		win.emit("message", { type: "submit", overallComment: "", comments: [] });
		win.emit("error", new Error("window failed"));
		await shutdown({}, ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("No reviewable changes found.", "info");
		expect(ctx.ui.notify).toHaveBeenCalledWith("Diff review cancelled.", "info");
		expect(ctx.ui.notify).toHaveBeenCalledWith("Diff review failed: window failed", "error");
		expect(win.closed).toBe(true);
	});

	it("reports command startup failures", async () => {
		const registerCommand = vi.fn();
		const on = vi.fn();
		const ctx = createContext();
		mocks.getReviewData.mockRejectedValue(new Error("boom"));
		registerDiffReview({ exec: vi.fn(), registerCommand, on });
		await registerCommand.mock.calls[0][1].handler("", ctx);
		expect(ctx.ui.notify).toHaveBeenCalledWith("Diff review failed: boom", "error");
	});
});
