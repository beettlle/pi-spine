import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runDoctorChecks } from "../../bin/spine.mjs";
import { runBatchPreflight } from "../../src/config/spine-preflight-lib.mjs";
import {
	buildTrackedGitignoredDoctorCheck,
	checkTrackedGitignoredWarn,
	listTrackedGitignoredPaths,
	trackedGitignoredRemediation,
} from "../../src/config/preflight/tracked-gitignored.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

const TRACKED_GITIGNORED_LABEL = "tracked gitignored paths";

/**
 * Simulate issue #289: the path gets committed first and ignored afterwards
 * (or `git add -f`), leaving a tracked file that matches .gitignore.
 *
 * @param {string} projectRoot
 * @param {string} relPath
 * @param {string} ignoreEntry
 */
function commitTrackedIgnoredPath(projectRoot, relPath, ignoreEntry) {
	const absPath = path.join(projectRoot, relPath);
	fs.mkdirSync(path.dirname(absPath), { recursive: true });
	fs.writeFileSync(absPath, "state\n", "utf-8");
	fs.appendFileSync(path.join(projectRoot, ".gitignore"), `${ignoreEntry}\n`, "utf-8");
	execFileSync("git", ["add", "-f", relPath], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["add", ".gitignore"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "tracked but ignored"], {
		cwd: projectRoot,
		stdio: "ignore",
	});
}

