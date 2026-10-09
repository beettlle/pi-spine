/**
 * Minimal ambient types for `picomatch` (SP-817).
 *
 * Upstream picomatch ships no type declarations and `@types/picomatch` is not
 * installed, so checked batch programs (`tsconfig.batch.json`) would fail with
 * TS7016 on import. Only the API surface used by `src/` is declared; widen it
 * if more of the library is adopted.
 */
declare module "picomatch" {
	/**
	 * Compiles the given glob pattern(s) into a matcher function.
	 *
	 * @param {string | readonly string[]} glob
	 * @param {object} [options]
	 * @returns {(input: string) => boolean}
	 */
	function picomatch(glob: string | readonly string[], options?: { dot?: boolean }): (input: string) => boolean;

	export default picomatch;
}
