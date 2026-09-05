/**
 * Minimal ambient types for `micromatch` (SP-750).
 *
 * Upstream micromatch ships no type declarations and `@types/micromatch` is not
 * installed, so checked batch programs (`tsconfig.batch.json`) would fail with
 * TS7016 on import. Only the API surface used by `src/` is declared; widen it
 * if more of the library is adopted.
 */
declare module "micromatch" {
	const micromatch: {
		/**
		 * Returns true if the value matches any of the given glob patterns.
		 *
		 * @param {string | readonly string[]} str
		 * @param {string | readonly string[]} patterns
		 * @param {object} [options]
		 * @returns {boolean}
		 */
		isMatch(str: string | readonly string[], patterns: string | readonly string[], options?: object): boolean;
	};

	export default micromatch;
}
