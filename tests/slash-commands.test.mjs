import assert from "node:assert/strict";
import { test } from "node:test";

import {
	SPINE_SLASH_COMMAND_NAMES,
	registerSpineSlashCommands,
} from "../extensions/spine/slash-commands.ts";

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

test("stub handler notifies with the command name", async () => {
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
			notify(message) {
				notifications.push(message);
			},
		},
	};

	await handlers.get("spine")("", ctx);
	assert.match(notifications[0], /\/spine is not implemented yet/);
	assert.match(notifications[0], /spine help/);
});
