/**
 * Arch guard against new `@ts-nocheck` in all `.mjs` files under `src/` recursively
 * (SP-749 / #266 Phase 0).
 *
 * `// @ts-nocheck` disables type checking for an entire module, so every new use
 * is typing debt: this test fails unless the file is already in NOCHECK_ALLOWLIST.
 * Existing debt (171 files at guard time) stays allowlisted so CI is green today;
 * SP-750 owns the removal pass.
 *
 * How to shrink NOCHECK_ALLOWLIST: remove the `@ts-nocheck` directive from the
 * source file (type it properly, per SP-750), then delete its allowlist entry.
 * The hygiene test below fails on stale entries — a removed file, or a file that
 * no longer carries the directive — so the list cannot drift in either direction.
 * Never add new entries: fix the file instead.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");
const NOCHECK_PATTERN = /@ts-nocheck/;

/**
 * Files allowed to carry `@ts-nocheck`, as repo-relative POSIX paths, seeded from
 * the 171 offenders present when SP-749 landed (#266 Phase 0). Sorted for
 * reviewability. See the file header for the shrink procedure; do not add entries.
 *
 * @type {ReadonlySet<string>}
 */
const NOCHECK_ALLOWLIST = new Set([
		"src/batch/abort.mjs",
	"src/batch/agent-session-worker.mjs",
	"src/batch/attached-engine-handoff.mjs",
	"src/batch/attached-runner-promote.mjs",
	"src/batch/attached-runner-reconcile.mjs",
	"src/batch/attached-runner.mjs",
	"src/batch/batch-meta-reconstruct.mjs",
	"src/batch/batch-meta.mjs",
	"src/batch/batch-state-lock.mjs",
	"src/batch/contract-exec.mjs",
	"src/batch/contract-parse.mjs",
	"src/batch/contract-prelanded.mjs",
	"src/batch/contract-task-start.mjs",
	"src/batch/contract-verify.mjs",
	"src/batch/detached-diagnostics.mjs",
	"src/batch/detached-run.mjs",
	"src/batch/detached-start.mjs",
	"src/batch/detached-wait.mjs",
	"src/batch/diagnosis-gate-ready.mjs",
	"src/batch/diagnosis-handoff-packet.mjs",
	"src/batch/diagnosis-launch-failure.mjs",
	"src/batch/diagnosis-merge-failure.mjs",
	"src/batch/diagnosis-parent-exit.mjs",
	"src/batch/diagnosis-pending-lane.mjs",
	"src/batch/diagnosis-retry-command.mjs",
	"src/batch/diagnosis-retry-limbo.mjs",
	"src/batch/diagnosis-suggested-command.mjs",
	"src/batch/diagnosis-tail-state.mjs",
	"src/batch/diagnosis-task-done.mjs",
	"src/batch/diagnosis-worker-done-missing.mjs",
	"src/batch/diagnosis.mjs",
	"src/batch/engine-lanes.mjs",
	"src/batch/engine-lanes/commit.mjs",
	"src/batch/engine-lanes/matrix-run.mjs",
	"src/batch/engine-lanes/matrix.mjs",
	"src/batch/engine-lanes/merge.mjs",
	"src/batch/engine-lanes/orch-sync.mjs",
	"src/batch/engine-lanes/phase.mjs",
	"src/batch/engine-lanes/queue.mjs",
	"src/batch/engine-lanes/review-code.mjs",
	"src/batch/engine-lanes/review-final.mjs",
	"src/batch/engine-lanes/review-plan.mjs",
	"src/batch/engine-lanes/review-poll.mjs",
	"src/batch/engine-lanes/review-stub.mjs",
	"src/batch/engine-lanes/review.mjs",
	"src/batch/engine-scope.mjs",
	"src/batch/evidence.mjs",
	"src/batch/gate-evidence-collect.mjs",
	"src/batch/gate-evidence-read.mjs",
	"src/batch/gate-posture-approve.mjs",
	"src/batch/gate-revision.mjs",
	"src/batch/gate.mjs",
	"src/batch/heartbeat-git-debounce.mjs",
	"src/batch/heartbeat-subprocess.mjs",
	"src/batch/heartbeat.mjs",
	"src/batch/integrate-git.mjs",
	"src/batch/integrate-worktree.mjs",
	"src/batch/integrate.mjs",
	"src/batch/journal-rebuild-drift.mjs",
	"src/batch/journal-rebuild-structural.mjs",
	"src/batch/journal-rebuild.mjs",
	"src/batch/journal.mjs",
	"src/batch/lane-commit.mjs",
	"src/batch/lane-dirty-check-commit.mjs",
	"src/batch/lane-dirty-check-git.mjs",
	"src/batch/lane-dirty-check.mjs",
	"src/batch/lifecycle-archive.mjs",
	"src/batch/lifecycle.mjs",
	"src/batch/limbo-detect.mjs",
	"src/batch/macro-phase.mjs",
	"src/batch/merge/adoption-doc-merge.mjs",
	"src/batch/merge/wave-merge-state.mjs",
	"src/batch/metrics-rollup.mjs",
	"src/batch/metrics.mjs",
	"src/batch/orphan-detect.mjs",
	"src/batch/parent-session-monitor.mjs",
	"src/batch/pause.mjs",
	"src/batch/post-merge-finalize.mjs",
	"src/batch/post-merge-limbo.mjs",
	"src/batch/postmortem.mjs",
	"src/batch/readers/spine-state.mjs",
	"src/batch/readers/taskplane-state.mjs",
	"src/batch/reconcile-batch.mjs",
	"src/batch/reconcile-classify.mjs",
	"src/batch/reconcile-diagnosis-context.mjs",
	"src/batch/reconcile-diagnosis.mjs",
	"src/batch/reconcile-light-cache.mjs",
	"src/batch/reconcile-orphan.mjs",
	"src/batch/reconcile.mjs",
	"src/batch/resume-common.mjs",
	"src/batch/resume-engine.mjs",
	"src/batch/resume-gate-reopen.mjs",
	"src/batch/resume-multi-lanes.mjs",
	"src/batch/resume-multi-queue.mjs",
	"src/batch/resume-multi-validate.mjs",
	"src/batch/resume-multi.mjs",
	"src/batch/resume-prompt-parse-fail.mjs",
	"src/batch/resume-single-validate.mjs",
	"src/batch/resume-validation.mjs",
	"src/batch/resume.mjs",
	"src/batch/retry.mjs",
	"src/batch/review-artifacts.mjs",
	"src/batch/review-shared.mjs",
	"src/batch/review-spawn.mjs",
	"src/batch/review-step-run.mjs",
	"src/batch/review-step.mjs",
	"src/batch/review.mjs",
	"src/batch/rules-manifest-drift.mjs",
	"src/batch/salvage-batch-integrate-gate.mjs",
	"src/batch/salvage-batch-integrate.mjs",
	"src/batch/salvage-batch-list.mjs",
	"src/batch/salvage-batch.mjs",
	"src/batch/salvage.mjs",
	"src/batch/state-guards.mjs",
	"src/batch/state-io.mjs",
	"src/batch/state.mjs",
	"src/batch/supervisor-spawn.mjs",
	"src/batch/task-stall-budget.mjs",
	"src/batch/worker-output.mjs",
	"src/batch/worker-prompt.mjs",
	"src/config/agent-model-resolve.mjs",
	"src/config/contract.mjs",
	"src/config/cursor-rules/discover.mjs",
	"src/config/cursor-rules/match-globs.mjs",
	"src/config/cursor-rules/parse-frontmatter.mjs",
	"src/config/cursor-rules/profile.mjs",
	"src/config/cursor-rules/select.mjs",
	"src/config/env-overrides.mjs",
	"src/config/pi-spine-root.mjs",
	"src/config/preflight/discovery.mjs",
	"src/config/preflight/git-batch.mjs",
	"src/config/preflight/integrate-plan.mjs",
	"src/config/preflight/loc-capstone.mjs",
	"src/config/reviewer-context.mjs",
	"src/config/settings-fields.mjs",
	"src/config/spine-config-schema.mjs",
	"src/config/spine-init-constants.mjs",
	"src/config/spine-preflight-lib.mjs",
	"src/config/worker-backend.mjs",
	"src/config/worker-context.mjs",
	"src/config/worker-launch-script.mjs",
	"src/config/worktree-setup-hook.mjs",
	"src/dashboard/running-tail-state.mjs",
	"src/doctor/agent-model-inherit.mjs",
	"src/doctor/agent-models.mjs",
	"src/doctor/coexistence.mjs",
	"src/doctor/duplicate-install.mjs",
	"src/doctor/pi-cli-resolution.mjs",
	"src/doctor/quota-risk.mjs",
	"src/doctor/run-doctor-checks.mjs",
	"src/doctor/stale-path.mjs",
	"src/doctor/stall-config.mjs",
	"src/doctor/suggest-max-parallel.mjs",
	"src/doctor/task-packet-size.mjs",
	"src/doctor/worktree-health.mjs",
	"src/metrics/quota-cli.mjs",
	"src/metrics/quota-probes.mjs",
	"src/metrics/quota-snapshot.mjs",
	"src/planner/cycles.mjs",
	"src/planner/file-scope.mjs",
	"src/planner/format-plan.mjs",
	"src/planner/graph.mjs",
	"src/planner/scope.mjs",
	"src/planner/wave-scope.mjs",
	"src/planner/waves.mjs",
	"src/tasks/packet/merge-deps.mjs",
	"src/tasks/packet/parse-prompt.mjs",
	"src/tasks/packet/parse-status.mjs",
	"src/tasks/packet/validate-contract.mjs",
	"src/tasks/packet/validate-prompt.mjs",
	"src/tasks/validate-contract-warn.mjs",
]);

