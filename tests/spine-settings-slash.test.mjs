import assert from "node:assert/strict";
import { unlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
	formatSettingsSlashMenu,
	runSpineSettingsSlash,
} from "../src/cli/settings-slash.mjs";
import { destroyGitRepo, initGitRepo } from "./helpers/git-fixture.mjs";

const SAMPLE_CONFIG = {
	lanes: { maxParallel: 2 },
	gates: { requireBeforeIntegrate: false },
	agents: { worker: { model: "inherit", thinking: "low" } },
	dashboard: { port: 8200 },
};

function createMockUi() {
	const notifications = [];
	const ui = {
		notify(message, level) {
			notifications.push({ message, level });
		},
	};
	return { ui, notifications };
}

test("formatSettingsSlashMenu lists at least five editable fields with set hints", () => {
	const menu = formatSettingsSlashMenu(SAMPLE_CONFIG);

	assert.match(menu, /lanes\.maxParallel/);
	assert.match(menu, /gates\.requireBeforeIntegrate/);
	assert.match(menu, /agents\.worker\.model/);
	assert.match(menu, /agents\.worker\.thinking/);
	assert.match(menu, /dashboard\.port/);
	assert.match(menu, /Max parallel lanes: 2/);
	assert.match(menu, /→ spine settings set lanes\.maxParallel <value>/);
	assert.match(menu, /→ spine settings set dashboard\.port <value>/);
});

test("runSpineSettingsSlash notifies menu with live config fields", async () => {
	const projectRoot = await initGitRepo("spine-settings-slash-menu-");
	const { ui, notifications } = createMockUi();

	try {
		await runSpineSettingsSlash("", ui, projectRoot);

		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		const message = notifications[0].message;
		assert.match(message, /lanes\.maxParallel/);
		assert.match(message, /gates\.requireBeforeIntegrate/);
		assert.match(message, /agents\.worker\.model/);
		assert.match(message, /agents\.worker\.thinking/);
		assert.match(message, /dashboard\.port/);
		assert.match(message, /spine settings set/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineSettingsSlash set subcommand persists a valid change", async () => {
	const projectRoot = await initGitRepo("spine-settings-slash-set-");
	const { ui, notifications } = createMockUi();

	try {
		await runSpineSettingsSlash("set lanes.maxParallel 3", ui, projectRoot);

		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "info");
		assert.match(notifications[0].message, /lanes\.maxParallel/);

		await runSpineSettingsSlash("", ui, projectRoot);
		assert.match(notifications[1].message, /Max parallel lanes: 3/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineSettingsSlash set reports usage error without path and value", async () => {
	const projectRoot = await initGitRepo("spine-settings-slash-usage-");
	const { ui, notifications } = createMockUi();

	try {
		await runSpineSettingsSlash("set", ui, projectRoot);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "error");
		assert.match(notifications[0].message, /Usage/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineSettingsSlash reports missing config with suggested init", async () => {
	const { ui, notifications } = createMockUi();
	const projectRoot = await initGitRepo("spine-settings-slash-missing-");

	try {
		unlinkSync(join(projectRoot, ".spine", "spine-config.json"));

		await runSpineSettingsSlash("", ui, projectRoot);
		assert.equal(notifications.length, 1);
		assert.equal(notifications[0].level, "error");
		assert.match(notifications[0].message, /not found/i);
		assert.match(notifications[0].message, /spine init/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
