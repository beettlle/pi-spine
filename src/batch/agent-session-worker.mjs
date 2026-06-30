/**
 * In-process lane worker via pi-coding-agent createAgentSession (TP-050 spike).
 */

import fs from "node:fs";
import path from "node:path";
import { appendJournalEvent } from "./journal.mjs";
import { resolvePiSpineRoot } from "../config/pi-spine-root.mjs";
import { readReviewLevel } from "./review.mjs";
import { writeWorkerDoneMarker, createWorkerLiveLogWriter } from "./worker-output.mjs";
import { buildWorkerTailPrompt } from "./worker-prompt.mjs";

const LIVE_LOG_FLUSH_INTERVAL_MS = 2_000;

/**
 * @param {string} taskFolder
 */
function resolveTaskIdFromFolder(taskFolder) {
	return (
		process.env.SPINE_TASK_ID ||
		path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ||
		"unknown"
	);
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {object} [params.config]
 * @param {string[]} [params.taskFileScope]
 * @param {import("../config/worker-context.mjs").WorkerRulesJournalContext} [params.journal]
 */
export async function buildAgentSessionWorkerPrompt({
	worktreePath,
	taskFolder,
	config = {},
	taskFileScope = [],
	journal,
}) {
	const donePath = path.join(taskFolder, ".DONE");
	return buildWorkerTailPrompt({
		worktreePath,
		taskFolder,
		donePath,
		reviewLevel: readReviewLevel(taskFolder),
		includePromptInclude: true,
		config,
		projectRoot: worktreePath || process.cwd(),
		taskFileScope,
		journal,
	});
}

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {boolean} [params.fail]
 */
export function createStubAgentSession({ worktreePath, taskFolder, fail = false }) {
	const donePath = path.join(taskFolder, ".DONE");
	let streaming = false;
	let aborted = false;

	return {
		get isStreaming() {
			return streaming;
		},
		abort: async () => {
			aborted = true;
			streaming = false;
		},
		dispose: () => {},
		prompt: async () => {
			if (fail) {
				throw new Error("stub agent session failed");
			}
			streaming = true;
			if (aborted) {
				streaming = false;
				return;
			}
			if (process.env.SPINE_AGENT_SESSION_STUB_TOUCH === "1" && worktreePath) {
				fs.writeFileSync(
					path.join(worktreePath, "agent-session-stub-touch.txt"),
					`agent session stub ${new Date().toISOString()}\n`,
					"utf-8",
				);
			}
			writeWorkerDoneMarker(donePath, { taskId: resolveTaskIdFromFolder(taskFolder) });
			streaming = false;
		},
		subscribe: () => () => {},
	};
}

/**
 * @param {object} [deps]
 */
async function loadCreateAgentSession(deps = {}) {
	if (deps.createAgentSession) {
		return deps.createAgentSession;
	}
	if (
		process.env.SPINE_AGENT_SESSION_STUB === "1" ||
		process.env.SPINE_WORKER_STUB === "1" ||
		process.env.SPINE_WORKER_STUB === "true"
	) {
		return async (options = {}) => ({
			session: createStubAgentSession({
				worktreePath: options.cwd ?? process.cwd(),
				taskFolder: process.env.SPINE_TASK_FOLDER ?? options.cwd ?? process.cwd(),
				fail: process.env.SPINE_AGENT_SESSION_STUB_FAIL === "1",
			}),
		});
	}
	const pi = await import("@earendil-works/pi-coding-agent");
	return pi.createAgentSession;
}

/**
 * @param {{ transcript: string }} state
 * @param {string} message
 */
function appendAgentSessionOutput(state, message) {
	const parts = [];
	if (state.transcript.trim()) parts.push(state.transcript.trim());
	if (message) parts.push(message);
	return parts.join("\n\n");
}

/**
 * @param {unknown} event
 */
function formatAgentSessionEvent(event) {
	if (!event || typeof event !== "object") return "";
	const record = /** @type {Record<string, unknown>} */ (event);
	if (typeof record.text === "string" && record.text) {
		return `${record.text}\n`;
	}
	if (typeof record.content === "string" && record.content) {
		return `${record.content}\n`;
	}
	if (typeof record.delta === "string" && record.delta) {
		return record.delta;
	}
	if (record.message && typeof record.message === "object") {
		const message = /** @type {Record<string, unknown>} */ (record.message);
		if (typeof message.content === "string" && message.content) {
			return `${message.content}\n`;
		}
	}
	return "";
}

/**
 * @param {object} config
 */
function resolveThinkingLevel(config) {
	const level = config.agents?.worker?.thinking;
	if (level === "off" || level === "low" || level === "medium" || level === "high") {
		return level;
	}
	return "high";
}

/**
 * Start an in-process agent session worker compatible with worker-host polling.
 *
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {object} [params.config]
 * @param {string[]} [params.taskFileScope]
 * @param {import("../config/worker-context.mjs").WorkerRulesJournalContext} [params.journal]
 * @param {object} [deps]
 */
export function startAgentSessionWorker(
	{ worktreePath, taskFolder, config = {}, taskFileScope = [], journal, projectRoot },
	deps = {},
) {
	const donePath = path.join(taskFolder, ".DONE");
	const state = {
		exitCode: /** @type {number | null} */ (null),
		output: "",
		transcript: "",
		session: /** @type {{ abort?: () => Promise<void>; dispose?: () => void; subscribe?: (fn: (event: unknown) => void) => () => void } | null} */ (
			null
		),
		aborted: false,
	};

	const piSpineRoot = resolvePiSpineRoot(config, projectRoot ?? process.cwd());
	process.env.PI_SPINE_ROOT = piSpineRoot;

	const liveLogWriter = createWorkerLiveLogWriter({
		projectRoot: journal?.projectRoot ?? projectRoot,
		batchId: journal?.batchId ?? process.env.SPINE_BATCH_ID,
		laneNumber:
			journal?.laneNumber ??
			(process.env.SPINE_LANE_NUMBER ? Number(process.env.SPINE_LANE_NUMBER) : undefined),
		taskId: journal?.taskId ?? process.env.SPINE_TASK_ID ?? resolveTaskIdFromFolder(taskFolder),
		config,
	});
	let lastFlushedTranscriptLength = 0;
	/** @type {ReturnType<typeof setInterval> | null} */
	let liveLogFlushTimer = null;

	const flushTranscriptToLiveLog = () => {
		if (!liveLogWriter) return;
		const delta = state.transcript.slice(lastFlushedTranscriptLength);
		if (!delta) return;
		liveLogWriter.append(delta);
		lastFlushedTranscriptLength = state.transcript.length;
	};

	if (liveLogWriter) {
		liveLogFlushTimer = setInterval(flushTranscriptToLiveLog, LIVE_LOG_FLUSH_INTERVAL_MS);
	}

	const donePromise = (async () => {
		try {
			const createAgentSession = await loadCreateAgentSession(deps);
			const promptText = await buildAgentSessionWorkerPrompt({
				worktreePath,
				taskFolder,
				config,
				taskFileScope,
				journal,
			});
			const thinkingLevel = resolveThinkingLevel(config);

			/** @type {Record<string, unknown>} */
			const sessionOptions = {
				cwd: worktreePath,
				thinkingLevel,
			};

			if (deps.sessionManager) {
				sessionOptions.sessionManager = deps.sessionManager;
			} else if (
				process.env.SPINE_AGENT_SESSION_STUB === "1" ||
				process.env.SPINE_WORKER_STUB === "1" ||
				process.env.SPINE_WORKER_STUB === "true"
			) {
				process.env.SPINE_TASK_FOLDER = taskFolder;
			} else {
				const pi = await import("@earendil-works/pi-coding-agent");
				sessionOptions.sessionManager = pi.SessionManager.inMemory();
			}

			const { session } = await createAgentSession(sessionOptions);
			state.session = session;

			// Agent sessions do not expose a subprocess stdout/stderr stream; append
			// streamed assistant/tool text when subscribe is available (pi-coding-agent).
			let unsubscribe = () => {};
			if (typeof session.subscribe === "function") {
				unsubscribe = session.subscribe((event) => {
					const chunk = formatAgentSessionEvent(event);
					if (chunk) state.transcript += chunk;
				});
			}

			try {
				await session.prompt(promptText);
			} finally {
				unsubscribe();
			}

			if (state.aborted) {
				state.exitCode = 130;
				state.output = appendAgentSessionOutput(state, "agent session aborted");
				return;
			}

			if (!fs.existsSync(donePath)) {
				state.exitCode = 1;
				state.output = appendAgentSessionOutput(
					state,
					"agent session finished but .DONE was not created",
				);
				return;
			}

			state.exitCode = 0;
			state.output = state.transcript.trim();
		} catch (err) {
			state.exitCode = 1;
			state.output = appendAgentSessionOutput(
				state,
				err instanceof Error ? err.message : String(err),
			);
		} finally {
			if (liveLogFlushTimer) {
				clearInterval(liveLogFlushTimer);
				liveLogFlushTimer = null;
			}
			flushTranscriptToLiveLog();
			state.session?.dispose?.();
			state.session = null;
		}
	})();

	return {
		pid: process.pid,
		get exitCode() {
			return state.exitCode;
		},
		kill: (signal) => {
			state.aborted = true;
			if (signal === "SIGKILL") {
				state.exitCode = 137;
			}
			const session = state.session;
			if (session?.abort) {
				void session.abort().catch((err) => {
					const root =
						process.env.SPINE_PROJECT_ROOT ?? projectRoot ?? process.cwd();
					const batchId = process.env.SPINE_BATCH_ID;
					if (batchId) {
						appendJournalEvent(root, batchId, "lane.worker_abort_failed", {
							taskId: process.env.SPINE_TASK_ID,
							laneNumber: process.env.SPINE_LANE_NUMBER,
							error: err instanceof Error ? err.message : String(err),
						});
					}
				});
			}
		},
		wait: async () => {
			await donePromise;
			return { exitCode: state.exitCode ?? 1, output: state.output };
		},
	};
}
