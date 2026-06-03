export interface RunSpineReportProgressResult {
	ok?: boolean;
	eventId?: string;
	error?: string;
}

export function runSpineReportProgress(options?: {
	args?: string[];
	worktreePath?: string;
	projectRoot?: string;
	batchId?: string;
	taskId?: string;
	laneId?: string;
	laneNumber?: number;
	correlationId?: string;
	journal?: unknown;
}): {
	exitCode: number;
	output: string;
	result: RunSpineReportProgressResult | null;
};

export function parseReportProgressArgs(argv: string[]): {
	step: number | null;
	checkboxesComplete?: number;
	checkboxesTotal?: number;
	json: boolean;
};
