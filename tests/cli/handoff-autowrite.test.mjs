import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { HANDOFF_DEFAULTS } from "../../src/config/defaults.mjs";
import { registerSpineSlashCommands } from "../../extensions/spine/slash-commands.ts";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const FIXTURES = path.join(process.cwd(), "tests/fixtures/batch-state");

function loadFixture(name) {
	return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf-8"));
}

function writeSpineBatchState(projectRoot, fixture) {
	fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
	fs.writeFileSync(
		path.join(projectRoot, ".spine", "batch-state.json"),
		JSON.stringify(fixture, null, 2),
		"utf-8",
	);
}

function writeHandoffAutoWriteOn(projectRoot, autoWriteOn) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	config.handoff = { ...config.handoff, autoWriteOn };
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

function removeHandoffAutoWriteOn(projectRoot) {
	const configPath = path.join(projectRoot, ".spine", "spine-config.json");
	const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
	if (config.handoff) {
		delete config.handoff.autoWriteOn;
	}
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

async function runSpineEntryHandler(projectRoot) {
	const handlers = new Map();
	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};
	registerSpineSlashCommands(pi);

	const notifications = [];
	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	const previousCwd = process.cwd();
	process.chdir(projectRoot);
	try {
		await handlers.get("spine")("", ctx);
	} finally {
		process.chdir(previousCwd);
	}

	return notifications;
}

test("HANDOFF_DEFAULTS autoWriteOn includes session_start", () => {
	assert.deepEqual(HANDOFF_DEFAULTS.autoWriteOn, ["session_start"]);
});

test("/spine auto-writes handoff on session_start when batch needs attention", async () => {
	const projectRoot = await initGitRepo("spine-autowrite-active-");
	try {
		writeHandoffAutoWriteOn(projectRoot, ["session_start"]);
		writeSpineBatchState(projectRoot, loadFixture("running-batch.json"));

		await runSpineEntryHandler(projectRoot);

		const handoffPath = path.join(projectRoot, ".spine", "handoff.md");
		assert.ok(fs.existsSync(handoffPath), "expected handoff file after /spine entry");
		const markdown = fs.readFileSync(handoffPath, "utf-8");
		assert.match(markdown, /\*\*running\*\*/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("/spine skips auto-write when autoWriteOn excludes session_start", async () => {
	const projectRoot = await initGitRepo("spine-autowrite-disabled-");
	try {
		writeHandoffAutoWriteOn(projectRoot, []);
		writeSpineBatchState(projectRoot, loadFixture("running-batch.json"));

		await runSpineEntryHandler(projectRoot);

		assert.equal(fs.existsSync(path.join(projectRoot, ".spine", "handoff.md")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("/spine skips auto-write for idle diagnosis even with session_start enabled", async () => {
	const projectRoot = await initGitRepo("spine-autowrite-idle-");
	try {
		writeHandoffAutoWriteOn(projectRoot, ["session_start"]);

		await runSpineEntryHandler(projectRoot);

		assert.equal(fs.existsSync(path.join(projectRoot, ".spine", "handoff.md")), false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("/spine merges default autoWriteOn when config omits handoff.autoWriteOn", async () => {
	const projectRoot = await initGitRepo("spine-autowrite-defaults-");
	try {
		removeHandoffAutoWriteOn(projectRoot);
		writeSpineBatchState(projectRoot, loadFixture("running-batch.json"));

		await runSpineEntryHandler(projectRoot);

		assert.ok(fs.existsSync(path.join(projectRoot, ".spine", "handoff.md")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
