import { defineTool, type AgentToolResult, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runSpineReviewStep } from "../../bin/spine-review-step.mjs";
import { runSpineReportProgress } from "../../bin/spine-report-progress.mjs";
import { requestWorkerGate } from "../../src/worker-tools/request-gate.mjs";

export interface SpineReviewStepParams {
	step: number;
	type?: "plan" | "code";
	baseline?: string;
}

export interface SpineReviewStepDetails {
	verdict: string | null;
	feedback: string;
	artifactPath: string;
	reviewLevel: number | null | undefined;
	skipped: boolean;
	spawnFailed: boolean;
	error?: string;
	exitCode: number;
}

/** Build CLI argv for {@link runSpineReviewStep} from tool params. */
export function buildReviewStepCliArgs(params: SpineReviewStepParams): string[] {
	const argv = ["--step", String(params.step), "--type", params.type ?? "plan"];
	if (params.baseline) {
		argv.push("--baseline", params.baseline);
	}
	if (process.env.SPINE_WORKER_STUB === "1" || process.env.SPINE_REVIEW_STUB === "1") {
		argv.push("--stub");
	}
	return argv;
}

type SpineReviewStepToolResult = AgentToolResult<SpineReviewStepDetails> & { isError?: boolean };

/** Run review step logic shared by the Pi tool handler. */
export async function executeSpineReviewStep(
	params: SpineReviewStepParams,
): Promise<SpineReviewStepToolResult> {
	const taskFolder = process.env.SPINE_TASK_FOLDER;
	if (!taskFolder) {
		return {
			content: [
				{
					type: "text" as const,
					text: "SPINE_TASK_FOLDER required (batch worker context missing)",
				},
			],
			details: {
				exitCode: 1,
				error: "SPINE_TASK_FOLDER required",
				verdict: null,
				feedback: "",
				artifactPath: "",
				reviewLevel: null,
				skipped: false,
				spawnFailed: false,
			} satisfies SpineReviewStepDetails,
			isError: true as const,
		};
	}

	const { exitCode, output, result } = await runSpineReviewStep({
		taskFolder,
		worktreePath: process.env.SPINE_WORKTREE ?? process.cwd(),
		args: buildReviewStepCliArgs(params),
	});

	let details: SpineReviewStepDetails;
	try {
		details = JSON.parse(output.trim()) as SpineReviewStepDetails;
		details.exitCode = exitCode;
	} catch {
		details = {
			verdict: result?.verdict ?? null,
			feedback: result?.feedback ?? "",
			artifactPath: result?.artifactPath ?? "",
			reviewLevel: result?.reviewLevel,
			skipped: result?.skipped ?? false,
			spawnFailed: result?.spawnFailed ?? false,
			error: result?.error,
			exitCode,
		};
	}

	const fallbackText = details.skipped
		? details.feedback || "review skipped (engine-owned)"
		: details.error || "review step failed";

	return {
		content: [{ type: "text" as const, text: output.trim() || fallbackText }],
		details,
		isError: exitCode !== 0 && !details.skipped,
	};
}

export const spineReviewStepTool = defineTool({
	name: "spine_review_step",
	label: "Spine Review Step",
	description:
		"Request plan or code review for a task step. In real-pi worker sessions the tool returns skipped (exit 0) — the batch engine runs reviews after .DONE (SP-195/SP-278). Stub batches may receive APPROVE via --stub.",
	promptSnippet: "Request plan or code review for a worker task step (engine-owned in real-pi sessions)",
	promptGuidelines: [
		"In real-pi worker sessions, do not rely on spine_review_step for plan or code review — the batch engine runs those after worker success.",
		"Stub batches (SPINE_WORKER_STUB=1) may call spine_review_step for stub APPROVE at plan checkpoints.",
		"On REVISE verdict from engine-owned review, address feedback before continuing.",
	],
	parameters: Type.Object({
		step: Type.Integer({ minimum: 0, description: "Step number from PROMPT.md." }),
		type: Type.Optional(
			Type.Union([Type.Literal("plan"), Type.Literal("code")], {
				description: "Review type; defaults to plan.",
			}),
		),
		baseline: Type.Optional(
			Type.String({ description: "Optional git baseline SHA for code review." }),
		),
	}),
	async execute(_toolCallId, params): Promise<SpineReviewStepToolResult> {
		return await executeSpineReviewStep(params);
	},
});

export interface SpineReportProgressParams {
	step: number;
	checkboxesComplete?: number;
	checkboxesTotal?: number;
}

export interface SpineReportProgressDetails {
	ok: boolean;
	eventId?: string;
	error?: string;
	exitCode: number;
}

type SpineReportProgressToolResult = AgentToolResult<SpineReportProgressDetails> & { isError?: boolean };

