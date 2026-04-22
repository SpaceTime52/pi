import type { Theme } from "@mariozechner/pi-coding-agent";

export const theme = {
	fg: (token: string, text: string) => `<${token}>${text}</${token}>`,
	bg: (token: string, text: string) => `<bg:${token}>${text}</bg:${token}>`,
	bold: (text: string) => `*${text}*`,
} as Theme;

export function render(component: { render(width: number): string[] }, width = 120) {
	return component.render(width).join("\n");
}
