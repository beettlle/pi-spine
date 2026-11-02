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
 * @param {string} mockBin
 * @param {{ findings?: number, dismissed?: number, runExit?: number, listFails?: boolean, gating?: number, listHelp?: boolean }} opts
 *
 * `gating` is the count served when the script filters with `stet list --min-severity …
 * --min-confidence …` (defaults to `findings`, i.e. nothing falls below the threshold);
 * `listHelp` controls whether `stet list --help` documents `--min-severity` (default true).
 * listHelp=false models an older stet and exercises the all-findings fallback.
 */
function writeMockStet(mockBin, opts = {}) {
	const findings = opts.findings ?? 0;
	const dismissed = opts.dismissed ?? 0;
	const runExit = opts.runExit ?? 0;
	const listFails = opts.listFails ?? false;
	const gating = opts.gating ?? findings;
	const listHelp = opts.listHelp ?? true;
	const stateDir = path.join(mockBin, "stet-mock-state");
	mkdirSync(stateDir, { recursive: true });
	writeFileSync(path.join(stateDir, "findings"), String(findings), "utf-8");
	writeFileSync(path.join(stateDir, "dismissed"), String(dismissed), "utf-8");
	writeFileSync(path.join(stateDir, "run_exit"), String(runExit), "utf-8");
	writeFileSync(path.join(stateDir, "list_fails"), listFails ? "1" : "0", "utf-8");
	writeFileSync(path.join(stateDir, "gating"), String(gating), "utf-8");
	writeFileSync(path.join(stateDir, "list_help"), listHelp ? "1" : "0", "utf-8");
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
  sub="\${2:-}"
  if [[ "$sub" == "--help" ]]; then
    if [[ "$(cat "$STATE/list_help")" == "1" ]]; then
      echo "Usage: stet list [options]"
      echo "  --min-severity <error|warning|info|nitpick>  minimum severity"
      echo "  --min-confidence <0..1>  minimum confidence"
    else
      echo "Usage: stet list"
    fi
    exit 0
  fi
  if [[ "$(cat "$STATE/list_fails")" == "1" ]]; then
    echo "mock stet: list failed" >&2
    exit 1
  fi
  if [[ "$sub" == "--min-severity" ]]; then
    shift
    printf '%s\\n' "\${*}" > "$STATE/list_args"
    n="$(cat "$STATE/gating")"
  else
    n="$(cat "$STATE/findings")"
  fi
  for ((i = 1; i <= n; i++)); do
    echo "F-$i: active finding $i"
  done
  exit 0
  ;;
status)
  if [[ -f "$STATE/baseline" ]]; then
    echo "baseline: $(cat "$STATE/baseline")"
  else
    echo "baseline: deadbeef"
  fi
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
 * Like runContract but never throws: returns { status, stdout, stderr } for both exit paths.
 * @param {string} root
 * @param {Record<string, string | undefined>} env
 * @param {string[]} args
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

test("findings at or above the threshold fail the contract with threshold, full list, and triage instructions", async () => {
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
		assert.match(result.stderr, /found 2 finding\(s\) at or above the warning\/0\.8 threshold/);
		assert.match(result.stderr, /Full list of active findings/);
		assert.match(result.stderr, /F-1: active finding 1/);
		assert.match(result.stderr, /F-2: active finding 2/);
		assert.match(result.stderr, /stet list/);
		assert.match(result.stderr, /stet dismiss/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("only sub-threshold findings pass with a below-threshold note and auto-finish", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-subthreshold-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 3, gating: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 0);
		assert.match(result.stderr, /3 finding\(s\) below the warning\/0\.8 threshold did not block this lane/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "1");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), false);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("SPINE_STET_NO_AUTO_FINISH=1 keeps the session open on sub-threshold findings", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-subthreshold-nofinish-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 2, gating: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		});
		assert.equal(result.status, 0);
		assert.match(result.stderr, /2 finding\(s\) below the warning\/0\.8 threshold did not block this lane/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("old stet without --min-severity in help gates on all active findings with a warning", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-oldstet-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 1, runExit: 0, listHelp: false });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /does not support 'stet list --min-severity'; gating on all active findings/);
		assert.match(result.stderr, /found 1 active finding\(s\); this stet cannot filter by threshold/);
		assert.match(result.stderr, /stet dismiss/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.existsSync(path.join(root, ".review/session.json")), true);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("old stet with zero findings still passes and finishes (fallback never blocks clean lanes)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-oldstet-zero-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0, listHelp: false });
	seedReviewDir(root);
	try {
		const result = runContractCapture(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
		});
		assert.equal(result.status, 0);
		assert.match(result.stderr, /does not support 'stet list --min-severity'/);
		assert.doesNotMatch(result.stderr, /below the .* threshold/);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "1");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("SPINE_STET_MIN_SEVERITY=bogus exits 2 before touching stet", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-badsev-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_MIN_SEVERITY: "bogus",
		});
		assert.equal(result.status, 2);
		assert.match(result.stderr, /invalid SPINE_STET_MIN_SEVERITY 'bogus'/);
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0");
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

