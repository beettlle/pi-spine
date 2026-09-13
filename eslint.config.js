import globals from "globals";

/** Baseline ESLint flat config — scoped dirs only; no aggressive style rules. */
export default [
	{
		name: "pi-spine/baseline-ignores",
		ignores: ["node_modules/**", ".worktrees/**"],
	},
	{
		name: "pi-spine/mjs-source",
		files: ["src/**/*.mjs", "bin/**/*.mjs", "tests/**/*.mjs", "scripts/**/*.mjs"],
		languageOptions: {
			// "latest" follows the ESLint 10 recommendation; runtime floor is Node >= 22.19.
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.node,
			},
		},
		rules: {
			"no-unused-vars": [
				"warn",
				{
					argsIgnorePattern: "^_",
					caughtErrorsIgnorePattern: "^_",
					varsIgnorePattern: "^_",
				},
			],
			"no-undef": "error",
			eqeqeq: ["error", "always", { null: "ignore" }],
			"no-throw-literal": "error",
			"prefer-const": "error",
			"no-var": "error",
			"no-async-promise-executor": "error",
		},
	},
];
