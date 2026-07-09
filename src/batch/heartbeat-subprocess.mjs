// @ts-nocheck
/**
 * Subprocess heartbeat signals for long-running worker steps (issue #134 / SP-548).
 */

/** @typedef {"launching" | "pi" | "verify" | "subprocess" | "unknown"} WorkerPhase */

const SUBPROCESS_COMMAND_MAX_LEN = 120;

const SUBPROCESS_FRIENDLY_LABELS = Object.freeze([
	[/^npm\s+run\s+coverage(?::\w+)?/i, "coverage"],
	[/^npm\s+run\s+typecheck/i, "typecheck"],
	[/^npm\s+test\b/i, "tests"],
	[/^node\s+--test\b/i, "tests"],
]);

const SUBPROCESS_STRING_REDACT_PATTERNS = [
	/(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi,
	/sk-[a-zA-Z0-9]{20,}/g,
	/ghp_[a-zA-Z0-9]{20,}/g,
	/\b[A-Z][A-Z0-9_]*=\S+/g,
];

/**
 * @param {string} text
 */
function redactSubprocessCommandText(text) {
	let out = text;
	for (const pattern of SUBPROCESS_STRING_REDACT_PATTERNS) {
		out = out.replace(pattern, "[REDACTED]");
	}
	return out.replace(/\s+/g, " ").trim();
}

/**
 * @param {string} raw
 */
function stripLeadingEnvAssignments(command) {
	let rest = command.trim();
	while (/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/.test(rest)) {
		rest = rest.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S+\s+/, "");
	}
	return rest.trim();
}

/**
 * Redact secrets and shorten a subprocess command for heartbeat payloads.
 *
 * @param {string} raw
 */
export function redactSubprocessCommand(raw) {
	if (!raw || typeof raw !== "string") return null;
	const head = raw.split(/\s*(?:&&|;|\|)\s*/)[0]?.trim() ?? "";
	if (!head) return null;
	const withoutEnv = stripLeadingEnvAssignments(head);
	const redacted = redactSubprocessCommandText(withoutEnv);
	const trimmed =
		redacted.length > SUBPROCESS_COMMAND_MAX_LEN
			? `${redacted.slice(0, SUBPROCESS_COMMAND_MAX_LEN - 1)}…`
			: redacted;
	for (const [pattern, label] of SUBPROCESS_FRIENDLY_LABELS) {
		if (pattern.test(trimmed)) return label;
	}
	return trimmed;
}

/**
 * @param {object} event
 * @param {object} filter
 * @param {number} [filter.laneNumber]
 * @param {string} [filter.laneId]
 * @param {string} [filter.taskId]
 */
function subprocessEventMatches(event, { laneNumber, laneId, taskId }) {
	const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
	const expectedLaneId =
		laneNumber != null ? `lane-${laneNumber}` : typeof laneId === "string" ? laneId : null;
	if (taskId && event.taskId && event.taskId !== taskId) return false;
	if (payload.taskId && taskId && payload.taskId !== taskId) return false;
	if (expectedLaneId && event.laneId && event.laneId !== expectedLaneId) return false;
	if (expectedLaneId && payload.laneId && payload.laneId !== expectedLaneId) return false;
	if (laneNumber != null && payload.laneNumber != null && payload.laneNumber !== laneNumber) {
		return false;
	}
	return true;
}

/**
 * Latest active subprocess signal from worker journal events (issue #134 / SP-548).
 *
 * @param {object[]} events
 * @param {object} filter
 * @param {number} [filter.laneNumber]
 * @param {string} [filter.laneId]
 * @param {string} [filter.taskId]
 */