/** Run report progress logic shared by the Pi tool handler. */
export function executeSpineReportProgress(
	params: SpineReportProgressParams,
): SpineReportProgressToolResult {
	const args = ["--step", String(params.step)];
	if (params.checkboxesComplete != null) {
		args.push("--checkboxes-complete", String(params.checkboxesComplete));
	}
	if (params.checkboxesTotal != null) {
		args.push("--checkboxes-total", String(params.checkboxesTotal));
	}

	const { exitCode, result } = runSpineReportProgress({ args });

	const details: SpineReportProgressDetails = {
		ok: result?.ok ?? false,
		eventId: result?.eventId,
		error: result?.error,
		exitCode,
	};

	const text = details.ok
		? JSON.stringify({ ok: true, eventId: details.eventId })
		: (details.error ?? "report progress failed");

	return {
		content: [{ type: "text" as const, text }],
		details,
		isError: !details.ok,
	};
}

export const spineReportProgressTool = defineTool({
	name: "spine_report_progress",
	label: "Spine Report Progress",
	description:
		"Emit structured step progress to the batch journal (task.step_completed). Suppresses stall kill when the engine detects recent progress.",
	promptSnippet: "Report worker step completion to the batch journal",
	promptGuidelines: [
		"Call after completing a PROMPT step to record progress for stall detection.",
		"Prefer this tool over bash for spine report progress when available.",
	],
	parameters: Type.Object({
		step: Type.Integer({ minimum: 0, description: "Step number from PROMPT.md." }),
		checkboxesComplete: Type.Optional(
			Type.Integer({ minimum: 0, description: "Checkboxes completed in the current step." }),
		),
		checkboxesTotal: Type.Optional(
			Type.Integer({ minimum: 0, description: "Total checkboxes in the current step." }),
		),
	}),
	async execute(_toolCallId, params): Promise<SpineReportProgressToolResult> {
		return executeSpineReportProgress(params);
	},
});

export interface SpineRequestGateParams {
	reason?: string;
}

export interface SpineRequestGateDetails {
	ok: boolean;
	notSupported?: boolean;
	limitation?: string;
	reason?: string;
	headline?: string;
	suggestedCommand?: string;
	alternatives?: string[];
	error?: string;
	exitCode: number;
}

type SpineRequestGateToolResult = AgentToolResult<SpineRequestGateDetails> & { isError?: boolean };

/** Run request gate logic shared by the Pi tool handler. */
export function executeSpineRequestGate(params: SpineRequestGateParams): SpineRequestGateToolResult {
	const projectRoot = process.env.SPINE_PROJECT_ROOT ?? "";
	const batchId = process.env.SPINE_BATCH_ID ?? "";

	const result = requestWorkerGate({
		projectRoot,
		batchId,
		reason: params.reason,
	});

	const details: SpineRequestGateDetails = {
		ok: result.ok,
		notSupported: result.notSupported,
		limitation: result.limitation,
		reason: result.reason,
		headline: result.headline,
		suggestedCommand: result.suggestedCommand,
		alternatives: result.alternatives,
		error: result.error,
		exitCode: result.ok ? 0 : 1,
	};

	const text = JSON.stringify({
		ok: result.ok,
		notSupported: result.notSupported,
		limitation: result.limitation,
		reason: result.reason,
		headline: result.headline,
		suggestedCommand: result.suggestedCommand,
		alternatives: result.alternatives,
		error: result.error,
	});

	return {
		content: [{ type: "text" as const, text }],
		details,
		isError: !result.ok,
	};
}

export const spineRequestGateTool = defineTool({
	name: "spine_request_gate",
	label: "Spine Request Gate",
	description:
		"Request a human gate (rare). v2.2: permanent not_supported for all gate kinds; operator runs spine gate approve from host.",
	promptSnippet: "Request operator attention via a human gate (integrate gates are automatic)",
	promptGuidelines: [
		"Integrate gates open automatically at batch completion — operator runs spine gate status/approve from host.",
		"Worker gate requests are permanently not_supported in v2.2 (integrate, manual, conflict); returns structured JSON with suggestedCommand.",
	],
	parameters: Type.Object({
		reason: Type.Optional(
			Type.String({ description: "Optional reason for requesting operator attention." }),
		),
	}),
	async execute(_toolCallId, params): Promise<SpineRequestGateToolResult> {
		return executeSpineRequestGate(params);
	},
});

/** Register worker-facing Pi tools (PRD §14.5). */
export function registerSpineWorkerTools(pi: ExtensionAPI): void {
	pi.registerTool(spineReviewStepTool);
	pi.registerTool(spineReportProgressTool);
	pi.registerTool(spineRequestGateTool);
}
