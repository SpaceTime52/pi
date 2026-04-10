export function buildOverviewPrompt(recentText: string, previous?: { title: string; summary: readonly string[] }): string {
	const previousSection = previous ? [`Previous title: ${previous.title}`, "Previous summary:", ...previous.summary.map((line) => `- ${line}`)].join("\n") : "Previous summary: (none)";
	return [previousSection, "", "Recent conversation updates:", recentText].join("\n");
}
