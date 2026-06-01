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
	"spine-dismiss",
	"spine-next",
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
			"Detect project state; run batch (usage: /spine <task-id>; single-task Phase 2) ",
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
	{
		name: "spine-dismiss",
		description: "Archive and clear limbo/stale active batch (usage: /spine-dismiss [--reason])",
	},
	{
		name: "spine-next",
		description: "Print suggested next command from reconciliation",
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

function runSpineBatchDismiss(argsText: string, cwd = process.cwd()) {
	const tokens = ["dismiss", ...String(argsText ?? "").trim().split(/\s+/).filter(Boolean)];

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "batch", ...tokens],
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

function runSpineNext(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "next", ...tokens],
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
	const status = runSpineStatus("--json");
	let reconciliation: {
		diagnosis?: string | null;
		headline?: string;
		suggestedCommand?: string;
		alternatives?: string[];
	} = {};

	if (status.ok && status.output) {
		try {
			reconciliation = JSON.parse(status.output) as typeof reconciliation;
		} catch {
			// fall through to preflight guidance
		}
	}

	const diagnosis = reconciliation.diagnosis ?? null;

	if (diagnosis === "limbo_stale" || diagnosis === "completed_manual") {
		ctx.ui.notify(
			`${reconciliation.headline ?? "Batch is in limbo"}

→ ${reconciliation.suggestedCommand ?? "spine batch dismiss"}

Never pause a terminal limbo batch — dismiss or complete to clear active state.`,
			"warning",
		);
		return;
	}

	if (
		diagnosis === "needs_retry" ||
		diagnosis === "needs_merge" ||
		diagnosis === "needs_integrate" ||
		diagnosis === "running" ||
		diagnosis === "paused" ||
		diagnosis === "failed" ||
		diagnosis === "aborted"
	) {
		ctx.ui.notify(
			`${reconciliation.headline ?? "Active batch requires attention"}

→ ${reconciliation.suggestedCommand ?? "spine status --diagnose"}`,
			diagnosis === "running" ? "info" : "warning",
		);
		return;
	}

	if (diagnosis === "completed") {
		ctx.ui.notify(
			`${reconciliation.headline ?? "Batch completed"}

→ ${reconciliation.suggestedCommand ?? "spine preflight"}`,
			"info",
		);
		return;
	}

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
		const startScope = scope === "all" ? "all" : scope;
		const startResult = spawnSync(
			process.execPath,
			[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "batch", "start", startScope],
			{
				cwd: process.cwd(),
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env, SPINE_WORKER_STUB: process.env.SPINE_WORKER_STUB ?? "1" },
			},
		);
		const output = `${startResult.stdout ?? ""}${startResult.stderr ?? ""}`.trim();
		ctx.ui.notify(
			startResult.status === 0
				? output || `Batch start succeeded for scope: ${startScope}`
				: `Batch start failed:\n\n${output}`,
			startResult.status === 0 ? "info" : "error",
		);
		return;
	}

	ctx.ui.notify(
		`${reconciliation.headline ?? "No active batch — ready to plan or start"}

→ ${reconciliation.suggestedCommand ?? "spine preflight"}

Run \`/spine <task-id>\` or \`/spine all\` after preflight (single-task batches only in Phase 2).`,
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

async function spineDismissHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineBatchDismiss(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch dismiss failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "batch dismissed", "info");
}

async function spineNextHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineNext(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine next failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "no next action", "info");
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
							: name === "spine-dismiss"
								? spineDismissHandler
								: name === "spine-next"
									? spineNextHandler
									: stubHandler(name),
		});
	}
}
