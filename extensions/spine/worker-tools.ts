import { defineTool, type AgentToolResult, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runSpineReviewStep } from "../../bin/spine-review-step.mjs";

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

/** Register worker-facing Pi tools (PRD §14.5). */
export function registerSpineWorkerTools(pi: ExtensionAPI): void {
	pi.registerTool(spineReviewStepTool);
}
