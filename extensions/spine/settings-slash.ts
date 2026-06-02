import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Run /spine-settings — menu of editable fields or inline set (FR-CFG-03). */
export async function runSpineSettingsSlash(
	args: string,
	ctx: ExtensionCommandContext,
): Promise<void> {
	const { runSpineSettingsSlash: run } = await import(
		path.join(PACKAGE_ROOT, "src/cli/settings-slash.mjs")
	);
	await run(args, {
		notify(message: string, level: string) {
			ctx.ui.notify(message, level as "info" | "error" | "warning");
		},
	});
}
