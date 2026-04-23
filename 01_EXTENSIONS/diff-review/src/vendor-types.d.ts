declare module "glimpseui" {
	export interface GlimpseOpenOptions {
		width?: number;
		height?: number;
		title?: string;
		frameless?: boolean;
		floating?: boolean;
		transparent?: boolean;
		clickThrough?: boolean;
		hidden?: boolean;
		autoClose?: boolean;
		x?: number;
		y?: number;
		cursorOffset?: { x?: number; y?: number };
		cursorAnchor?: string;
		followMode?: string;
		followCursor?: boolean;
	}
}
