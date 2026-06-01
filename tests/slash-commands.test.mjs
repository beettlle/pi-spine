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

	await handlers.get("spine")("", ctx);
	assert.ok(notifications.length > 0);
	assert.match(notifications[0].message, /preflight/i);
});
