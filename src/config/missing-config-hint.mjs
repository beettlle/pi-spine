// @ts-check
import path from "node:path";

/**
 * Honest missing-config / wrong-cwd hint (FR-REL270-01 / FR-REL270-02 / #202).
 * Single source of truth for message + suggestedCommand when `.spine/spine-config.json`
 * is absent under the resolved project root.
 *
 * @param {string} projectRoot
 * @returns {{ resolvedRoot: string, message: string, suggestedCommand: string }}
 */
export function missingConfigHint(projectRoot) {
	const resolvedRoot = path.resolve(projectRoot);
	return {
		resolvedRoot,
		message: `.spine/spine-config.json not found under ${resolvedRoot} (cwd/$PWD). Change to your project root, or run spine init here if this directory should be initialized.`,
		suggestedCommand: `cd ${resolvedRoot}  # if wrong directory — or run: spine init`,
	};
}
