import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractScript = path.join(repoRoot, "scripts/spine-stet-contract-run.sh");

/**
 * Mock stet that records which HEAD it saw at start/run, so tests can prove the
 * contract script reviews the bounded task range (SP-863) without an LLM.
 *
 * @param {string} mockBin
 * @param {{ findings?: number, runExit?: number }} opts
 */
function writeMockStet(mockBin, opts = {}) {
	const findings = opts.findings ?? 0;
	const runExit = opts.runExit ?? 0;
	const stateDir = path.join(mockBin, "stet-mock-state");
	mkdirSync(stateDir, { recursive: true });
	writeFileSync(path.join(stateDir, "findings"), String(findings), "utf-8");
	writeFileSync(path.join(stateDir, "run_exit"), String(runExit), "utf-8");
	writeFileSync(path.join(stateDir, "start_called"), "0", "utf-8");
	writeFileSync(path.join(stateDir, "finish_called"), "0", "utf-8");

	const mockStet = `#!/bin/bash
set -euo pipefail
STATE="${stateDir.replace(/\\\\/g, "\\\\\\\\")}"
case "\${1:-}" in
start)
  echo "1" > "$STATE/start_called"
  echo "\${2:-}" > "$STATE/baseline"
  git rev-parse HEAD > "$STATE/head_at_start" 2>/dev/null || true
  touch .review/session.json
  exit 0
  ;;
run)
  git rev-parse HEAD > "$STATE/head_at_run" 2>/dev/null || true
  exit "$(cat "$STATE/run_exit")"
  ;;
list)
  sub="\${2:-}"
  if [[ "$sub" == "--help" ]]; then
    echo "Usage: stet list [options]"
    echo "  --min-severity <error|warning|info|nitpick>  minimum severity"
    echo "  --min-confidence <0..1>  minimum confidence"
    exit 0
  fi
  exit 0
  ;;
status)
  if [[ -f "$STATE/baseline" ]]; then
    echo "baseline: $(cat "$STATE/baseline")"
  else
    echo "baseline: deadbeef"
  fi
  echo "findings: $(cat "$STATE/findings")"
  echo "dismissed: 0"
  exit 0
  ;;
finish)
  echo "1" > "$STATE/finish_called"
  rm -f .review/session.json
  exit 0
  ;;
*)
  echo "mock stet: unknown command $1" >&2
  exit 127
  ;;
esac
`;
	const mockPath = path.join(mockBin, "stet");
	writeFileSync(mockPath, mockStet, "utf-8");
	chmodSync(mockPath, 0o755);
	return stateDir;
}

/**
 * Hermetic child env: spine worker sessions export SPINE_IS_WORKER /
 * SPINE_WORKER_RUNNER, which would change contract behavior. Strip them;
 * tests pass explicit overrides per scenario.
 * @param {Record<string, string | undefined>} overrides
 */
function childEnv(overrides = {}) {
	const env = { ...process.env };
	delete env.SPINE_IS_WORKER;
	delete env.SPINE_WORKER_RUNNER;
	delete env.SPINE_STET_NO_AUTO_FINISH;
	return { ...env, ...overrides };
}

/**
 * Like the sibling contract-run test: never throws.
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 * @param {string[]} args
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
function runContractCapture(root, env = {}, args = ["default"]) {
	const result = spawnSync("bash", [contractScript, ...args], {
		cwd: root,
		env: childEnv(env),
		encoding: "utf8",
	});
	return {
		status: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

/**
 * @param {string} root
 * @param {string[]} args
 */
function git(root, args) {
	return execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], {
		cwd: root,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	}).trim();
}

/**
 * @param {string} root
 * @param {string} relPath
 * @param {string} message
 * @returns {string} new HEAD sha
 */
function commitFile(root, relPath, message) {
	mkdirSync(path.dirname(path.join(root, relPath)), { recursive: true });
	writeFileSync(path.join(root, relPath), `${message}\n`, "utf-8");
	git(root, ["add", relPath]);
	git(root, ["commit", "-q", "-m", message]);
	return git(root, ["rev-parse", "HEAD"]);
}

/**
 * Lane with task A then task B serialized: lane baseline, A's STATUS + code,
 * B's STATUS + code — so a re-run for SP-1 happens with HEAD already at B's
 * last commit (the #373 retry scenario).
 * @param {string} root
 */
function seedSerializedLane(root) {
	git(root, ["init", "-q"]);
	const laneBaseline = commitFile(root, "README", "lane base");
	const aStep0 = commitFile(root, "spine-tasks/SP-1-a/STATUS.md", "A step 0");
	const aCode = commitFile(root, "src/a.mjs", "A code");
	const bStep0 = commitFile(root, "spine-tasks/SP-2-b/STATUS.md", "B step 0");
	const bHead = commitFile(root, "src/b.mjs", "B code");
	return { laneBaseline, aStep0, aCode, bStep0, bHead };
}

/**
 * @param {string} root
 * @param {string} baseline
 */
function seedBaselineRef(root, baseline) {
	mkdirSync(path.join(root, ".review"), { recursive: true });
	writeFileSync(path.join(root, ".review", "spine-stet-baseline.ref"), `${baseline}\n`, "utf-8");
}