/**
 * Recursively list every `.mjs` file under `dir`.
 *
 * @param {string} dir
 * @returns {string[]} absolute paths, sorted
 */
function listMjsFiles(dir) {
	/** @type {string[]} */
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listMjsFiles(fullPath));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".mjs")) {
			files.push(fullPath);
		}
	}
	return files.sort();
}

/**
 * Absolute paths of files under `rootDir` whose content carries the directive.
 *
 * @param {string} rootDir
 * @returns {string[]}
 */
function findNocheckFiles(rootDir) {
	return listMjsFiles(rootDir).filter((filePath) =>
		NOCHECK_PATTERN.test(fs.readFileSync(filePath, "utf-8")),
	);
}

/**
 * Repo-root-relative POSIX path for an absolute path.
 *
 * @param {string} absolutePath
 * @param {string} fromDir
 * @returns {string}
 */
function relativePosix(absolutePath, fromDir) {
	return path.relative(fromDir, absolutePath).split(path.sep).join("/");
}

test("no new @ts-nocheck outside the allowlist in src/", () => {
	const offenders = findNocheckFiles(SRC_ROOT).map((filePath) =>
		relativePosix(filePath, REPO_ROOT),
	);
	const violations = offenders.filter((filePath) => !NOCHECK_ALLOWLIST.has(filePath));
	assert.deepEqual(
		violations,
		[],
		`New \`@ts-nocheck\` introduced in src/ (#266 Phase 0):\n${violations.join("\n")}\n` +
			"Do not allowlist new files — remove the directive and type the module properly (SP-750).",
	);
});

