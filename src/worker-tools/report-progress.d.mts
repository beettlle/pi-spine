export interface ReportTaskProgressResult {
	ok: boolean;
	eventId?: string;
	error?: string;
}

export function reportTaskProgress(params: {
	projectRoot: string;
	batchId: string;
	taskId: string;
	laneNumber?: number;
	laneId?: string;
	step: number;
	checkboxesComplete?: number;
	checkboxesTotal?: number;
	correlationId?: string;
	journal?: { projectRoot: string; batchId: string; append?: Function };
}): ReportTaskProgressResult;