test("checkTrackedGitignoredWarn passes quietly when no tracked files match .gitignore", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-quiet-");
	try {
		const check = checkTrackedGitignoredWarn({ projectRoot });
		assert.equal(check.id, "tracked-gitignored");
		assert.equal(check.ok, true);
		assert.notEqual(check.warning, true);
		assert.match(check.message, /no tracked files match/i);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkTrackedGitignoredWarn warns with git rm --cached remediation for tracked ignored path", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-warn-");
	try {
		commitTrackedIgnoredPath(projectRoot, "logs/state.db", "logs/");

		const listed = listTrackedGitignoredPaths(projectRoot);
		assert.equal(listed.error, null);
		assert.deepEqual(listed.paths, ["logs/state.db"]);

		const check = checkTrackedGitignoredWarn({ projectRoot });
		assert.equal(check.ok, true, "advisory check must stay non-blocking");
		assert.equal(check.warning, true);
		assert.match(check.message, /1 tracked file\(s\)/);
		assert.match(check.message, /logs\/state\.db/);
		assert.match(check.suggestedCommand, /^git rm -r --cached -- logs\/state\.db$/);
		assert.deepEqual(check.details.paths, ["logs/state.db"]);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkTrackedGitignoredWarn bounds the preview but lists every path in details", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-many-");
	try {
		for (const name of ["a", "b", "c", "d", "e"]) {
			commitTrackedIgnoredPath(projectRoot, `logs/${name}.db`, "logs/");
		}

		const check = checkTrackedGitignoredWarn({ projectRoot });
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.message, /5 tracked file\(s\)/);
		assert.match(check.message, /logs\/a\.db, logs\/b\.db, logs\/c\.db \+2 more/);
		assert.equal(check.details.paths.length, 5);
		assert.match(check.suggestedCommand, /^git rm -r --cached -- logs\/a\.db logs\/b\.db logs\/c\.db$/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("trackedGitignoredRemediation lists bounded paths", () => {
	assert.equal(
		trackedGitignoredRemediation(["x.db"]),
		"git rm -r --cached -- x.db",
	);
	assert.equal(
		trackedGitignoredRemediation(["a.db", "b.db", "c.db", "d.db"]),
		"git rm -r --cached -- a.db b.db c.db",
	);
});

test("checkTrackedGitignoredWarn and doctor check skip quietly outside a git repo", async () => {
	const plainDir = await mkdtemp(path.join(os.tmpdir(), "spine-tracked-gitignored-nogit-"));
	try {
		const check = checkTrackedGitignoredWarn({ projectRoot: plainDir });
		assert.equal(check.ok, true);
		assert.notEqual(check.warning, true);
		assert.match(check.message, /skipped/i);

		const doctorCheck = buildTrackedGitignoredDoctorCheck({ projectRoot: plainDir });
		assert.equal(doctorCheck.ok, true);
		assert.notEqual(doctorCheck.warning, true);
		assert.match(doctorCheck.detail, /skipped/i);
	} finally {
		fs.rmSync(plainDir, { recursive: true, force: true });
	}
});

test("buildTrackedGitignoredDoctorCheck warns with label and remediation", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-doctor-");
	try {
		commitTrackedIgnoredPath(projectRoot, "logs/state.db", "logs/");

		const doctorCheck = buildTrackedGitignoredDoctorCheck({ projectRoot });
		assert.equal(doctorCheck.label, TRACKED_GITIGNORED_LABEL);
		assert.equal(doctorCheck.ok, true, "doctor advisory must stay non-blocking");
		assert.equal(doctorCheck.warning, true);
		assert.match(doctorCheck.detail, /logs\/state\.db/);
		assert.match(doctorCheck.suggestedCommand, /git rm -r --cached/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runBatchPreflight stays green with a tracked-gitignored warning", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-batch-");
	try {
		commitTrackedIgnoredPath(projectRoot, "logs/state.db", "logs/");

		// Minimal valid task packet so tasks-root / dependencies-json checks pass.
		const folder = path.join(projectRoot, "spine-tasks", "SP-901-tracked-gitignored-fixture");
		fs.mkdirSync(folder, { recursive: true });
		fs.writeFileSync(
			path.join(folder, "PROMPT.md"),
			["# Task: SP-901 — fixture", "", "## Mission", "fixture", "", "## Dependencies", "- **None**", "", "## File Scope", "- `src/fixture.mjs`", "", "## Contract", "", "| Field | Value |", "| ----- | ----- |", "| testCommand | `true` |", "| fileScopeMustChange | `src/fixture.mjs` |", "", "## Steps", "### Step 1: Work", "- [ ] one", "", "### Step 2: Testing & Verification", "- [ ] verify", "", "## Completion Criteria", "- [ ] done", "", "## Do NOT", "- skip", ""].join("\n"),
			"utf-8",
		);
		fs.writeFileSync(path.join(folder, "STATUS.md"), "# Status\n", "utf-8");
		fs.writeFileSync(
			path.join(projectRoot, "spine-tasks", "dependencies.json"),
			JSON.stringify({ version: 1, tasks: { "SP-901": [] } }),
			"utf-8",
		);
		execFileSync("git", ["add", "-A"], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "task packet"], { cwd: projectRoot, stdio: "ignore" });

		const preflight = runBatchPreflight({ projectRoot, skipDoctor: true });
		assert.equal(preflight.ok, true, "default preflight must remain non-blocking (#289)");
		const check = preflight.checks.find((entry) => entry.id === "tracked-gitignored");
		assert.ok(check, "tracked-gitignored check registered in preflight");
		assert.equal(check.ok, true);
		assert.equal(check.warning, true);
		assert.match(check.message, /logs\/state\.db/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks surfaces tracked gitignored advisory without failing", async () => {
	const projectRoot = await initGitRepo("spine-tracked-gitignored-doctor-run-");
	try {
		commitTrackedIgnoredPath(projectRoot, "logs/state.db", "logs/");

		const result = runDoctorChecks(projectRoot);
		const check = result.checks.find((entry) => entry.label === TRACKED_GITIGNORED_LABEL);
		assert.ok(check, "doctor registers tracked gitignored paths check");
		assert.equal(check.ok, true, "advisory must not count toward issueCount");
		assert.equal(check.warning, true);
		assert.match(check.detail, /logs\/state\.db/);
		assert.match(check.suggestedCommand, /git rm -r --cached/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
