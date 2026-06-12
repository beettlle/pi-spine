import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runSpineSettingsSlash } from "./settings-slash.ts";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** PRD §15.1 slash command names (single `/spine` registration for guide + execute). */
export const SPINE_SLASH_COMMAND_NAMES = [
	"spine",
	"spine-plan",
	"spine-status",
	"spine-pause",
	"spine-resume",
	"spine-retry-task",
	"spine-skip-task",
	"spine-abort",
	"spine-gate",
	"spine-integrate",
	"spine-settings",
	"spine-deps",
	"spine-dismiss",
	"spine-next",
	"spine-dashboard",
	"spine-validate",
	"spine-handoff",
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
			"Detect project state; run batch (usage: /spine <task-id|pending|all>; pending = unfinished tasks) ",
	},
	{
		name: "spine-plan",
		description: "Preview waves and lanes (usage: /spine-plan <all|pending|paths>)",
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
		name: "spine-retry-task",
		description: "Atomically retry a failed task (usage: /spine-retry-task <taskId>)",
	},
	{
		name: "spine-skip-task",
		description: "Skip a failed task and unblock merge (usage: /spine-skip-task <taskId>)",
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
	{
		name: "spine-dashboard",
		description: "Start local dashboard (usage: /spine-dashboard [--port N])",
	},
	{
		name: "spine-validate",
		description: "Validate task PROMPT packets (usage: /spine-validate [pending|all|task-id])",
	},
	{
		name: "spine-handoff",
		description: "Write operator handoff note (usage: /spine-handoff [--batch ID])",
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

function runSpineDeps(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine-deps.mjs"), ...tokens],
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

function runSpineBatchAbort(argsText: string, cwd = process.cwd()) {
	const tokens = ["abort", ...String(argsText ?? "").trim().split(/\s+/).filter(Boolean)];

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

function runSpineBatchPauseResume(
	subcommand: "pause" | "resume",
	argsText: string,
	cwd = process.cwd(),
) {
	const tokens = [subcommand, ...String(argsText ?? "").trim().split(/\s+/).filter(Boolean)];

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

function runSpineBatchRetrySkip(
	subcommand: "retry" | "skip",
	argsText: string,
	cwd = process.cwd(),
) {
	const tokens = [subcommand, ...String(argsText ?? "").trim().split(/\s+/).filter(Boolean)];

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

function runSpineGate(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "gate", ...tokens],
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

function runSpineIntegrate(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "integrate", ...tokens],
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

function runSpineTasksValidate(argsText: string, cwd = process.cwd()) {
	const scope = String(argsText ?? "").trim() || "pending";
	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "tasks", "validate", scope],
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

function runSpineHandoff(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const result = spawnSync(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "handoff", ...tokens],
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

function runSpineDashboardDetached(argsText: string, cwd = process.cwd()) {
	const tokens = String(argsText ?? "")
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	const child = spawn(
		process.execPath,
		[path.join(PACKAGE_ROOT, "bin/spine.mjs"), "dashboard", ...tokens],
		{
			cwd,
			detached: true,
			stdio: "ignore",
		},
	);
	child.unref();
	return { ok: true };
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

async function maybeAutoWriteHandoffOnSessionStart(diagnosis: string | null): Promise<void> {
	let autoWriteOn: string[] = [];
	try {
		const { loadSpineConfig } = await import(path.join(PACKAGE_ROOT, "bin/spine-config.mjs"));
		const loaded = loadSpineConfig(process.cwd());
		if (loaded.error || !loaded.config) return;
		autoWriteOn = loaded.config.handoff?.autoWriteOn ?? [];
	} catch {
		return;
	}
	if (!autoWriteOn.includes("session_start")) return;

	const activeDiagnoses = new Set([
		"running",
		"paused",
		"needs_retry",
		"worker_orphaned",
		"engine_orphaned",
		"state_drift",
		"needs_merge",
		"needs_integrate",
		"needs_replan",
		"failed",
	]);
	if (!diagnosis || !activeDiagnoses.has(diagnosis)) return;

	runSpineHandoff("");
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

	await maybeAutoWriteHandoffOnSessionStart(diagnosis);

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

Run \`/spine pending\`, \`/spine all\` (pending-filtered), or \`/spine <task-id>\` after preflight. CLI alias: \`spine run pending\`.`,
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

async function spinePauseHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineBatchPauseResume("pause", args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch pause failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "batch paused", "info");
}

async function spineResumeHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineBatchPauseResume("resume", args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch resume failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "batch resumed", "info");
}

async function spineRetryTaskHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const taskId = args.trim();
	if (!taskId) {
		ctx.ui.notify("Usage: /spine-retry-task <taskId>", "error");
		return;
	}

	const result = runSpineBatchRetrySkip("retry", taskId);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch retry failed", "error");
		return;
	}

	ctx.ui.notify(result.output || `task ${taskId} reset for retry`, "info");
}

async function spineAbortHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineBatchAbort(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch abort failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "batch aborted", "info");
}

async function spineSkipTaskHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const taskId = args.trim();
	if (!taskId) {
		ctx.ui.notify("Usage: /spine-skip-task <taskId>", "error");
		return;
	}

	const result = runSpineBatchRetrySkip("skip", taskId);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine batch skip failed", "error");
		return;
	}

	ctx.ui.notify(result.output || `task ${taskId} skipped`, "info");
}

async function spineNextHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineNext(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine next failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "no next action", "info");
}

async function spineValidateHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineTasksValidate(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine tasks validate failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "task PROMPT packets valid", "info");
}

