import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
	buildLandCommentBody,
	collectDoneOnBaseTasks,
	collectIssueLinksFromTasks,
	resolveGithubSyncOnLandConfig,
	syncIssuesAfterIntegrate,
	syncIssuesOnLand,
} from "../../../src/integrations/github/sync-on-land.mjs";

const BATCH_ID = "20261123T030000";

/** Write a fake task packet: spine-tasks/SP-1-slug/PROMPT.md with a Mission. */
function makeTaskPacket(tasksRoot, folder, mission) {
	const dir = path.join(tasksRoot, folder);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(
		path.join(dir, "PROMPT.md"),
		`# Task: ${folder.split("-").slice(0, 2).join("-")} — t\n\n## Mission\n\n${mission}\n\n## Steps\n\n### Step 0: x\n`,
		"utf-8",
	);
}

/** Injectable gh runner recording calls; per-command behavior (function or static result). */
function stubGh(behavior = {}) {
	/** @type {string[][]} */
	const calls = [];
	const run = (_projectRoot, args) => {
		calls.push(args);
		const key = args[0] === "auth" ? "auth" : `issue:${args[1]}`;
		const handler = behavior[key] ?? behavior.default;
		if (typeof handler === "function") return handler(args);
		if (handler) return handler;
		return { status: 0, stdout: "", stderr: "" };
	};
	return { calls, run };
}

function baseParams(overrides = {}) {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "spine-sync-"));
	const tasksRoot = path.join(projectRoot, "spine-tasks");
	fs.mkdirSync(tasksRoot, { recursive: true });
	const journal = [];
	return {
		projectRoot,
		tasksRoot,
		journal,
		params: {
			projectRoot,
			batchId: BATCH_ID,
			doneTasks: [],
			tasksRoot,
			config: { integrations: { github: { syncOnLand: true } } },
			mergeCommit: "abc1234",
			ghPresent: () => true,
			runGh: stubGh().run,
			journalAppend: (root, batchId, type, payload) => journal.push({ type, payload }),
			readTextFile: (filePath) => fs.readFileSync(filePath, "utf-8"),
			...overrides,
		},
	};
}

// --- config resolution ---

test("sync is disabled by default (missing config / missing flag)", () => {
	assert.equal(resolveGithubSyncOnLandConfig(null), false);
	assert.equal(resolveGithubSyncOnLandConfig({}), false);
	assert.equal(resolveGithubSyncOnLandConfig({ integrations: {} }), false);
	assert.equal(resolveGithubSyncOnLandConfig({ integrations: { github: {} } }), false);
	assert.equal(resolveGithubSyncOnLandConfig({ integrations: { github: { syncOnLand: false } } }), false);
});

test("sync enables only on explicit true", () => {
	assert.equal(resolveGithubSyncOnLandConfig({ integrations: { github: { syncOnLand: true } } }), true);
});

// --- DONE-on-base mapping ---

test("collectDoneOnBaseTasks keeps completed/succeeded, drops skipped/failed", () => {
	const batch = {
		tasks: [
			{ taskId: "SP-1", status: "completed", taskFolder: "SP-1-a" },
			{ taskId: "SP-2", status: "succeeded", taskFolder: null },
			{ taskId: "SP-3", status: "skipped", taskFolder: "SP-3-c" },
			{ taskId: "SP-4", status: "failed", taskFolder: "SP-4-d" },
			{ taskId: "SP-5", status: "running", taskFolder: "SP-5-e" },
			{ taskId: "", status: "completed", taskFolder: "SP-6-f" },
			null,
		],
	};
	const done = collectDoneOnBaseTasks(batch);
	assert.deepEqual(done, [
		{ taskId: "SP-1", taskFolder: "SP-1-a" },
		{ taskId: "SP-2", taskFolder: null },
	]);
});

test("collectDoneOnBaseTasks tolerates missing batch", () => {
	assert.deepEqual(collectDoneOnBaseTasks(null), []);
	assert.deepEqual(collectDoneOnBaseTasks({}), []);
});

// --- link collection from PROMPT files ---