export function findLatestSubprocessSignal(events, { laneNumber, laneId, taskId }) {
	for (let index = events.length - 1; index >= 0; index -= 1) {
		const event = events[index];
		if (!subprocessEventMatches(event, { laneNumber, laneId, taskId })) continue;

		const payload = event.payload && typeof event.payload === "object" ? event.payload : {};
		const ts = Date.parse(event.timestamp);
		if (Number.isNaN(ts)) continue;

		if (event.type === "task.subprocess_ended") {
			return null;
		}

		const rawCommand =
			typeof payload.subprocessCommand === "string"
				? payload.subprocessCommand
				: typeof payload.subprocessLabel === "string"
					? payload.subprocessLabel
					: null;
		if (!rawCommand) continue;

		if (event.type === "task.subprocess_active" || event.type === "task.step_completed") {
			const subprocessCommand = redactSubprocessCommand(rawCommand);
			if (!subprocessCommand) continue;
			return { subprocessCommand, subprocessStartedAtMs: ts };
		}
	}

	return null;
}

/**
 * @param {WorkerPhase} enginePhase
 * @param {object | null | undefined} signals
 */
export function resolveEffectiveWorkerPhase(enginePhase, signals) {
	if (signals?.subprocessCommand) return "subprocess";
	return enginePhase;
}

/**
 * Progress-class heartbeat fields are omitted during launcher preflight so retries
 * do not reuse stale STATUS / git checkpoint signals from a prior attempt.
 *
 * @param {object} signals
 * @param {WorkerPhase} workerPhase
 * @param {"worker_alive" | "checkpoint" | "file_scope_activity"} heartbeatKind
 */
export function buildHeartbeatPayloadFields(signals, workerPhase, heartbeatKind) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	const includeProgressFields =
		effectivePhase !== "launching" &&
		(heartbeatKind === "checkpoint" || heartbeatKind === "file_scope_activity");

	/** @type {Record<string, unknown>} */
	const payload = {
		statusMtimeMs: null,
		lastCommitAtMs: null,
		fileScopeMtimeMs: null,
		dirtyPathCount: 0,
	};

	if (effectivePhase === "subprocess" && signals?.subprocessCommand) {
		payload.subprocessCommand = signals.subprocessCommand;
		payload.subprocessStartedAtMs = signals.subprocessStartedAtMs ?? null;
	}

	if (!includeProgressFields) {
		return payload;
	}

	return {
		...payload,
		statusMtimeMs: signals.statusMtimeMs,
		lastCommitAtMs: signals.lastCommitAtMs,
		fileScopeMtimeMs: signals.fileScopeMtimeMs,
		dirtyPathCount: signals.dirtyPaths?.length ?? 0,
	};
}

/**
 * Bounded lane.progress_snapshot payload (issue #48).
 *
 * @param {object} signals
 * @param {WorkerPhase} workerPhase
 */
export function buildProgressSnapshotPayload(signals, workerPhase) {
	const effectivePhase = resolveEffectiveWorkerPhase(workerPhase, signals);
	/** @type {Record<string, unknown>} */
	const payload = {
		workerPhase: effectivePhase,
		dirtyPathCount: signals.dirtyPaths?.length ?? 0,
		lastCommitAtMs: signals.lastCommitAtMs ?? null,
		statusMtimeMs: signals.statusMtimeMs ?? null,
		stepCompletedAtMs: signals.stepCompletedAtMs ?? null,
	};
	if (effectivePhase === "subprocess" && signals?.subprocessCommand) {
		payload.subprocessCommand = signals.subprocessCommand;
		payload.subprocessStartedAtMs = signals.subprocessStartedAtMs ?? null;
	}
	return payload;
}

/**
 * @param {object | null} prev
 * @param {object} next
 */
export function progressSnapshotPayloadChanged(prev, next) {
	if (!prev) return true;
	if (prev.workerPhase !== next.workerPhase) return true;
	if (prev.dirtyPathCount !== next.dirtyPathCount) return true;
	if (prev.lastCommitAtMs !== next.lastCommitAtMs) return true;
	if (prev.statusMtimeMs !== next.statusMtimeMs) return true;
	if (prev.stepCompletedAtMs !== next.stepCompletedAtMs) return true;
	if (prev.subprocessCommand !== next.subprocessCommand) return true;
	if (prev.subprocessStartedAtMs !== next.subprocessStartedAtMs) return true;
	return false;
}
