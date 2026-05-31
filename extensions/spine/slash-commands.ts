import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";

/** PRD §15.1 slash command names (single `/spine` registration for guide + execute). */
export const SPINE_SLASH_COMMAND_NAMES = [
	"spine",
	"spine-plan",
	"spine-status",
	"spine-pause",
	"spine-resume",
	"spine-abort",
	"spine-gate",
	"spine-integrate",
	"spine-settings",
	"spine-deps",
] as const;

type SpineSlashCommandName = (typeof SPINE_SLASH_COMMAND_NAMES)[number];

interface SpineSlashCommandSpec {
	name: SpineSlashCommandName;
	description: string;
}

const SPINE_SLASH_COMMANDS: SpineSlashCommandSpec[] = [
	{
		name: "spine",
		description:
			"Detect project state; guide or run batch (usage: /spine [all|paths]; batch execution Phase 2+)",
	},
	{
		name: "spine-plan",
		description: "Preview waves and lanes (usage: /spine-plan <all|paths>)",
	},
	{
		name: "spine-status",
		description: "Batch and lane health",
	},
	{
		name: "spine-pause",
		description: "Pause after current tasks",
	},
	{
		name: "spine-resume",
		description: "Resume paused or failed batch (usage: /spine-resume [--force])",
	},
	{
		name: "spine-abort",
		description: "Abort batch (usage: /spine-abort [--hard])",
	},
	{
		name: "spine-gate",
		description: "Gate inspection and resolution (usage: /spine-gate [approve|reject])",
	},
	{
		name: "spine-integrate",
		description: "Merge orch branch after gate (usage: /spine-integrate [--dry-run])",
	},
	{
		name: "spine-settings",
		description: "Interactive configuration",
	},
	{
		name: "spine-deps",
		description: "Show dependency graph (usage: /spine-deps <all|paths>)",
	},
];

function stubHandler(command: string) {
	return async (_args: string, ctx: ExtensionCommandContext): Promise<void> => {
		ctx.ui.notify(
			`/${command} is not implemented yet (Phase 0 stub). Run \`spine help\` for CLI commands; orchestration lands in a future phase.`,
			"info",
		);
	};
}

/** Register all PRD §15.1 pi slash commands with Phase 0 stub handlers. */
export function registerSpineSlashCommands(pi: ExtensionAPI): void {
	for (const { name, description } of SPINE_SLASH_COMMANDS) {
		pi.registerCommand(name, {
			description,
			handler: stubHandler(name),
		});
	}
}
