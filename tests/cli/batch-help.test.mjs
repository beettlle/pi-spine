import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import {
	isBatchHelpRequest,
	printBatchHelp,
	runSpineBatch,
} from "../../bin/spine-batch.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

/**
 * @param {string[]} argv
 * @param {{ cwd?: string }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, ...argv], {
		cwd: options.cwd ?? process.cwd(),
		encoding: "utf-8",
	});
}

test("batch help helpers detect help invocations", () => {
	assert.equal(isBatchHelpRequest(["start", "--help"]), true);
	assert.equal(isBatchHelpRequest(["start", "-h"]), true);
	assert.equal(isBatchHelpRequest(["start", "help"]), true);
	assert.equal(isBatchHelpRequest(["help"]), true);
	assert.equal(isBatchHelpRequest(["start", "pending", "--dry-run"]), false);
});

test("printBatchHelp returns usage text", () => {
	const usage = printBatchHelp();
	assert.match(usage, /Usage: spine batch start/);
	assert.match(usage, /--wave N/);
});

test("runSpineBatch exits 0 for help without starting a batch", async () => {
	const projectRoot = await initGitRepo("spine-batch-help-");
	try {
		const result = await runSpineBatch({
			projectRoot,
			args: ["start", "--help"],
		});
		assert.equal(result.exitCode, 0);
		assert.match(result.output ?? "", /Usage: spine batch start/);
		assert.equal(fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine batch start --help does not create batch state", async () => {
	const projectRoot = await initGitRepo("spine-cli-batch-help-");
	try {
		const result = runSpine(["batch", "start", "--help"], { cwd: projectRoot });
		assert.equal(result.status, 0, result.stderr || result.stdout);
		assert.match(result.stdout, /Usage: spine batch start/);
		assert.equal(fs.existsSync(path.join(projectRoot, ".spine", "batch-state.json")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
