import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import {
	ensureGitignoreEntries,
	SPINE_GITIGNORE_ENTRIES,
} from "../../src/config/spine-init-constants.mjs";

function readGitignoreLines(projectRoot) {
	const gitignorePath = path.join(projectRoot, ".gitignore");
	if (!fs.existsSync(gitignorePath)) return [];
	return fs.readFileSync(gitignorePath, "utf-8").split(/\r?\n/).map((line) => line.trim());
}

test("SPINE_GITIGNORE_ENTRIES includes run-metrics.jsonl", () => {
	assert.ok(SPINE_GITIGNORE_ENTRIES.includes(".spine/run-metrics.jsonl"));
});

test("ensureGitignoreEntries adds run-metrics path on fresh init", async () => {
	const projectRoot = await mkdtemp(path.join(os.tmpdir(), "spine-gitignore-metrics-"));
	try {
		const result = ensureGitignoreEntries(projectRoot, { dryRun: false });
		assert.ok(result.added.includes(".spine/run-metrics.jsonl"));

		const lines = readGitignoreLines(projectRoot);
		for (const entry of SPINE_GITIGNORE_ENTRIES) {
			assert.ok(lines.includes(entry), `missing gitignore entry: ${entry}`);
		}
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