test("collectIssueLinksFromTasks reads Mission and maps actions", () => {
	const { tasksRoot } = baseParams();
	makeTaskPacket(tasksRoot, "SP-100-fix", "Closes #5");
	makeTaskPacket(tasksRoot, "SP-101-part", "Partial #6");
	const { links, readErrors } = collectIssueLinksFromTasks({
		tasksRoot,
		tasks: [
			{ taskId: "SP-100", taskFolder: "SP-100-fix" },
			{ taskId: "SP-101", taskFolder: "SP-101-part" },
		],
	});
	assert.deepEqual(links, [
		{ taskId: "SP-100", issue: 5, action: "close" },
		{ taskId: "SP-101", issue: 6, action: "comment" },
	]);
	assert.deepEqual(readErrors, []);
});

test("collectIssueLinksFromTasks falls back to taskId folder and records read errors", () => {
	const { tasksRoot } = baseParams();
	const { links, readErrors } = collectIssueLinksFromTasks({
		tasksRoot,
		tasks: [{ taskId: "SP-200", taskFolder: null }],
	});
	assert.deepEqual(links, []);
	assert.equal(readErrors.length, 1);
	assert.match(readErrors[0], /SP-200/);
});

// --- escape hatches ---

test("--no-github-sync skips before config evaluation", () => {
	const { params, journal } = baseParams({
		doneTasks: [{ taskId: "SP-1", taskFolder: null }],
		config: null,
		noGithubSync: true,
	});
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "no_github_sync_flag");
	assert.equal(journal.length, 0);
});

test("disabled config skips without journal events", () => {
	const { params, journal } = baseParams({
		doneTasks: [{ taskId: "SP-1", taskFolder: null }],
		config: { integrations: { github: { syncOnLand: false } } },
	});
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "sync_disabled");
	assert.equal(journal.length, 0);
});

test("no issue links skips cleanly", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [{ taskId: "SP-300", taskFolder: "SP-300-none" }],
	});
	makeTaskPacket(tasksRoot, "SP-300-none", "No links here. See #999 for context.");
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "no_issue_links");
	assert.equal(journal.length, 0);
});

test("dry-run plans actions but never calls gh or journals", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [
			{ taskId: "SP-400", taskFolder: "SP-400-c" },
			{ taskId: "SP-401", taskFolder: "SP-401-p" },
		],
		dryRun: true,
	});
	makeTaskPacket(tasksRoot, "SP-400-c", "Closes #11");
	makeTaskPacket(tasksRoot, "SP-401-p", "Partial #12");
	const gh = stubGh();
	params.runGh = gh.run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, false);
	assert.equal(result.dryRun, true);
	assert.deepEqual(result.planned, [
		{ taskId: "SP-400", issue: 11, action: "close" },
		{ taskId: "SP-401", issue: 12, action: "comment" },
	]);
	assert.equal(gh.calls.length, 0);
	assert.equal(journal.length, 0);
	assert.equal(result.synced.length, 0);
});

// --- soft failures ---

test("missing gh soft-fails with hint + journal, never throws", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [{ taskId: "SP-500", taskFolder: "SP-500-c" }],
		ghPresent: () => false,
	});
	makeTaskPacket(tasksRoot, "SP-500-c", "Closes #21");
	const gh = stubGh();
	params.runGh = gh.run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.ok, true);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "gh_missing");
	assert.match(result.hint, /GitHub CLI/);
	assert.equal(gh.calls.length, 0);
	assert.equal(journal.length, 1);
	assert.equal(journal[0].type, "github.issue_sync_failed");
	assert.equal(journal[0].payload.reason, "gh_missing");
});

test("gh auth failure soft-fails with actionable hint", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [{ taskId: "SP-501", taskFolder: "SP-501-c" }],
	});
	makeTaskPacket(tasksRoot, "SP-501-c", "Closes #22");
	const gh = stubGh({ auth: { status: 1, stderr: "not logged in" } });
	params.runGh = gh.run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "gh_auth");
	assert.match(result.hint, /gh auth login/);
	assert.equal(journal[0].type, "github.issue_sync_failed");
	assert.equal(journal[0].payload.reason, "gh_auth");
});

// --- action mapping ---

