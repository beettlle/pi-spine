import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";

import { readJournalEvents } from "../../src/batch/journal.mjs";
import { buildWorkerTailPrompt } from "../../src/batch/worker-prompt.mjs";
import { loadRulesProfile } from "../../src/config/cursor-rules/profile.mjs";
import { buildWorkerContextAsync } from "../../src/config/worker-context.mjs";

/**
 * Hermetic fixture: temp project root with on-disk `.cursor/rules` (and an
 * optional `.spine/rules-profile.json`). Tests never read the real repo rules.
 *
 * @param {{ profile?: object }} [options]
 * @returns {Promise<string>} fixture project root
 */
async function createRulesFixture({ profile } = {}) {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-prompt-rules-"));
	const rulesDir = path.join(root, ".cursor", "rules");
	fs.mkdirSync(rulesDir, { recursive: true });

	fs.writeFileSync(
		path.join(rulesDir, "taskplane-worker-cursor.mdc"),
		"---\nalwaysApply: true\n---\n# Worker rules body.\n",
		"utf-8",
	);
	fs.writeFileSync(
		path.join(rulesDir, "critical-rules-quick-reference.mdc"),
		"---\nalwaysApply: true\n---\n# Critical rules body.\n",
		"utf-8",
	);
	fs.writeFileSync(
		path.join(rulesDir, "javascript-3-development-standards.mdc"),
		'---\ndescription: JavaScript standards\nglobs: ["src/**/*.mjs"]\n---\n# JS standards body.\n',
		"utf-8",
	);

	if (profile) {
		fs.mkdirSync(path.join(root, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(root, ".spine", "rules-profile.json"),
			JSON.stringify(profile),
			"utf-8",
		);
	}

	return root;
}

const FIXTURE_FILE_SCOPE = [
	"src/config/worker-context.mjs",
	"src/batch/worker-prompt.mjs",
];

test("buildWorkerTailPrompt includes critical-rules for JS-scoped task", async () => {
	const root = await createRulesFixture();
	try {
		const taskFolder = path.join(root, "spine-tasks", "SP-829-test");
		const tail = await buildWorkerTailPrompt({
			worktreePath: root,
			taskFolder,
			donePath: path.join(taskFolder, ".DONE"),
			reviewLevel: 0,
			includePromptInclude: false,
			config: {},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
		});

		assert.match(tail, /Project standards & reference/);
		assert.match(tail, /critical-rules-quick-reference\.mdc/);

		const context = await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
		});
		assert.equal(context.selection?.mode, "auto");
		assert.ok(
			context.selection?.paths?.includes(
				".cursor/rules/javascript-3-development-standards.mdc",
			),
			"JS glob rule selected for file scope",
		);
		assert.ok(
			context.selection?.paths?.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
			"default always rule selected",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync appends config.standards end-to-end", async () => {
	const root = await createRulesFixture();
	try {
		fs.writeFileSync(
			path.join(root, ".cursor", "rules", "custom-standard.mdc"),
			"---\ndescription: Custom standard\n---\n# Custom standard body.\n",
			"utf-8",
		);
		const standardPath = ".cursor/rules/custom-standard.mdc";
		const result = await buildWorkerContextAsync({
			config: {
				standards: [standardPath, standardPath],
			},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
		});

		const pathMatches = result.selection?.paths?.filter((entry) => entry === standardPath) ?? [];
		assert.equal(pathMatches.length, 1, "standards append is deduped in selection paths");
		const standardEntries =
			result.selection?.entries?.filter((entry) => entry.contextPath === standardPath) ?? [];
		assert.equal(standardEntries.length, 1, "one selection entry for the standard");
		assert.equal(standardEntries[0]?.source, "standards");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("worker profile neverInclude wins over alwaysInclude", async () => {
	const root = await createRulesFixture({
		profile: {
			profileVersion: 1,
			worker: {
				alwaysInclude: ["gold-rule.mdc"],
				neverInclude: ["gold-rule.mdc"],
			},
		},
	});
	try {
		fs.writeFileSync(
			path.join(root, ".cursor", "rules", "gold-rule.mdc"),
			"---\ndescription: Gold rule\n---\n# Gold rule body.\n",
			"utf-8",
		);

		const result = await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
		});

		assert.equal(result.selection?.mode, "auto");
		assert.ok(
			!result.selection?.paths?.some((entry) => entry.includes("gold-rule.mdc")),
			"neverInclude blocks the alwaysInclude entry",
		);
		assert.ok(
			result.selection?.paths?.includes(".cursor/rules/taskplane-worker-cursor.mdc"),
			"default always rule still selected",
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("invalid rules profile falls back to static context with profileError", async () => {
	const root = await createRulesFixture({
		profile: {
			profileVersion: 1,
			worker: {
				neverInclude: ["../escape.mdc"],
			},
		},
	});
	try {
		const loaded = loadRulesProfile(root);
		assert.equal(loaded.ok, false);
		if (!loaded.ok) {
			assert.equal(loaded.error.code, "RULES_PROFILE_INVALID");
			assert.match(loaded.error.message, /path traversal/);
		}

		// reviewer.maxRules must be a positive integer (validator key check).
		fs.writeFileSync(
			path.join(root, ".spine", "rules-profile.json"),
			JSON.stringify({ profileVersion: 1, reviewer: { maxRules: 0 } }),
			"utf-8",
		);
		const maxRulesCheck = loadRulesProfile(root);
		assert.equal(maxRulesCheck.ok, false);
		if (!maxRulesCheck.ok) {
			assert.equal(maxRulesCheck.error.code, "RULES_PROFILE_INVALID");
			assert.match(maxRulesCheck.error.message, /reviewer\.maxRules/);
		}

		const result = await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
		});
		assert.equal(result.selection?.mode, "static");
		assert.equal(result.selection?.profileError?.code, "RULES_PROFILE_INVALID");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync emits worker.rules_selected journal event", async () => {
	const root = await createRulesFixture();
	const journalRoot = await mkdtemp(path.join(os.tmpdir(), "spine-rules-journal-"));
	const batchId = "batch-rules-test";
	try {
		fs.mkdirSync(path.join(journalRoot, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		await buildWorkerContextAsync({
			config: {},
			projectRoot: root,
			taskFileScope: FIXTURE_FILE_SCOPE,
			journal: {
				projectRoot: journalRoot,
				batchId,
				taskId: "SP-829",
				laneNumber: 1,
				correlationId: "corr-rules",
			},
		});

		const events = readJournalEvents(journalRoot, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "worker.rules_selected");
		assert.equal(events[0].taskId, "SP-829");
		assert.equal(events[0].payload.mode, "auto");
		assert.ok(Array.isArray(events[0].payload.paths));
		assert.ok(events[0].payload.paths.length > 0);
		assert.ok(Array.isArray(events[0].payload.entries));
	} finally {
		await rm(journalRoot, { recursive: true, force: true });
		await rm(root, { recursive: true, force: true });
	}
});

test("buildWorkerContextAsync falls back to static context without .cursor/rules", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-rules-fallback-"));
	try {
		const standardPath = path.join(root, "standards", "rule.md");
		fs.mkdirSync(path.dirname(standardPath), { recursive: true });
		fs.writeFileSync(standardPath, "Static standard body.\n", "utf-8");

		const result = await buildWorkerContextAsync({
			config: { standards: ["standards/rule.md"] },
			projectRoot: root,
			taskFileScope: ["src/a.mjs"],
		});

		assert.equal(result.selection?.mode, "static");
		assert.match(result.text, /Static standard body/);
		assert.doesNotMatch(result.text, /critical-rules-quick-reference/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
