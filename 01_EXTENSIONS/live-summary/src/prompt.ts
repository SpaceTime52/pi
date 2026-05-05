export const SUMMARY_SYSTEM_PROMPT =
	"You compress a coding-agent session activity log into a tiny Korean status label. Output a single line only.";

export function buildSummaryPrompt(activity: string): string {
	return `다음은 코딩 에이전트 세션의 최근 활동 로그야.
지금 이 세션이 "무슨 일을 하고 있는지" 한국어로 10~18자 이내, 짧은 명사구로 요약해.

규칙:
- 형식: "<이모지 1개> <짧은 한국어 명사구>"
- 예: "🔧 PR 트래커 작성", "🐞 인증 버그 수정", "📚 문서 정리", "🧪 테스트 추가"
- 18자(이모지 포함) 절대 넘기지 말 것
- 따옴표·마침표·설명 금지, 결과만 한 줄

<activity>
${activity}
</activity>`;
}