test("Closes maps to comment + close; Partial maps to comment only", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [
			{ taskId: "SP-600", taskFolder: "SP-600-c" },
			{ taskId: "SP-601", taskFolder: "SP-601-p" },
		],
	});
	makeTaskPacket(tasksRoot, "SP-600-c", "Closes #31");
	makeTaskPacket(tasksRoot, "SP-601-p", "Partial #32");
	const gh = stubGh();
	/** Body content snapshot at call time (files are cleaned up after sync). */
	const bodySnapshots = [];
	params.runGh = (root, args) => {
		if (args[1] === "comment") {
			bodySnapshots.push(fs.readFileSync(args[4], "utf-8"));
		}
		return gh.run(root, args);
	};
	const result = syncIssuesOnLand(params);
	assert.equal(result.ok, true);
	assert.deepEqual(
		result.synced.map((s) => ({ issue: s.issue, closed: s.closed })),
		[
			{ issue: 31, closed: true },
			{ issue: 32, closed: false },
		],
	);
	const commentCalls = gh.calls.filter((c) => c[0] === "issue" && c[1] === "comment");
	const closeCalls = gh.calls.filter((c) => c[0] === "issue" && c[1] === "close");
	assert.equal(commentCalls.length, 2);
	assert.deepEqual(closeCalls, [
		["issue", "close", "31", "--reason", "completed"],
	]);
	// Body arrives via --body-file, never inline (no shell quoting surface).
	assert.deepEqual(commentCalls[0], ["issue", "comment", "31", "--body-file", commentCalls[0][4]]);
	assert.match(bodySnapshots[0], /SP-600/);
	assert.equal(journal.filter((j) => j.type === "github.issue_synced").length, 2);
	const closedEvent = journal.find((j) => j.type === "github.issue_synced" && j.payload.issue === 31);
	assert.equal(closedEvent.payload.action, "close");
	assert.equal(closedEvent.payload.closed, true);
	assert.equal(closedEvent.payload.mergeCommit, "abc1234");
});

test("per-issue gh failure journals github.issue_sync_failed and continues", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [
			{ taskId: "SP-700", taskFolder: "SP-700-a" },
			{ taskId: "SP-701", taskFolder: "SP-701-b" },
		],
	});
	makeTaskPacket(tasksRoot, "SP-700-a", "Closes #41");
	makeTaskPacket(tasksRoot, "SP-701-b", "Closes #42");
	const gh = stubGh({
		"issue:comment": (args) =>
			args[2] === "41" ? { status: 1, stdout: "", stderr: "HTTP 404" } : { status: 0, stdout: "", stderr: "" },
	});
	params.runGh = gh.run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.ok, true);
	assert.equal(result.synced.length, 1);
	assert.equal(result.synced[0].issue, 42);
	assert.equal(result.failures.length, 1);
	assert.equal(result.failures[0].issue, 41);
	assert.match(result.failures[0].error, /HTTP 404/);
	const failedEvents = journal.filter((j) => j.type === "github.issue_sync_failed");
	assert.equal(failedEvents.length, 1);
	assert.equal(failedEvents[0].payload.reason, "comment_failed");
	// No close attempted after the comment failed for #41.
	assert.ok(!gh.calls.some((c) => c[1] === "close" && c[2] === "41"));
});

test("failed close after successful comment journals close_failed with hint", () => {
	const { params, journal, tasksRoot } = baseParams({
		doneTasks: [{ taskId: "SP-800", taskFolder: "SP-800-c" }],
	});
	makeTaskPacket(tasksRoot, "SP-800-c", "Closes #51");
	const gh = stubGh({ "issue:close": { status: 1, stdout: "", stderr: "boom" } });
	params.runGh = gh.run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.synced.length, 0);
	assert.equal(result.failures[0].issue, 51);
	const failedEvent = journal.find((j) => j.type === "github.issue_sync_failed");
	assert.equal(failedEvent.payload.reason, "close_failed");
	assert.match(failedEvent.payload.hint, /gh issue close 51/);
});

test("unwritable tasksRoot records prompt_unreadable and skips sync", () => {
	const { params, journal } = baseParams({
		doneTasks: [{ taskId: "SP-900", taskFolder: null }],
		tasksRoot: path.join(os.tmpdir(), `spine-missing-${Date.now()}`),
	});
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "prompt_unreadable");
	assert.equal(journal[0].payload.reason, "prompt_unreadable");
});

