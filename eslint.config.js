import globals from "globals";

/** Baseline ESLint flat config — scoped dirs only; no aggressive style rules. */
export default [
	{
		ignores: ["node_modules/**", ".worktrees/**"],
	},
	{
		files: ["src/**/*.mjs", "bin/**/*.mjs", "tests/**/*.mjs", "scripts/**/*.mjs"],
		languageOptions: {
			ecmaVersion: 2022,
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
