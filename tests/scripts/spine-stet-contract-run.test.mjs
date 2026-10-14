import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
 * @param {string} mockBin
 * @param {{ findings?: number, dismissed?: number, runExit?: number, listFails?: boolean }} opts
 */
function writeMockStet(mockBin, opts = {}) {
	const findings = opts.findings ?? 0;
	const dismissed = opts.dismissed ?? 0;
	const runExit = opts.runExit ?? 0;
	const listFails = opts.listFails ?? false;
	const stateDir = path.join(mockBin, "stet-mock-state");
	mkdirSync(stateDir, { recursive: true });
	writeFileSync(path.join(stateDir, "findings"), String(findings), "utf-8");
	writeFileSync(path.join(stateDir, "dismissed"), String(dismissed), "utf-8");
	writeFileSync(path.join(stateDir, "run_exit"), String(runExit), "utf-8");
	writeFileSync(path.join(stateDir, "list_fails"), listFails ? "1" : "0", "utf-8");
	writeFileSync(path.join(stateDir, "start_called"), "0", "utf-8");
	writeFileSync(path.join(stateDir, "finish_called"), "0", "utf-8");

	const mockStet = `#!/bin/bash
set -euo pipefail
STATE="${stateDir.replace(/\\\\/g, "\\\\\\\\")}"
case "\${1:-}" in
start)
  echo "1" > "$STATE/start_called"
  echo "\${2:-}" > "$STATE/baseline"
  touch .review/session.json
  exit 0
  ;;
run)
  exit "$(cat "$STATE/run_exit")"
  ;;
list)
  if [[ "$(cat "$STATE/list_fails")" == "1" ]]; then
    echo "mock stet: list failed" >&2
    exit 1
  fi
  n="$(cat "$STATE/findings")"
  for ((i = 1; i <= n; i++)); do
    echo "F-$i: active finding $i"
  done
  exit 0
  ;;
status)
  echo "baseline: deadbeef"
  echo "findings: $(( $(cat "$STATE/findings") + $(cat "$STATE/dismissed") ))"
  echo "dismissed: $(cat "$STATE/dismissed")"
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
 * @param {string} root
 * @param {{ session?: boolean, baseline?: string }} opts
 */
function seedReviewDir(root, opts = {}) {
	const reviewDir = path.join(root, ".review");
	mkdirSync(reviewDir, { recursive: true });
	if (opts.session !== false) {
		writeFileSync(path.join(reviewDir, "session.json"), '{"ok":true}\n', "utf-8");
	}
	if (opts.baseline) {
		writeFileSync(path.join(reviewDir, "spine-stet-baseline.ref"), `${opts.baseline}\n`, "utf-8");
	}
}

/**
 * Hermetic child env: spine worker sessions export SPINE_STET_NO_AUTO_FINISH=1
 * (and SPINE_IS_WORKER / SPINE_WORKER_RUNNER), which would change contract
 * behavior. Strip them; tests pass explicit overrides per scenario.
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
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 * @param {string[]} args
 */
function runContract(root, env = {}, args = ["default"]) {
	return execFileSync("bash", [contractScript, ...args], {
		cwd: root,
		env: childEnv(env),
		encoding: "utf8",
	});
}

/**
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 * @param {string[]} args
 */
function runContractExpectFail(root, env = {}, args = ["default"]) {
	try {
		execFileSync("bash", [contractScript, ...args], {
			cwd: root,
			env: childEnv(env),
			encoding: "utf8",
		});
		return { status: 0, stdout: "", stderr: "" };
	} catch (error) {
		const execError = /** @type {NodeJS.ErrnoException & { status?: number, stdout?: string, stderr?: string }} */ (
			error
		);
		return {
			status: execError.status ?? 1,
			stdout: execError.stdout ?? "",
			stderr: execError.stderr ?? "",
		};
	}
}

test("zero findings auto-finishes session (legacy --auto-finish-zero behavior)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-zero-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		runContract(root, { PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}` });
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "1");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("dismissed-only findings pass and finish (status counts them, list omits them)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-dismissed-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, dismissed: 3, runExit: 0 });
	seedReviewDir(root);
	try {
		runContract(root, { PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}` });
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "1");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("non-zero active findings fail contract with triage instructions and leave session open", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-findings-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 2, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /found 2 active finding/);
		assert.match(result.stderr, /stet list/);
		assert.match(result.stderr, /stet dismiss/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("stet run failure fails the contract with its exit code and does not finish", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-runfail-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 3 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 3);
		assert.match(result.stderr, /run failed \(exit 3\)/);
		assert.match(result.stderr, /stet doctor/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("stet list failure exits 1 without finishing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-listfail-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, listFails: true, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /stet list.*failed/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("invalid strictness exits 2 before touching stet", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-strict-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(
			root,
			{ PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}` },
			["bogus"],
		);
		assert.equal(result.status, 2);
		assert.match(result.stderr, /invalid strictness 'bogus'/);
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0");
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("SPINE_STET_NO_AUTO_FINISH=1 skips finish on zero findings", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-no-finish-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		runContract(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		});
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("restores session from baseline ref when session.json is missing", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-restore-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	seedReviewDir(root, { session: false, baseline: "abc123deadbeef" });
	try {
		runContract(root, { PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}` });
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "1");
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), "abc123deadbeef");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("missing session and baseline ref exits non-zero", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-missing-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	writeMockStet(mockBin);
	mkdirSync(path.join(root, ".review"), { recursive: true });
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /spine-stet-baseline\.ref/);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