async function spineHandoffHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineHandoff(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine handoff failed", "error");
		return;
	}

	const { recordHandoffWritten } = await import(
		path.join(PACKAGE_ROOT, "src/batch/journal.mjs")
	);
	const status = runSpineStatus("--json");
	if (status.ok && status.output) {
		try {
			const reconciliation = JSON.parse(status.output) as {
				batchId?: string | null;
				diagnosis?: string | null;
			};
			if (reconciliation.batchId) {
				recordHandoffWritten(process.cwd(), reconciliation.batchId, {
					handoffPath: ".spine/handoff.md",
					diagnosis: reconciliation.diagnosis ?? "unknown",
					batchId: reconciliation.batchId,
				});
			}
		} catch {
			// handoff file still written; journal event is best-effort
		}
	}

	ctx.ui.notify(result.output || "handoff written", "info");
}

async function spineGateHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineGate(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine gate failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "gate updated", "info");
}

async function spineIntegrateHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const result = runSpineIntegrate(args);
	if (!result.ok) {
		ctx.ui.notify(result.output || "spine integrate failed", "error");
		return;
	}

	ctx.ui.notify(result.output || "integrate completed", "info");
}

async function spineSettingsHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	await runSpineSettingsSlash(args, ctx);
}

async function spineDepsHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const scope = args.trim() || "all";
	const deps = runSpineDeps(scope);
	if (!deps.ok) {
		ctx.ui.notify(deps.output || "spine deps failed", "error");
		return;
	}

	const maxChars = 8000;
	const output =
		deps.output.length > maxChars
			? `${deps.output.slice(0, maxChars)}\n\n… (truncated; run \`spine deps ${scope}\` for full output)`
			: deps.output;

	ctx.ui.notify(output || "dependency graph unavailable", "info");
}

async function spineDashboardHandler(args: string, ctx: ExtensionCommandContext): Promise<void> {
	const { resolveDashboardPortWithSource, formatDashboardNotifyMessage, DEFAULT_DASHBOARD_HOST } =
		await import(path.join(PACKAGE_ROOT, "bin/spine-dashboard.mjs"));

	const portMatch = args.match(/--port\s+(\d+)/);
	const cliPort = portMatch ? Number(portMatch[1]) : undefined;
	const { port, portSource } = resolveDashboardPortWithSource(process.cwd(), cliPort);

	runSpineDashboardDetached(args);
	ctx.ui.notify(
		formatDashboardNotifyMessage({ host: DEFAULT_DASHBOARD_HOST, port, portSource }),
		"info",
	);
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
									: name === "spine-pause"
										? spinePauseHandler
										: name === "spine-resume"
											? spineResumeHandler
											: name === "spine-retry-task"
												? spineRetryTaskHandler
												: name === "spine-skip-task"
													? spineSkipTaskHandler
													: name === "spine-abort"
														? spineAbortHandler
														: name === "spine-gate"
															? spineGateHandler
															: name === "spine-integrate"
																? spineIntegrateHandler
																: name === "spine-settings"
																	? spineSettingsHandler
																	: name === "spine-dashboard"
																		? spineDashboardHandler
										: name === "spine-deps"
											? spineDepsHandler
											: name === "spine-validate"
												? spineValidateHandler
												: name === "spine-handoff"
													? spineHandoffHandler
													: stubHandler(name),
		});
	}
}
