import { defineTool, type AgentToolResult, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runSpineReviewStep } from "../../bin/spine-review-step.mjs";
import { reportTaskProgress } from "../../src/worker-tools/report-progress.mjs";
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
export function executeSpineReviewStep(params: SpineReviewStepParams): SpineReviewStepToolResult {
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

	const { exitCode, output, result } = runSpineReviewStep({
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

	return {
		content: [{ type: "text" as const, text: output.trim() || details.error || "review step failed" }],
		details,
		isError: exitCode !== 0,
	};
}

export const spineReviewStepTool = defineTool({
	name: "spine_review_step",
	label: "Spine Review Step",
	description:
		"Spawn a reviewer for the current task step (plan or code). Call after completing a step when the task review level requires it.",
	promptSnippet: "Run plan or code review for a worker task step",
	promptGuidelines: [
		"After finishing a PROMPT step with review level > 0, call spine_review_step with the step number before continuing.",
		"On REVISE verdict, address feedback and re-run the review for that step.",
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
		return executeSpineReviewStep(params);
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

function parseLaneNumber(value: string | undefined): number | undefined {
	if (value == null || value === "") return undefined;
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

/** Run report progress logic shared by the Pi tool handler. */
export function executeSpineReportProgress(
	params: SpineReportProgressParams,
): SpineReportProgressToolResult {
	const projectRoot = process.env.SPINE_PROJECT_ROOT ?? "";
	const batchId = process.env.SPINE_BATCH_ID ?? "";
	const taskId = process.env.SPINE_TASK_ID ?? "";
	const laneId = process.env.SPINE_LANE_ID;
	const laneNumber = parseLaneNumber(process.env.SPINE_LANE_NUMBER ?? process.env.SPINE_LANE_ID);
	const correlationId = process.env.SPINE_LANE_CORRELATION_ID;

	const result = reportTaskProgress({
		projectRoot,
		batchId,
		taskId,
		laneNumber,
		laneId: laneId || undefined,
		step: params.step,
		checkboxesComplete: params.checkboxesComplete,
		checkboxesTotal: params.checkboxesTotal,
		correlationId,
	});

	const details: SpineReportProgressDetails = {
		ok: result.ok,
		eventId: result.eventId,
		error: result.error,
		exitCode: result.ok ? 0 : 1,
	};

	const text = result.ok
		? JSON.stringify({ ok: true, eventId: result.eventId })
		: (result.error ?? "report progress failed");

	return {
		content: [{ type: "text" as const, text }],
		details,
		isError: !result.ok,
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
		"Request a manual human gate (rare). v1.1 limitation: integrate gates are automatic; returns not_supported with suggestedCommand spine gate.",
	promptSnippet: "Request operator attention via a human gate (integrate gates are automatic)",
	promptGuidelines: [
		"Integrate gates open automatically at batch completion — use spine gate status/approve via operator.",
		"Worker manual gate requests are not supported in v1.1; this tool returns structured not_supported.",
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
