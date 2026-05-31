import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSpineSlashCommands } from "./spine/slash-commands.ts";

/**
 * pi-spine orchestrator extension (Phase 0).
 * Registers PRD §15.1 slash command stubs; batch engine lands in later phases.
 */
export default function spineOrchestrator(pi: ExtensionAPI): void {
	registerSpineSlashCommands(pi);
}
