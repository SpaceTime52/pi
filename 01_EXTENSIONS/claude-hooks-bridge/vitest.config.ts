import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		coverage: {
			include: ["src/constants.ts"],
			exclude: ["src/index.ts"],
			thresholds: { lines: 100, branches: 100, functions: 100, statements: 100 },
		},
	},
});
