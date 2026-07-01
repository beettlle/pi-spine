import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildIssueDraftBody } from "../../src/cli/issue-draft.mjs";
import {
	parseIssueDraftArgs,
	runSpineIssue,
	runSpineIssueDraft,
} from "../../bin/spine-issue.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const SPINE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "spine.mjs");

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 */
function runSpine(argv, options = {}) {
	return spawnSync(process.execPath, [SPINE_BIN, ...argv], {
		cwd: options.cwd ?? process.cwd(),
		env: options.env ?? process.env,
		encoding: "utf-8",
	});
}

test("parseIssueDraftArgs applies defaults and flags", () => {
	const defaults = parseIssueDraftArgs([]);
	assert.equal(defaults.issueType, "bug");
	assert.equal(defaults.outPath, ".spine/issue-draft.md");
	assert.equal(defaults.json, false);
	assert.equal(defaults.create, false);
	assert.equal(defaults.title, null);

	const parsed = parseIssueDraftArgs([
		"--type",
		"enhancement",
		"--title",
		"Custom title",
		"--json",
		"--out",
		"drafts/issue.md",
		"--create",
	]);
	assert.equal(parsed.issueType, "enhancement");
	assert.equal(parsed.title, "Custom title");
	assert.equal(parsed.json, true);
	assert.equal(parsed.outPath, "drafts/issue.md");
	assert.equal(parsed.create, true);
});

test("buildIssueDraftBody works in idle repo without batch context", async () => {
	const projectRoot = await initGitRepo("spine-issue-idle-");
	try {
		const draft = buildIssueDraftBody({ projectRoot, issueType: "bug" });
		assert.ok(draft.title);
		assert.match(draft.body, /## Summary/);
		assert.match(draft.body, /## Environment/);
		assert.match(draft.body, /## Diagnosis/);
		assert.match(draft.body, /## Journal excerpt/);
		assert.deepEqual(draft.labels, ["bug"]);
		assert.ok(!draft.body.includes("sk-live-secret"));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIssueDraft writes draft file and prints human output by default", async () => {
	const projectRoot = await initGitRepo("spine-issue-write-");
	try {
		const outPath = ".spine/custom-draft.md";
		const { exitCode, output } = runSpineIssueDraft({
			projectRoot,
			args: ["--out", outPath, "--title", "Draft title"],
		});
		assert.equal(exitCode, 0);
		assert.match(output, /^# Draft title/);
		assert.match(output, /## Summary/);

		const written = path.join(projectRoot, outPath);
		assert.ok(fs.existsSync(written));
		const body = fs.readFileSync(written, "utf-8");
		assert.match(body, /## Expected/);
		assert.match(body, /## Actual/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIssueDraft --json returns structured payload without writing file", async () => {
	const projectRoot = await initGitRepo("spine-issue-json-");
	try {
		const { exitCode, output } = runSpineIssueDraft({
			projectRoot,
			args: ["--json", "--type", "question"],
		});
		assert.equal(exitCode, 0);
		const parsed = JSON.parse(output.trim());
		assert.ok(parsed.title);
		assert.ok(parsed.body);
		assert.deepEqual(parsed.labels, ["question"]);
		assert.equal(parsed.draftPath, undefined);
		assert.ok(!fs.existsSync(path.join(projectRoot, ".spine", "issue-draft.md")));
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIssueDraft --create fails clearly when gh is missing", async () => {
	const projectRoot = await initGitRepo("spine-issue-create-");
	const originalPath = process.env.PATH ?? "";
	try {
		// Empty PATH: gh is installed at /usr/bin on GitHub Actions runners.
		process.env.PATH = "";
		const { exitCode, output } = runSpineIssueDraft({
			projectRoot,
			args: ["--create", "--title", "Upstream bug"],
		});
		assert.equal(exitCode, 1);
		assert.match(output, /gh CLI not found/);
	} finally {
		process.env.PATH = originalPath;
		await destroyGitRepo(projectRoot);
	}
});

test("runSpineIssue rejects unknown subcommands", async () => {
	const projectRoot = await initGitRepo("spine-issue-sub-");
	try {
		const { exitCode, output } = runSpineIssue({
			projectRoot,
			args: ["publish"],
		});
		assert.equal(exitCode, 1);
		assert.match(output, /Usage: spine issue draft/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("spine issue draft routes through spine.mjs help and dispatch", async () => {
	const projectRoot = await initGitRepo("spine-issue-router-");
	try {
		const help = runSpine(["help"], { cwd: projectRoot });
		assert.equal(help.status, 0, help.stderr || help.stdout);
		assert.match(help.stdout, /issue draft/);

		const draft = runSpine(["issue", "draft", "--json", "--type", "enhancement"], {
			cwd: projectRoot,
		});
		assert.equal(draft.status, 0, draft.stderr || draft.stdout);
		const parsed = JSON.parse(draft.stdout.trim());
		assert.deepEqual(parsed.labels, ["enhancement"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("buildIssueDraftBody redacts secret-like values", async () => {
	const projectRoot = await initGitRepo("spine-issue-redact-");
	try {
		fs.mkdirSync(path.join(projectRoot, ".spine"), { recursive: true });
		fs.writeFileSync(
			path.join(projectRoot, ".spine", "spine-config.json"),
			JSON.stringify({ project: { name: "test" }, tasksRoot: "spine-tasks" }, null, 2),
			"utf-8",
		);

		const draft = buildIssueDraftBody({
			projectRoot,
			issueType: "bug",
			title: "OPENAI_API_KEY=sk-test123456789",
		});
		assert.ok(!draft.title.includes("sk-test123456789"));
		assert.match(draft.title, /\[REDACTED\]/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
