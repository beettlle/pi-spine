export interface RunSpineReviewStepResult {
	ok?: boolean;
	verdict?: string | null;
	feedback?: string;
	artifactPath?: string;
	reviewLevel?: number;
	skipped?: boolean;
	spawnFailed?: boolean;
	error?: string;
	exitCode?: number;
}

export function runSpineReviewStep(options?: {
	taskFolder?: string;
	worktreePath?: string;
	projectRoot?: string;
	args?: string[];
	config?: Record<string, unknown>;
	journal?: unknown;
}): {
	exitCode: number;
	output: string;
	result: RunSpineReviewStepResult | null;
};