/**
 * @param {string} root
 * @param {string} stateDir
 * @param {string} baseline
 */
function seedOpenSessionAt(root, stateDir, baseline) {
	mkdirSync(path.join(root, ".review"), { recursive: true });
	writeFileSync(path.join(root, ".review", "session.json"), '{"ok":true}\n', "utf-8");
	writeFileSync(path.join(stateDir, "baseline"), `${baseline}\n`, "utf-8");
}

/**
 * @param {string} stdout
 * @returns {{ baseline: string, end: string | null, paths: string[] }}
 */
function parsePrintRange(stdout) {
	const lines = stdout.split("\n");
	const baseline = lines.find((line) => line.startsWith("baseline: "))?.slice("baseline: ".length) ?? "";
	const endLine = lines.find((line) => line.startsWith("end: "));
	const paths = lines
		.filter((line) => line.startsWith("path: "))
		.map((line) => line.slice("path: ".length));
	return { baseline, end: endLine ? endLine.slice("end: ".length) : null, paths };
}

test("retried first task's computed range ends at its last folder commit, excluding the later sibling", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-range-print-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin);
	try {
		const { laneBaseline, aStep0 } = seedSerializedLane(root);
		seedBaselineRef(root, laneBaseline);
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_PRINT_RANGE: "1",
		}, ["default", "SP-1"]);
		assert.equal(result.status, 0);
		const range = parsePrintRange(result.stdout);
		assert.equal(range.baseline, laneBaseline, "baseline is the parent of the task's first folder commit");
		assert.equal(range.end, aStep0, "end is the task's last folder commit, not HEAD");
		assert.deepEqual(range.paths, ["spine-tasks/SP-1-a/STATUS.md"], "range paths exclude the later sibling's files");
		assert.match(result.stdout, /spine-tasks\/SP-1-a\//);
		assert.doesNotMatch(result.stdout, /src\/b\.mjs|SP-2-b/);
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0", "print mode never touches stet");
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("contract run for the retried first task reviews the task range and restores lane HEAD", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-range-detach-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin);
	try {
		const { laneBaseline, aStep0, bHead } = seedSerializedLane(root);
		const branchBefore = git(root, ["symbolic-ref", "--short", "HEAD"]);
		seedBaselineRef(root, laneBaseline);
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		}, ["default", "SP-1"]);
		assert.equal(result.status, 0);
		assert.match(result.stderr, /review scoped to task commits/);
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), laneBaseline);
		assert.equal(fs.readFileSync(path.join(stateDir, "head_at_start"), "utf-8").trim(), aStep0, "stet start saw the task's last folder commit");
		assert.equal(fs.readFileSync(path.join(stateDir, "head_at_run"), "utf-8").trim(), aStep0, "stet run reviewed the bounded range, not sibling HEAD");
		assert.equal(git(root, ["rev-parse", "HEAD"]), bHead, "lane HEAD restored after the run");
		assert.equal(git(root, ["symbolic-ref", "--short", "HEAD"]), branchBefore, "lane branch reattached after the run");
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("same-task retry after sibling commits keeps the open session (dismissals survive)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-range-keep-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin);
	try {
		const { laneBaseline, bHead } = seedSerializedLane(root);
		seedBaselineRef(root, laneBaseline);
		seedOpenSessionAt(root, stateDir, laneBaseline);
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		}, ["default", "SP-1"]);
		assert.equal(result.status, 0);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0", "no dismissal-wiping restart when the task baseline is stable");
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review", "session.json")), true);
		assert.equal(git(root, ["rev-parse", "HEAD"]), bHead, "lane HEAD restored after the run");
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("task folder with no commits after the lane baseline keeps the lane baseline behavior", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-range-nocommits-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	writeMockStet(mockBin);
	try {
		const { laneBaseline } = seedSerializedLane(root);
		mkdirSync(path.join(root, "spine-tasks", "SP-3-c"), { recursive: true });
		seedBaselineRef(root, laneBaseline);
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_PRINT_RANGE: "1",
		}, ["default", "SP-3"]);
		assert.equal(result.status, 0);
		const range = parsePrintRange(result.stdout);
		assert.equal(range.baseline, laneBaseline, "baseline stays at the lane baseline (fail-closed / empty task diff)");
		assert.equal(range.end, null, "no end bound without task commits");
		assert.deepEqual(range.paths, []);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("single-task lane whose HEAD touches the task folder does not detach", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-range-nodetach-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin);
	try {
		git(root, ["init", "-q"]);
		const laneBaseline = commitFile(root, "README", "lane base");
		const head = commitFile(root, "spine-tasks/SP-1-a/STATUS.md", "A step 0 with code");
		const branchBefore = git(root, ["symbolic-ref", "--short", "HEAD"]);
		seedBaselineRef(root, laneBaseline);
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		}, ["default", "SP-1"]);
		assert.equal(result.status, 0);
		assert.doesNotMatch(result.stderr, /temporarily detached/);
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), laneBaseline);
		assert.equal(git(root, ["rev-parse", "HEAD"]), head, "HEAD never moved");
		assert.equal(git(root, ["symbolic-ref", "--short", "HEAD"]), branchBefore);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});
