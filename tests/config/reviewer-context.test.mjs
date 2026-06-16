import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	buildReviewerContext,
	DEFAULT_REVIEWER_CONTEXT_BYTE_CAP,
	emitReviewerRulesSelected,
} from "../../src/config/reviewer-context.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("DEFAULT_REVIEWER_CONTEXT_BYTE_CAP is 16KiB", () => {
	assert.equal(DEFAULT_REVIEWER_CONTEXT_BYTE_CAP, 16_384);
});

test("buildReviewerContext skips when .cursor/rules is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-skip-"));
	try {
		const result = buildReviewerContext({
			projectRoot: root,
			config: { standards: ["standards/rule.md"] },
			reviewType: "plan",
			scopePaths: ["src/a.mjs"],
		});

		assert.equal(result.text, "");
		assert.equal(result.selection?.mode, "skipped");
		assert.doesNotMatch(result.text, /referenceDocs/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerContext does not inject referenceDocs", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-no-ref-"));
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });
		fs.writeFileSync(
			path.join(rulesDir, "critical-rules-quick-reference.mdc"),
			"---\nalwaysApply: true\n---\n# Critical\n",
			"utf-8",
		);

		const refDoc = path.join(root, "docs", "secret-ref.md");
		fs.mkdirSync(path.dirname(refDoc), { recursive: true });
		fs.writeFileSync(refDoc, "REFERENCE DOC ONLY\n", "utf-8");

		const result = buildReviewerContext({
			projectRoot: root,
			config: {
				referenceDocs: ["docs/secret-ref.md"],
				standards: [],
			},
			reviewType: "code",
			scopePaths: [],
		});

		assert.doesNotMatch(result.text, /REFERENCE DOC ONLY/);
		assert.doesNotMatch(result.text, /secret-ref/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerContext truncates at byte cap", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-cap-"));
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });

		const smallChunk = "y".repeat(3_000);
		fs.writeFileSync(
			path.join(rulesDir, "rule-a.mdc"),
			`---\nalwaysApply: true\n---\n# A\n${smallChunk}\n`,
			"utf-8",
		);
		fs.writeFileSync(
			path.join(rulesDir, "rule-b.mdc"),
			`---\nalwaysApply: true\n---\n# B\n${smallChunk}\n`,
			"utf-8",
		);

		const result = buildReviewerContext({
			projectRoot: root,
			config: {},
			reviewType: "plan",
			scopePaths: [],
			byteCap: 4_000,
		});

		assert.equal(result.truncated, true);
		assert.ok(result.bytesUsed <= 4_000);
		assert.match(result.text, /Project standards for review/);
		assert.equal(result.entries.length, 1);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerContext emits reviewer.rules_selected journal event", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-journal-"));
	const batchId = "batch-reviewer-test";
	try {
		fs.mkdirSync(path.join(root, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		buildReviewerContext({
			projectRoot: PROJECT_ROOT,
			config: {},
			reviewType: "code",
			scopePaths: ["src/config/reviewer-context.mjs"],
			journal: {
				projectRoot: root,
				batchId,
				taskId: "SP-250",
				laneNumber: 1,
				correlationId: "corr-reviewer",
			},
		});

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].type, "reviewer.rules_selected");
		assert.equal(events[0].taskId, "SP-250");
		assert.equal(events[0].payload.reviewType, "code");
		assert.ok(Array.isArray(events[0].payload.scopePaths));
		assert.ok(Array.isArray(events[0].payload.paths));
		assert.equal(typeof events[0].payload.capped, "boolean");
		assert.equal(typeof events[0].payload.bytesUsed, "number");
		assert.equal(events[0].payload.mode, "auto");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerContext degrades gracefully on invalid rules profile", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-profile-err-"));
	const batchId = "batch-profile-err";
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });
		fs.writeFileSync(
			path.join(rulesDir, "critical-rules-quick-reference.mdc"),
			"---\nalwaysApply: true\n---\n# Critical\n",
			"utf-8",
		);
		fs.mkdirSync(path.join(root, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(root, ".spine", "rules-profile.json"),
			"{ invalid json",
			"utf-8",
		);
		fs.mkdirSync(path.join(root, ".spine", "runtime", batchId, "journal"), {
			recursive: true,
		});

		const result = buildReviewerContext({
			projectRoot: root,
			config: {},
			reviewType: "final",
			scopePaths: [],
			journal: {
				projectRoot: root,
				batchId,
				taskId: "SP-250",
			},
		});

		assert.equal(result.text, "");
		assert.equal(result.selection?.mode, "degraded");
		assert.ok(result.selection?.profileError);

		const events = readJournalEvents(root, batchId);
		assert.equal(events.length, 1);
		assert.equal(events[0].payload.mode, "degraded");
		assert.ok(events[0].payload.profileError);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("buildReviewerContext selects rules for scoped plan review", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-reviewer-scope-"));
	try {
		const rulesDir = path.join(root, ".cursor", "rules");
		fs.mkdirSync(rulesDir, { recursive: true });
		fs.writeFileSync(
			path.join(rulesDir, "javascript-3-development-standards.mdc"),
			'---\nalwaysApply: false\nglobs: ["**/*.mjs"]\n---\n# JS standards\n',
			"utf-8",
		);
		fs.writeFileSync(
			path.join(rulesDir, "critical-rules-quick-reference.mdc"),
			"---\nalwaysApply: true\n---\n# Critical\n",
			"utf-8",
		);

		const result = buildReviewerContext({
			projectRoot: root,
			config: {},
			reviewType: "plan",
			scopePaths: ["src/config/reviewer-context.mjs"],
		});

		assert.match(result.text, /Project standards for review/);
		assert.ok(
			result.selection?.paths?.includes(
				".cursor/rules/javascript-3-development-standards.mdc",
			),
			"glob rule selected for scoped path",
		);
		assert.ok(result.selection?.paths?.length > 0);
		assert.equal(result.selection?.mode, "auto");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("emitReviewerRulesSelected is no-op without journal context", () => {
	emitReviewerRulesSelected(undefined, { mode: "skipped" });
	emitReviewerRulesSelected({ projectRoot: "/tmp", batchId: "" }, { mode: "skipped" });
});
