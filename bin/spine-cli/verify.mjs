/**
 * Operator verification CLIs (Phase exit audits).
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { c, FAIL, OK } from "./shared.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Modules >500 LOC grandfathered until v2.3 split (FR-SHIP-02 partial — engine-lanes split done). */
export const PHASE23_GRANDFATHERED_OVER_500 = [
	"src/batch/engine.mjs",
	"src/batch/integrate.mjs",
	"src/batch/state.mjs",
	"src/batch/worker-host.mjs",
	"src/batch/reconcile.mjs",
	"src/batch/detached-start.mjs",
	"src/batch/review.mjs",
	"src/batch/resume-multi-lanes.mjs",
	"src/batch/resume.mjs",
];

const PHASE23_ENGINE_LANES_MAX = 500;

/**
 * @param {string} projectRoot
 */
function listBatchModuleLineCounts(projectRoot) {
	const batchDir = path.join(projectRoot, "src/batch");
	if (!fs.existsSync(batchDir)) return [];

	return fs
		.readdirSync(batchDir)
		.filter((name) => name.endsWith(".mjs"))
		.map((name) => {
			const relPath = path.posix.join("src/batch", name);
			const absPath = path.join(batchDir, name);
			const lines = fs.readFileSync(absPath, "utf-8").split(/\r?\n/).length;
			return { relPath, lines };
		})
		.sort((left, right) => left.relPath.localeCompare(right.relPath));
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {boolean} [params.skipTest]
 */
export function runPhase23ExitVerify({ projectRoot, skipTest = false }) {
	/** @type {Array<{ id: string, ok: boolean, message: string }>} */
	const checks = [];

	if (!skipTest) {
		const testResult = spawnSync("npm", ["run", "typecheck"], {
			cwd: projectRoot,
			encoding: "utf-8",
			shell: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const typecheckOk = (testResult.status ?? 1) === 0;
		checks.push({
			id: "typecheck",
			ok: typecheckOk,
			message: typecheckOk
				? "npm run typecheck passed"
				: `npm run typecheck failed (exit ${testResult.status})`,
		});

		const stubTest = spawnSync("npm", ["test"], {
			cwd: projectRoot,
			encoding: "utf-8",
			env: { ...process.env, SPINE_WORKER_STUB: "1" },
			shell: true,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const stubOk = (stubTest.status ?? 1) === 0;
		checks.push({
			id: "stub-test",
			ok: stubOk,
			message: stubOk
				? "SPINE_WORKER_STUB=1 npm test passed"
				: `SPINE_WORKER_STUB=1 npm test failed (exit ${stubTest.status})`,
		});
	} else {
		checks.push({
			id: "stub-test",
			ok: true,
			message: "stub suite skipped (--skip-test)",
		});
	}

	const modules = listBatchModuleLineCounts(projectRoot);
	const engineLanes = modules.find((entry) => entry.relPath === "src/batch/engine-lanes.mjs");
	const engineLanesOk = engineLanes != null && engineLanes.lines <= PHASE23_ENGINE_LANES_MAX;
	checks.push({
		id: "engine-lanes-loc",
		ok: engineLanesOk,
		message: engineLanesOk
			? `engine-lanes.mjs within ${PHASE23_ENGINE_LANES_MAX} LOC (${engineLanes?.lines ?? 0})`
			: `engine-lanes.mjs exceeds ${PHASE23_ENGINE_LANES_MAX} LOC (${engineLanes?.lines ?? "missing"})`,
	});

	const over500 = modules.filter((entry) => entry.lines > 500);
	const ungrandfathered = over500.filter(
		(entry) => !PHASE23_GRANDFATHERED_OVER_500.includes(entry.relPath),
	);
	const locPolicyOk = ungrandfathered.length === 0;
	checks.push({
		id: "batch-loc-policy",
		ok: locPolicyOk,
		message: locPolicyOk
			? `batch module LOC policy ok (${over500.length} grandfathered >500)`
			: `unexpected >500 LOC modules: ${ungrandfathered.map((entry) => `${entry.relPath} (${entry.lines})`).join(", ")}`,
	});

	const realPiWorkflow = path.join(projectRoot, ".github/workflows/real-pi.yml");
	const realPiOk = fs.existsSync(realPiWorkflow);
	checks.push({
		id: "real-pi-workflow",
		ok: realPiOk,
		message: realPiOk
			? ".github/workflows/real-pi.yml present"
			: "real-pi workflow missing",
	});

	const runbookPath = path.join(projectRoot, "docs/adoption/operator-runbook.md");
	let runbookOk = fs.existsSync(runbookPath);
	if (runbookOk) {
		const runbook = fs.readFileSync(runbookPath, "utf-8");
		runbookOk = /real-pi|SPINE_WORKER_STUB/i.test(runbook);
	}
	checks.push({
		id: "real-pi-docs",
		ok: runbookOk,
		message: runbookOk
			? "operator runbook documents real-pi / stub posture"
			: "operator runbook missing real-pi skip guidance",
	});

	const contextPath = path.join(projectRoot, "spine-tasks/CONTEXT.md");
	let contextOk = fs.existsSync(contextPath);
	if (contextOk) {
		const context = fs.readFileSync(contextPath, "utf-8");
		contextOk = /SP-205|Phase 23|Done/i.test(context);
	}
	checks.push({
		id: "context-phase23",
		ok: contextOk,
		message: contextOk
			? "CONTEXT.md references Phase 23 / SP-205+ status"
			: "CONTEXT.md Phase 23 table not aligned",
	});

	const readinessPath = path.join(projectRoot, "docs/adoption/real-project-readiness.md");
	const readinessOk = fs.existsSync(readinessPath);
	checks.push({
		id: "readiness-doc",
		ok: readinessOk,
		message: readinessOk
			? "docs/adoption/real-project-readiness.md present"
			: "real-project-readiness.md missing (note path change in CONTEXT if relocated)",
	});

	const ok = checks.every((check) => check.ok);
	return { ok, checks, exitCode: ok ? 0 : 1 };
}

/**
 * @param {object} params
 * @param {string} params.projectRoot
 * @param {string[]} params.args
 */
export function runSpineVerify({ projectRoot, args }) {
	const sub = args[0];
	if (sub !== "phase23-exit") {
		return {
			exitCode: 1,
			output: `Usage: spine verify phase23-exit [--skip-test] [--json]\n`,
		};
	}

	const skipTest = args.includes("--skip-test");
	const json = args.includes("--json");
	const result = runPhase23ExitVerify({ projectRoot, skipTest });

	if (json) {
		return { exitCode: result.exitCode, output: `${JSON.stringify(result, null, 2)}\n` };
	}

	const lines = ["", `${c.bold}Phase 23 exit verification${c.reset}`, ""];
	for (const check of result.checks) {
		const icon = check.ok ? OK : FAIL;
		lines.push(`  ${icon} ${check.message}`);
	}
	lines.push("", result.ok ? `${OK} Phase 23 exit criteria satisfied` : `${FAIL} Phase 23 exit criteria failed`, "");
	return { exitCode: result.exitCode, output: lines.join("\n") };
}
