import assert from "node:assert/strict";
import { test } from "node:test";

import {
	SPINE_SLASH_COMMAND_NAMES,
	registerSpineSlashCommands,
} from "../extensions/spine/slash-commands.ts";
import { destroyGitRepo, initGitRepo } from "./helpers/git-fixture.mjs";

test("registerSpineSlashCommands registers all PRD §15.1 command names", () => {
	const registered = [];

	const pi = {
		registerCommand(name, options) {
			registered.push({ name, description: options.description });
		},
	};

	registerSpineSlashCommands(pi);

	assert.equal(registered.length, SPINE_SLASH_COMMAND_NAMES.length);

	for (const expected of SPINE_SLASH_COMMAND_NAMES) {
		const entry = registered.find((c) => c.name === expected);
		assert.ok(entry, `missing registration for /${expected}`);
		assert.match(entry.description ?? "", /./, `/${expected} should have a description`);
	}
});

test("/spine-retry-task without task id notifies usage error", async () => {
	const notifications = [];
	const handlers = new Map();

	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};

	registerSpineSlashCommands(pi);

	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	await handlers.get("spine-retry-task")("", ctx);
	assert.equal(notifications.length, 1);
	assert.equal(notifications[0].level, "error");
	assert.match(notifications[0].message, /Usage: \/spine-retry-task/);
});

test("/spine-skip-task without task id notifies usage error", async () => {
	const notifications = [];
	const handlers = new Map();

	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};

	registerSpineSlashCommands(pi);

	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	await handlers.get("spine-skip-task")("", ctx);
	assert.equal(notifications[0].level, "error");
	assert.match(notifications[0].message, /Usage: \/spine-skip-task/);
});

test("/spine-plan notifies error when preflight fails", async () => {
	const notifications = [];
	const handlers = new Map();

	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};

	registerSpineSlashCommands(pi);
	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	const projectRoot = await initGitRepo("spine-slash-plan-fail-");
	const previousCwd = process.cwd();
	process.chdir(projectRoot);
	try {
		await handlers.get("spine-plan")("all", ctx);
		assert.ok(notifications.some((n) => n.level === "error" && /preflight failed/i.test(n.message)));
	} finally {
		process.chdir(previousCwd);
		await destroyGitRepo(projectRoot);
	}
});

test("/spine handler runs preflight before batch guidance", async () => {
	const notifications = [];
	const handlers = new Map();

	const pi = {
		registerCommand(name, options) {
			handlers.set(name, options.handler);
		},
	};

	registerSpineSlashCommands(pi);

	const ctx = {
		ui: {
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	};

	const projectRoot = await initGitRepo("spine-slash-");
	const previousCwd = process.cwd();
	process.chdir(projectRoot);
	try {
		await handlers.get("spine")("", ctx);
		assert.ok(notifications.length > 0);
		assert.match(notifications[0].message, /preflight/i);
	} finally {
		process.chdir(previousCwd);
		await destroyGitRepo(projectRoot);
	}
});
