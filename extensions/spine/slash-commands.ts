import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

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
			"Detect project state; guide or run batch (usage: /spine [all|paths]; batch execution Phase 2+) ",
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

function runSpinePreflight(cwd = process.cwd()) {
	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "preflight"],
		{
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	return {
		ok: result.status === 0,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
	};
}

function runSpinePlan(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine-plan.mjs"), ...tokens],
		{
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	return {
		ok: result.status === 0,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
	};
}

function runSpineStatus(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "status", ...tokens],
		{
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		},
	);

	return {
		ok: result.status === 0,
		output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
	};
}

function stubHandler(command: string) {
	return async (_args: string, ctx: ExtensionCommandContext): Promise<void> => {
		ctx.ui.notify(
			`/${command} is not implemented yet (Phase 0 stub). Run \`spine help\` for CLI commands; orchestration lands in a future phase.`,
			"info",
		);
	};
}

async function spineEntryHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const scope = args.trim();
	const preflight = runSpinePreflight();

	if (!preflight.ok) {
		ctx.ui.notify(
			`Batch preflight failed — fix issues before starting a batch.

${preflight.output}

Run \`spine preflight\` for details.`,
			"error",
		);
		return;
	}

	if (scope === "all" || scope.length > 0) {
		ctx.ui.notify(
			`Preflight passed. Batch execution for \`/spine ${scope || "all"}\` lands in Phase 2+ — run \`spine preflight\` before every batch.`,
			"info",
		);
		return;
	}

	ctx.ui.notify(
		"Preflight passed. Run `/spine all` after `spine preflight` when the batch engine is available (Phase 2+).",
		"info",
	);
}

async function spinePlanHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const preflight = runSpinePreflight();
	if (!preflight.ok) {
		ctx.ui.notify(
			`Batch preflight failed — fix issues before planning.

${preflight.output}
`,
			"error",
		);
		return;
	}

	const plan = runSpinePlan(args);
	if (!plan.ok) {
		ctx.ui.notify(plan.output || "spine plan failed", "error");
		return;
	}

	ctx.ui.notify(plan.output || "plan generated", "info");
}

async function spineStatusHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const status = runSpineStatus(args);
	if (!status.ok) {
		ctx.ui.notify(status.output || "spine status failed", "error");
		return;
	}

	ctx.ui.notify(status.output || "status unavailable", "info");
}

/** Register all PRD §15.1 pi slash commands with Phase 0 stub handlers. */
export function registerSpineSlashCommands(pi: ExtensionAPI): void {
	for (const { name, description } of SPINE_SLASH_COMMANDS) {
		pi.registerCommand(name, {
			description,
			handler:
				name === "spine"
					? spineEntryHandler
					: name === "spine-plan"
						? spinePlanHandler
						: name === "spine-status"
							? spineStatusHandler
							: stubHandler(name),
		});
	}
}
