/**
 * In-process lane worker via pi-coding-agent createAgentSession (TP-050 spike).
 */

import fs from "node:fs";
import path from "node:path";
import { readReviewLevel } from "./review.mjs";

/**
 * @param {object} params
 * @param {string} params.worktreePath
 * @param {string} params.taskFolder
 * @param {object} [params.config]
 */
export function buildAgentSessionWorkerPrompt({ worktreePath, taskFolder, config = {} }) {
	const promptPath = path.join(taskFolder, "PROMPT.md");
	const donePath = path.join(taskFolder, ".DONE");
	const workerAgentPath = worktreePath
		? path.join(worktreePath, ".spine", "agents", "worker.md")
		: null;
	const taskIdHint = path.basename(taskFolder).match(/^([A-Z]+-\d+)/)?.[1] ?? "TASK-ID";
	const reviewLevel = readReviewLevel(taskFolder);
	const reviewHint =
		reviewLevel > 0
			? "When Review Level > 0, after each step run: spine review step --step N [--type plan|code] (or spine_review_step tool). On REVISE, fix feedback before continuing. On review spawn failure, stop with non-zero exit. "
			: "";
	const toolsHint =
		"Prefer spine_review_step, spine_report_progress, and spine_request_gate Pi tools over bash when available. ";
	const agentAppend =
		workerAgentPath && fs.existsSync(workerAgentPath)
			? `\n\n@${workerAgentPath}`
			: "";
	const promptInclude = fs.existsSync(promptPath) ? `@${promptPath}` : "";

	return (
		`Complete this task in the worktree (${worktreePath || "."}). Follow PROMPT.md, keep STATUS.md current, run npm test. ` +
		toolsHint +
		reviewHint +
		`Commit at step boundaries when you change files (feat(${taskIdHint}): …). ` +
		`The batch engine auto-commits any remaining uncommitted work when you create ${donePath}, but uncommitted changes without .DONE fail the batch. ` +
		`Create ${donePath} only when all completion criteria are met.` +
		agentAppend +
		(promptInclude ? `\n\n${promptInclude}` : "")
	);
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
			fs.writeFileSync(
				donePath,
				`Completed: ${new Date().toISOString()}\nTask: agent-session-stub\n`,
				"utf-8",
			);
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
 * @param {object} [deps]
 */
export function startAgentSessionWorker({ worktreePath, taskFolder, config = {} }, deps = {}) {
	const donePath = path.join(taskFolder, ".DONE");
	const state = {
		exitCode: /** @type {number | null} */ (null),
		output: "",
		session: /** @type {{ abort?: () => Promise<void>; dispose?: () => void } | null} */ (null),
		aborted: false,
	};

	const donePromise = (async () => {
		try {
			const createAgentSession = await loadCreateAgentSession(deps);
			const promptText = buildAgentSessionWorkerPrompt({ worktreePath, taskFolder, config });
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
			await session.prompt(promptText);

			if (state.aborted) {
				state.exitCode = 130;
				state.output = "agent session aborted";
				return;
			}

			if (!fs.existsSync(donePath)) {
				state.exitCode = 1;
				state.output = "agent session finished but .DONE was not created";
				return;
			}

			state.exitCode = 0;
		} catch (err) {
			state.exitCode = 1;
			state.output = err instanceof Error ? err.message : String(err);
		} finally {
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
				void session.abort().catch(() => {});
			}
		},
		wait: async () => {
			await donePromise;
			return { exitCode: state.exitCode ?? 1, output: state.output };
		},
	};
}
