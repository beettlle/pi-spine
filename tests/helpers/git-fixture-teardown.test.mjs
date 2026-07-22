import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "./git-fixture.mjs";

test("destroyGitRepo swallows residual ENOTEMPTY after retries", async () => {
	const projectRoot = await initGitRepo("spine-teardown-enotempty-");
	let calls = 0;
	/**
	 * @param {string} targetPath
	 * @param {object} _options
	 */
	const mockRm = async (targetPath, _options) => {
		calls++;
		assert.equal(targetPath, projectRoot);
		const err = new Error("Directory not empty");
		/** @type {any} */(err).code = "ENOTEMPTY";
		/** @type {any} */(err).syscall = "rmdir";
		throw err;
	};

	await destroyGitRepo(projectRoot, { rm: mockRm });
	assert.equal(calls, 1);
});

test("destroyGitRepo still propagates non-ENOTEMPTY errors", async () => {
	const projectRoot = await initGitRepo("spine-teardown-eperm-");
	/**
	 * @param {string} _targetPath
	 * @param {object} _options
	 */
	const mockRm = async (_targetPath, _options) => {
		const err = new Error("Operation not permitted");
		/** @type {any} */(err).code = "EPERM";
		throw err;
	};

	await assert.rejects(() => destroyGitRepo(projectRoot, { rm: mockRm }), { code: "EPERM" });
});

test("destroyGitRepo removes a real temp git repo", async () => {
	const projectRoot = await initGitRepo("spine-teardown-real-");
	await destroyGitRepo(projectRoot);
	assert.equal((await stat(projectRoot).catch(() => null))?.isDirectory(), undefined);
});
