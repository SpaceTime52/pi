declare module "glimpseui" {
	export interface GlimpseOpenOptions {
		width?: number;
		height?: number;
		title?: string;
	}

	export function getNativeHostInfo(): {
		path: string;
		extraArgs?: string[];
		buildHint?: string;
	};
}
