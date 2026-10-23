import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runSpineGate } from "../../bin/spine-gate.mjs";
import { runSpineIntegrate } from "../../bin/spine-integrate.mjs";
import {
	formatSubcommandHelp,
	parseStrictArgs,
	shouldInterceptSubcommandHelp,
	strictArgsError,
} from "../../bin/spine-cli/cli-args.mjs";
import { loadGateRecord, openIntegrateGate } from "../../src/batch/gate.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");
const BATCH_ID = "20261022T173511-a8db";
const ORCH_BRANCH = "orch/spine-help-guard";

/**
 * Every subcommand that changes batch state, gate state, git refs or files.
 * `--help` / `-h` on any of them must print usage and leave the project untouched (#368).
 */
const MUTATING_HELP_INVOCATIONS = [
	["gate", "approve", "--help"],
	["gate", "approve", "-h"],
	["gate", "reject", "--help"],
	["gate", "reopen", "--help"],
	["integrate", "--help"],
	["integrate", "-h"],
	["integrate", "--force-integrate", "--help"],
	["batch", "start", "--help"],
	["batch", "resume", "--help"],
	["batch", "retry", "SP-001", "--help"],
	["batch", "skip", "SP-001", "--help"],
	["batch", "abort", "--help"],
	["batch", "complete", "--help"],
	["batch", "salvage", "--help"],
	["batch", "force-merge", "--help"],
	["run", "--help"],
	["next", "--help"],
	["cleanup", "--help"],
	["sync-base", "--help"],
	["handoff", "--help"],
	["state", "--help"],
	["init", "--force", "--help"],
	["migrate-from-taskplane", "--help"],
	["review", "step", "--help"],
	["scenarios", "materialize", "orphan-running-resume", "--help"],
	["settings", "set", "lanes.maxParallel", "9", "--help"],
	["rules", "sync", "--help"],
	["issue", "draft", "--create", "--help"],
	["issue", "--help"],
];

/**
 * @param {string} projectRoot
 */
function createPendingGateProject(projectRoot) {
	execFileSync("git", ["checkout", "-b", ORCH_BRANCH], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane work", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });

	const batchState = {
		batchId: BATCH_ID,
		phase: "completed",
		baseBranch: "main",
		orchBranch: ORCH_BRANCH,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "SP-001", status: "succeeded", taskFolder: "SP-001", doneFileFound: true }],
	};
	fs.writeFileSync(path.join(projectRoot, ".spine", "batch-state.json"), JSON.stringify(batchState, null, 2));
	openIntegrateGate({ projectRoot, batchId: BATCH_ID, batchState });
}

/**
 * Content hash of every file outside `.git`, plus all git refs and HEAD.
 *
 * @param {string} projectRoot
 */
function snapshotProject(projectRoot) {
	/** @type {string[]} */
	const entries = [];
	/** @param {string} dir */
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			if (entry.name === ".git") continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				walk(full);
			} else {
				const hash = crypto.createHash("sha1").update(fs.readFileSync(full)).digest("hex");
				entries.push(`${path.relative(projectRoot, full)} ${hash}`);
			}
		}
	};
	walk(projectRoot);
	const refs = execFileSync("git", ["for-each-ref", "--format=%(refname) %(objectname)"], {
		cwd: projectRoot,
		encoding: "utf-8",
	});
	const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf-8" });
	return [...entries.sort(), refs, head].join("\n");
}

test("parseStrictArgs keeps valued-flag values out of positionals", () => {
	const parsed = parseStrictArgs(["--batch", "B1", "approve", "--synthesis", "ok", "--json"], {
		valued: ["--batch", "--synthesis"],
		boolean: ["--json"],
	});
	assert.deepEqual(parsed.positional, ["approve"]);
	assert.equal(parsed.values.get("--batch"), "B1");
	assert.equal(parsed.values.get("--synthesis"), "ok");
	assert.equal(parsed.flags.has("--json"), true);
	assert.equal(strictArgsError(parsed), null);
});