test("allowlist is live: every entry exists and still carries the directive", () => {
	/** @type {string[]} */
	const stale = [];
	for (const entry of NOCHECK_ALLOWLIST) {
		const absolutePath = path.join(REPO_ROOT, ...entry.split("/"));
		if (!fs.existsSync(absolutePath)) {
			stale.push(`${entry} (file removed)`);
		} else if (!NOCHECK_PATTERN.test(fs.readFileSync(absolutePath, "utf-8"))) {
			stale.push(`${entry} (nocheck removed — prune this entry)`);
		}
	}
	assert.deepEqual(
		stale,
		[],
		`Stale NOCHECK_ALLOWLIST entries in tests/arch/ts-nocheck-guard.test.mjs:\n${stale.join("\n")}\n` +
			"Prune them so the allowlist tracks remaining #266 debt (SP-750).",
	);
});

test("scanner detects leading and mid-file directives in synthetic trees", () => {
	const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ts-nocheck-guard-"));
	try {
		fs.writeFileSync(path.join(tmpRoot, "clean.mjs"), "export const x = 1;\n");
		fs.writeFileSync(path.join(tmpRoot, "leading.mjs"), "// @ts-nocheck\nexport const y = 2;\n");
		fs.writeFileSync(path.join(tmpRoot, "mid.mjs"), "export const z = 3; // @ts-nocheck\n");
		fs.mkdirSync(path.join(tmpRoot, "nested"));
		fs.writeFileSync(path.join(tmpRoot, "nested", "deep.mjs"), "// @ts-nocheck\nexport {};\n");
		const found = findNocheckFiles(tmpRoot).map((filePath) => relativePosix(filePath, tmpRoot));
		assert.deepEqual(found, ["leading.mjs", "mid.mjs", "nested/deep.mjs"]);
	} finally {
		fs.rmSync(tmpRoot, { recursive: true, force: true });
	}
});

test("real src scan finds exactly the allowlisted set (scanner cannot silently pass)", () => {
	const found = findNocheckFiles(SRC_ROOT);
	assert.equal(
		found.length,
		NOCHECK_ALLOWLIST.size,
		"src/ nocheck count diverged from the allowlist — the scanner or the allowlist drifted",
	);
});
