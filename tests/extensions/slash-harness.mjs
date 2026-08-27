import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { registerSpineSlashCommands } from "../../extensions/spine/slash-commands.ts";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

/**
 * @returns {Map<string, (args: string, ctx: object) => Promise<void>>}
 */
export function buildSlashHandlers() {
	const handlers = new Map();
	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};
	registerSpineSlashCommands(pi);
	return handlers;
}

/**
 * @returns {{ handlers: Map<string, Function>, notifications: Array<{ message: string, level: string }>, ctx: object }}
 */
export function createSlashContext() {
	const handlers = buildSlashHandlers();
	const notifications = [];
	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};
	return { handlers, notifications, ctx };
}

/**
 * @param {string} name
 * @param {string} [fixtureName]
 */
export function loadBatchFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

/**
 * @param {string} projectRoot
 * @param {object} fixture
 */
export function writePiBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".pi"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".pi", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {object} state
 */
export function writeSpineBatchState(projectRoot, state) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(state, null, 2),
		"utf-8",
	);
}

/**
 * Serialize process.chdir across concurrent Node --test workers in this process.
 * Without this, overlapping withGitProject calls race ambient cwd and spawnSync
 * children (spine plan / preflight) inherit the wrong root — under full-suite load
 * /spine-orchestrate then notifies "error" instead of "info" (release:check flake).
 * @type {Promise<void>}
 */
let gitProjectChdirChain = Promise.resolve();

/**
 * @param {(projectRoot: string) => Promise<void>} fn
 * @param {string} [prefix]
 */
export async function withGitProject(fn, prefix = "spine-slash-") {
	const projectRoot = await initGitRepo(prefix);
	const run = gitProjectChdirChain.then(async () => {
		const previousCwd = process.cwd();
		process.chdir(projectRoot);
		try {
			await fn(projectRoot);
		} finally {
			process.chdir(previousCwd);
			await destroyGitRepo(projectRoot);
		}
	});
	// Keep the chain alive even when a test rejects so later callers still run.
	gitProjectChdirChain = run.catch(() => {});
	await run;
}

/**
 * @param {string} projectRoot
 * @param {string} taskId
 */
export function writeMinimalTask(projectRoot, taskId) {
	const folder = path.join(projectRoot, "spine-tasks", `${taskId}-smoke`);
	fs.mkdirSync(folder, { recursive: true });
	fs.writeFileSync(
		path.join(folder, "PROMPT.md"),
		`# Task: ${taskId} — Smoke

**Size:** S

## Mission
Slash handler smoke.

## Dependencies
- **None**

## File Scope
- \`README.md\`

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`npm test\` |
| fileScopeMustChange | \`README.md\` |

## Steps
### Step 0: Work
- [ ] one

### Step 1: Testing & Verification
- [ ] run tests

## Completion Criteria
- [ ] done

## Do NOT
- scope creep
`,
		"utf-8",
	);
}

/**
 * @param {string} projectRoot
 * @param {Record<string, string[]>} [tasks]
 */
export function ensureDependenciesJson(projectRoot, tasks = {}) {
	const depsPath = path.join(projectRoot, "spine-tasks", "dependencies.json");
	if (!fs.existsSync(depsPath)) {
		fs.writeFileSync(depsPath, JSON.stringify({ version: 1, tasks }, null, 2), "utf-8");
	}
}

/**
 * @param {string} projectRoot
 */
export function commitPendingTasks(projectRoot) {
	execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "add tasks"], { cwd: projectRoot, stdio: "ignore" });
}
