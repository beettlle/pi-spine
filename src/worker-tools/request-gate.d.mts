export interface RequestWorkerGateResult {
	ok: boolean;
	notSupported?: boolean;
	limitation?: string;
	reason?: string;
	headline?: string;
	suggestedCommand?: string;
	alternatives?: string[];
	error?: string;
	gate?: object | null;
}

export function requestWorkerGate(params: {
	projectRoot: string;
	batchId: string;
	reason?: string;
}): RequestWorkerGateResult;
