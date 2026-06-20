import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";
import { checkGitClean } from "../../bin/spine-preflight.mjs";
import { runDoctorChecks } from "../../bin/spine.mjs";
import { appendTaskMetric } from "../../src/batch/metrics.mjs";

const METRICS_REL = ".spine/run-metrics.jsonl";

test("checkGitClean passes when only metrics file has append-only drift", async () => {
	const projectRoot = await initGitRepo("spine-preflight-metrics-");
	try {
		const metricsPath = path.join(projectRoot, METRICS_REL);
		fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
		fs.writeFileSync(metricsPath, '{"recordType":"task","schemaVersion":1}\n', "utf-8");
		execFileSync("git", ["add", "-f", METRICS_REL], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "track metrics"], { cwd: projectRoot, stdio: "ignore" });

		appendTaskMetric(
			projectRoot,
			{ recordType: "task", schemaVersion: 1, taskId: "TP-001" },
			{ metrics: { enabled: true, path: METRICS_REL } },
		);

		const check = checkGitClean({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /append-only drift ignored/i);
		assert.equal(check.details.metricsAppendOnlyDrift, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkGitClean fails when metrics file content is truncated", async () => {
	const projectRoot = await initGitRepo("spine-preflight-metrics-trunc-");
	try {
		const metricsPath = path.join(projectRoot, METRICS_REL);
		fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
		fs.writeFileSync(metricsPath, '{"recordType":"task","schemaVersion":1}\n', "utf-8");
		execFileSync("git", ["add", "-f", METRICS_REL], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "track metrics"], { cwd: projectRoot, stdio: "ignore" });

		fs.writeFileSync(metricsPath, '{"recordType":"batch"}\n', "utf-8");

		const check = checkGitClean({ projectRoot });
		assert.equal(check.ok, false);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("checkGitClean passes when metrics file is gitignored and not tracked", async () => {
	const projectRoot = await initGitRepo("spine-preflight-metrics-ignored-");
	try {
		appendTaskMetric(
			projectRoot,
			{ recordType: "task", schemaVersion: 1, taskId: "TP-001" },
			{ metrics: { enabled: true, path: METRICS_REL } },
		);

		const check = checkGitClean({ projectRoot });
		assert.equal(check.ok, true);
		assert.match(check.message, /working tree clean/);
		assert.notEqual(check.details?.metricsAppendOnlyDrift, true);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("runDoctorChecks warns when metrics file is git-tracked", async () => {
	const projectRoot = await initGitRepo("spine-doctor-metrics-tracked-");
	try {
		const metricsPath = path.join(projectRoot, METRICS_REL);
		fs.mkdirSync(path.dirname(metricsPath), { recursive: true });
		fs.writeFileSync(metricsPath, '{"recordType":"task","schemaVersion":1}\n', "utf-8");
		execFileSync("git", ["add", "-f", METRICS_REL], { cwd: projectRoot, stdio: "ignore" });
		execFileSync("git", ["commit", "-m", "track metrics"], { cwd: projectRoot, stdio: "ignore" });

		const result = runDoctorChecks(projectRoot);
		const trackedCheck = result.checks.find((check) => check.label === "run-metrics.jsonl not git-tracked");
		assert.ok(trackedCheck);
		assert.equal(trackedCheck.warning, true);
		assert.match(trackedCheck.suggestedCommand, /git rm --cached/);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});