test("parseStrictArgs reports help, unknown flags and missing values", () => {
	const parsed = parseStrictArgs(["approve", "-h", "--synthsis", "x", "--batch"], { valued: ["--batch"] });
	assert.equal(parsed.help, true);
	assert.deepEqual(parsed.unknown, ["--synthsis"]);
	assert.deepEqual(parsed.missingValue, ["--batch"]);
	assert.match(strictArgsError(parsed) ?? "", /Unknown option\(s\): --synthsis/);
});

test("shouldInterceptSubcommandHelp defers to commands with their own help", () => {
	assert.equal(shouldInterceptSubcommandHelp("cleanup", ["--help"]), true);
	assert.equal(shouldInterceptSubcommandHelp("sync-base", ["-h"]), true);
	assert.equal(shouldInterceptSubcommandHelp("sync-base", []), false);
	assert.equal(shouldInterceptSubcommandHelp("batch", ["start", "--help"]), false);
	assert.equal(shouldInterceptSubcommandHelp("gate", ["approve", "--help"]), false);
});

test("formatSubcommandHelp extracts summary and example lines", () => {
	const helpText = "\n  \x1b[36mgate\x1b[0m           Integrate gate\n\n  spine gate approve   # approve\n  spine gates x\n";
	const out = formatSubcommandHelp("gate", helpText);
	assert.match(out, /spine gate — Integrate gate/);
	assert.match(out, /spine gate approve {3}# approve/);
	assert.doesNotMatch(out, /spine gates x/);
});

test("runSpineGate approve --help prints usage and leaves the gate pending (#368)", async () => {
	const projectRoot = await initGitRepo("spine-gate-help-");
	try {
		createPendingGateProject(projectRoot);
		const result = runSpineGate({ projectRoot, args: ["approve", "--help"] });
		assert.equal(result.exitCode, 0);
		assert.match(result.output, /Usage: spine gate/);
		assert.equal(loadGateRecord(projectRoot, BATCH_ID).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineGate approve rejects unknown flags without approving", async () => {
	const projectRoot = await initGitRepo("spine-gate-unknown-flag-");
	try {
		createPendingGateProject(projectRoot);
		const result = runSpineGate({ projectRoot, args: ["approve", "--synthsis", "typo"] });
		assert.equal(result.exitCode, 2);
		assert.match(result.output, /Unknown option\(s\): --synthsis/);
		assert.equal(loadGateRecord(projectRoot, BATCH_ID).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIntegrate rejects --help, unknown flags and stray positionals without merging", async () => {
	const projectRoot = await initGitRepo("spine-integrate-help-");
	try {
		createPendingGateProject(projectRoot);
		const before = snapshotProject(projectRoot);
		const help = runSpineIntegrate({ projectRoot, args: ["--help"] });
		assert.equal(help.exitCode, 0);
		assert.match(help.output, /Usage: spine integrate/);
		const unknown = runSpineIntegrate({ projectRoot, args: ["--dryrun"] });
		assert.equal(unknown.exitCode, 2);
		const stray = runSpineIntegrate({ projectRoot, args: ["now"] });
		assert.equal(stray.exitCode, 2);
		assert.equal(snapshotProject(projectRoot), before);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("--help on every mutating spine command exits 0 with no side effects (#368)", async () => {
	const projectRoot = await initGitRepo("spine-mutating-help-");
	try {
		createPendingGateProject(projectRoot);
		const before = snapshotProject(projectRoot);
		for (const argv of MUTATING_HELP_INVOCATIONS) {
			const result = spawnSync(process.execPath, [SPINE_BIN, ...argv], {
				cwd: projectRoot,
				encoding: "utf-8",
				env: { ...process.env, SPINE_ALLOW_FORCE: "1" },
			});
			const label = `spine ${argv.join(" ")}`;
			assert.equal(result.status, 0, `${label}: ${result.stderr || result.stdout}`);
			assert.match(result.stdout, /usage|spine/i, label);
			assert.equal(snapshotProject(projectRoot), before, `${label} changed project state`);
		}
		assert.equal(loadGateRecord(projectRoot, BATCH_ID).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