test("null tasksRoot skips with hint", () => {
	const { params, journal } = baseParams({
		doneTasks: [{ taskId: "SP-901", taskFolder: null }],
		tasksRoot: null,
	});
	const result = syncIssuesOnLand(params);
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "no_tasks_root");
	assert.match(result.hint, /paths\.tasksRoot/);
	assert.equal(journal.length, 0);
});

// --- integrate entry point (keeps src/batch/integrate.mjs thin, LOC cap) ---

test("syncIssuesAfterIntegrate resolves tasksRoot from config and delegates", () => {
	const { projectRoot, tasksRoot } = baseParams();
	makeTaskPacket(tasksRoot, "SP-960-c", "Closes #71");
	const gh = stubGh();
	const journal = [];
	const result = syncIssuesAfterIntegrate({
		projectRoot,
		batchId: BATCH_ID,
		batch: { tasks: [{ taskId: "SP-960", status: "completed", taskFolder: "SP-960-c" }] },
		config: {
			paths: { tasksRoot: "spine-tasks" },
			integrations: { github: { syncOnLand: true } },
		},
		mergeCommit: "f00d",
		ghPresent: () => true,
		runGh: gh.run,
		journalAppend: (root, batchId, type, payload) => journal.push({ type, payload }),
	});
	assert.equal(result.skipped, false);
	assert.equal(result.synced.length, 1);
	assert.equal(result.synced[0].issue, 71);
	assert.ok(gh.calls.some((c) => c[1] === "close" && c[2] === "71"));
});

test("syncIssuesAfterIntegrate null config disables without throwing", () => {
	const { projectRoot } = baseParams();
	const result = syncIssuesAfterIntegrate({
		projectRoot,
		batchId: BATCH_ID,
		batch: { tasks: [{ taskId: "SP-961", status: "completed", taskFolder: null }] },
		config: null,
	});
	assert.equal(result.skipped, true);
	assert.equal(result.reason, "sync_disabled");
});

test("syncIssuesAfterIntegrate internal errors journal github.issue_sync_failed and return null", () => {
	const { projectRoot, tasksRoot } = baseParams();
	makeTaskPacket(tasksRoot, "SP-962-c", "Closes #72");
	const journal = [];
	const result = syncIssuesAfterIntegrate({
		projectRoot,
		batchId: BATCH_ID,
		batch: { tasks: [{ taskId: "SP-962", status: "completed", taskFolder: "SP-962-c" }] },
		config: { paths: { tasksRoot: "spine-tasks" }, integrations: { github: { syncOnLand: true } } },
		ghPresent: () => {
			throw new Error("boom");
		},
		journalAppend: (root, batchId, type, payload) => journal.push({ type, payload }),
	});
	assert.equal(result, null);
	assert.equal(journal.length, 1);
	assert.equal(journal[0].type, "github.issue_sync_failed");
	assert.equal(journal[0].payload.reason, "internal_error");
	assert.match(journal[0].payload.hint, /spine status --diagnose/);
});

// --- comment body ---

test("land comment body names task, batch, commit; partial body keeps issue open", () => {
	const closeBody = buildLandCommentBody({ taskId: "SP-1", batchId: BATCH_ID, mergeCommit: "deadbee", action: "close" });
	assert.match(closeBody, /Landed on `main` by \*\*SP-1\*\*/);
	assert.match(closeBody, /`deadbee`/);
	assert.match(closeBody, /Closed automatically by spine/);
	const partialBody = buildLandCommentBody({ taskId: "SP-2", batchId: BATCH_ID, mergeCommit: null, action: "comment" });
	assert.match(partialBody, /Partially addressed on `main` by \*\*SP-2\*\*/);
	assert.match(partialBody, /issue left open/);
	assert.ok(!partialBody.includes("Merge commit"));
});

test("temp body files are cleaned up after sync", () => {
	const { params, projectRoot, tasksRoot } = baseParams({
		doneTasks: [{ taskId: "SP-950", taskFolder: "SP-950-c" }],
	});
	makeTaskPacket(tasksRoot, "SP-950-c", "Closes #61");
	params.runGh = stubGh().run;
	const result = syncIssuesOnLand(params);
	assert.equal(result.synced.length, 1);
	const bodyDir = path.join(projectRoot, ".spine", "github-sync");
	assert.deepEqual(fs.readdirSync(bodyDir), []);
});