test("severity and confidence overrides are passed through to the gating stet list", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-override-"));
	const mockBin = path.join(root, "bin");
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 1, gating: 1, runExit: 0 });
	seedReviewDir(root);
	try {
		const result = runContractExpectFail(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_MIN_SEVERITY: "error",
			SPINE_STET_MIN_CONFIDENCE: "0.5",
		});
		assert.equal(result.status, 1);
		assert.match(result.stderr, /found 1 finding\(s\) at or above the error\/0\.5 threshold/);
		assert.equal(
			fs.readFileSync(path.join(stateDir, "list_args"), "utf-8").trim(),
			"--min-severity error --min-confidence 0.5",
		);
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
 * Lane with task A then task B serialized: lane baseline, A's STATUS + code, B's STATUS + code.
 * @param {string} root
 */
function seedSerializedLane(root) {
	git(root, ["init", "-q"]);
	const laneBaseline = commitFile(root, "README", "lane base");
	commitFile(root, "spine-tasks/SP-1-a/STATUS.md", "A step 0");
	const taskBaseline = commitFile(root, "src/a.mjs", "A code");
	commitFile(root, "spine-tasks/SP-2-b/STATUS.md", "B step 0");
	commitFile(root, "src/b.mjs", "B code");
	return { laneBaseline, taskBaseline };
}

test("restores lane baseline from the git-dir copy when .review was cleaned", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-gitdir-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	try {
		const { laneBaseline } = seedSerializedLane(root);
		mkdirSync(path.join(root, ".review"), { recursive: true });
		const gitDirRef = path.resolve(root, git(root, ["rev-parse", "--git-path", "spine-stet-baseline.ref"]));
		writeFileSync(gitDirRef, `${laneBaseline}\n`, "utf-8");
		runContract(root, {
			PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`,
			SPINE_STET_NO_AUTO_FINISH: "1",
		});
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "1");
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), laneBaseline);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

for (const [label, taskId, stderrPattern] of [
	["malformed task id", "SP-2;rm", /invalid task id/],
	["task id without a folder", "SP-9", /found 0/],
]) {
	test(`${label} exits 2 before touching stet`, async () => {
		const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-badtask-"));
		const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
		mkdirSync(mockBin, { recursive: true });
		const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
		try {
			const { laneBaseline } = seedSerializedLane(root);
			seedReviewDir(root, { session: false, baseline: laneBaseline });
			const result = runContractExpectFail(
				root,
				{ PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}` },
				["default", taskId],
			);
			assert.equal(result.status, 2);
			assert.match(result.stderr, stderrPattern);
			assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0");
		} finally {
			await rm(root, { recursive: true, force: true });
			await rm(mockBin, { recursive: true, force: true });
		}
	});
}

test("task id scopes the baseline to the parent of the task's first commit", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-task-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	try {
		const { laneBaseline, taskBaseline } = seedSerializedLane(root);
		seedReviewDir(root, { session: false, baseline: laneBaseline });
		runContract(
			root,
			{ PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`, SPINE_STET_NO_AUTO_FINISH: "1" },
			["default", "SP-2"],
		);
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), taskBaseline);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("task id restarts a session left open at another baseline", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-restart-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, runExit: 0 });
	try {
		const { laneBaseline, taskBaseline } = seedSerializedLane(root);
		seedReviewDir(root, { baseline: laneBaseline });
		writeFileSync(path.join(stateDir, "baseline"), `${laneBaseline}\n`, "utf-8");
		runContract(
			root,
			{ PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`, SPINE_STET_NO_AUTO_FINISH: "1" },
			["default", "SP-2"],
		);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "1");
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "1");
		assert.equal(fs.readFileSync(path.join(stateDir, "baseline"), "utf-8").trim(), taskBaseline);
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
	}
});

test("task id reuses a session already at the task baseline (keeps dismissals)", async () => {
	const root = await mkdtemp(path.join(os.tmpdir(), "spine-stet-contract-reuse-"));
	const mockBin = path.join(os.tmpdir(), `${path.basename(root)}-bin`);
	mkdirSync(mockBin, { recursive: true });
	const stateDir = writeMockStet(mockBin, { findings: 0, dismissed: 2, runExit: 0 });
	try {
		const { laneBaseline, taskBaseline } = seedSerializedLane(root);
		seedReviewDir(root, { baseline: laneBaseline });
		writeFileSync(path.join(stateDir, "baseline"), `${taskBaseline}\n`, "utf-8");
		runContract(
			root,
			{ PATH: `${mockBin}${path.delimiter}${process.env.PATH ?? ""}`, SPINE_STET_NO_AUTO_FINISH: "1" },
			["default", "SP-2"],
		);
		assert.equal(fs.readFileSync(path.join(stateDir, "finish_called"), "utf-8").trim(), "0");
		assert.equal(fs.readFileSync(path.join(stateDir, "start_called"), "utf-8").trim(), "0");
	} finally {
		await rm(root, { recursive: true, force: true });
		await rm(mockBin, { recursive: true, force: true });
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
