/**
 * SP-450 / SP-480 — worker runner pi argv guards (GitHub #104).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	buildWorkerPiArgs,
	formatPiExtensionConflictHint,
} from "../../bin/spine-worker-runner.mjs";
import { minimalValidPromptMarkdown } from "../helpers/smoke-task-prompt.mjs";

async function writeSmokeTask(root, taskId = "SP-480") {
	const taskFolder = path.join(root, "spine-tasks", taskId);
	fs.mkdirSync(taskFolder, { recursive: true });
	fs.writeFileSync(
		path.join(taskFolder, "PROMPT.md"),
		`${minimalValidPromptMarkdown(taskId, { fileScope: "src/smoke.txt" })}\n\n## Review Level: 0\n`,
		"utf-8",
	);
	return taskFolder;
}

test("buildWorkerPiArgs omits -ne when no pi-web-access conflict", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-no-ne-"));
	const agentDir = path.join(root, "agent");
	fs.mkdirSync(agentDir, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({ packages: ["npm:pi-lmstudio"] }),
		"utf-8",
	);
	const previousAgentDir = process.env.PI_AGENT_DIR;
	process.env.PI_AGENT_DIR = agentDir;
	try {
		const taskFolder = await writeSmokeTask(root, "SP-480-clean");
		const piArgs = await buildWorkerPiArgs({
			worktreePath: root,
			taskFolder,
			donePath: path.join(taskFolder, ".DONE"),
			spineConfig: {},
		});

		assert.equal(piArgs[0], "-p");
		assert.equal(piArgs[1], "--no-session");
		assert.ok(!piArgs.includes("-ne"));
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_AGENT_DIR;
		else process.env.PI_AGENT_DIR = previousAgentDir;
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerPiArgs includes -ne before -p when extension conflict detected", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-worker-ne-"));
	const agentDir = path.join(root, "agent");
	const npmPkg = path.join(agentDir, "npm", "node_modules", "pi-web-access");
	const localPkg = path.join(root, "pi-web-access");
	fs.mkdirSync(npmPkg, { recursive: true });
	fs.mkdirSync(localPkg, { recursive: true });
	fs.writeFileSync(
		path.join(agentDir, "settings.json"),
		JSON.stringify({
			packages: ["npm:pi-web-access", path.relative(agentDir, localPkg)],
		}),
		"utf-8",
	);
	const previousAgentDir = process.env.PI_AGENT_DIR;
	process.env.PI_AGENT_DIR = agentDir;
	try {
		const taskFolder = await writeSmokeTask(root, "SP-480-conflict");
		const piArgs = await buildWorkerPiArgs({
			worktreePath: root,
			taskFolder,
			donePath: path.join(taskFolder, ".DONE"),
			spineConfig: {},
		});

		assert.equal(piArgs[0], "-ne");
		assert.equal(piArgs[1], "-p");
		assert.equal(piArgs[2], "--no-session");
	} finally {
		if (previousAgentDir === undefined) delete process.env.PI_AGENT_DIR;
		else process.env.PI_AGENT_DIR = previousAgentDir;
		await rm(root, { recursive: true, force: true });
	}
});

test("formatPiExtensionConflictHint surfaces pi-web-access remediation", () => {
	const hint = formatPiExtensionConflictHint(
		'Tool "web_search" conflicts with /tmp/pi-web-access/index.ts',
	);
	assert.match(hint, /pi-web-access/i);
	assert.match(hint, /pi -ne/i);
	assert.match(hint, /pi remove/i);
});
