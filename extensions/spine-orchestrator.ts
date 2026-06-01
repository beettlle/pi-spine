import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerSpineSlashCommands } from "./spine/slash-commands.ts";

/**
 * pi-spine orchestrator extension (Phase 0).
 * Registers PRD §15.1 slash commands; `/spine` runs batch preflight before batch guidance.
 */
export default function spineOrchestrator(pi: ExtensionAPI): void {
	registerSpineSlashCommands(pi);
}
