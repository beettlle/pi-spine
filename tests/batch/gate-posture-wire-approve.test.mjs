/**
 * SP-632 — wire gate posture evaluator into approve / land-loop (FR-REL250-10 / #123).
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import {
	approveIntegrateGate,
	hasExplicitCategoryPostureOptIn,
	loadGateRecord,
	maybeAutoApproveIntegrateGate,
	openIntegrateGate,
	rejectIntegrateGate,
} from "../../src/batch/gate.mjs";
import { getCategoryStreak } from "../../src/batch/gate-posture-streak.mjs";
import { readJournalEvents } from "../../src/batch/journal.mjs";
import {
	validateSequenceAutoApproveGate,
} from "../../src/doctor/sequence-safety.mjs";
import { destroyGitRepo, initGitRepo } from "../helpers/git-fixture.mjs";

function completedFixture(batchId, orchBranch) {
	return {
		batchId,
		phase: "completed",
		baseBranch: "main",
		orchBranch,
		startedAt: Date.now() - 60_000,
		endedAt: Date.now(),
		failedTasks: 0,
		succeededTasks: 1,
		totalTasks: 1,
		mergeResults: [{ waveIndex: 0, status: "succeeded" }],
		tasks: [{ taskId: "TP-012", status: "succeeded", taskFolder: "TP-012", doneFileFound: true }],
	};
}

function createOrchWithWork(projectRoot, orchBranch) {
	execFileSync("git", ["checkout", "-b", orchBranch], { cwd: projectRoot, stdio: "ignore" });
	fs.writeFileSync(path.join(projectRoot, "orch-work.txt"), "lane merge landed on orch", "utf-8");
	execFileSync("git", ["add", "orch-work.txt"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "orch work"], { cwd: projectRoot, stdio: "ignore" });
	execFileSync("git", ["checkout", "main"], { cwd: projectRoot, stdio: "ignore" });
}

/**
 * @param {string} projectRoot
 * @param {string} batchId
 * @param {string} orchBranch
 * @param {object|null} config
 */
function openPendingGate(projectRoot, batchId, orchBranch, config = null) {
	createOrchWithWork(projectRoot, orchBranch);
	return openIntegrateGate({
		projectRoot,
		batchId,
		batchState: completedFixture(batchId, orchBranch),
		config,
	});
}

test("hasExplicitCategoryPostureOptIn requires gates.postures[category] object", () => {
	assert.equal(hasExplicitCategoryPostureOptIn(null, "execute"), false);
	assert.equal(hasExplicitCategoryPostureOptIn({}, "execute"), false);
	assert.equal(hasExplicitCategoryPostureOptIn({ gates: {} }, "execute"), false);
	assert.equal(
		hasExplicitCategoryPostureOptIn({ gates: { postures: { alwaysBreakOn: ["x"] } } }, "execute"),
		false,
	);
	assert.equal(
		hasExplicitCategoryPostureOptIn(
			{ gates: { postures: { execute: { posture: "permissive", autoApproveAfterN: 0 } } } },
			"execute",
		),
		true,
	);
});

test("default integrate stays locked — maybeAutoApprove never auto without posture opt-in", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-locked-");
	const batchId = "20260712T140000";
	const orchBranch = "orch/spine-gate-wire-locked";
	try {
		openPendingGate(projectRoot, batchId, orchBranch, null);

		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config: null });
		assert.equal(result.approved, false);
		assert.equal(result.optedIn, false);
		assert.equal(result.evaluation?.decision, "require-manual");
		assert.match(result.evaluation?.reason ?? "", /locked/i);

		const gate = loadGateRecord(projectRoot, batchId);
		assert.equal(gate.status, "pending");
		assert.equal(gate.decidedBy, undefined);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("DEFAULT_POSTURES alone (no overlay) must not unlock integrate execute", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-defaults-");
	const batchId = "20260712T140001";
	const orchBranch = "orch/spine-gate-wire-defaults";
	try {
		// Config without postures overlay — resolveGatePostureConfig would report guarded execute,
		// but integrate auto path requires explicit opt-in.
		const config = { gates: { requireBeforeIntegrate: true, integrateCategory: "execute" } };
		openPendingGate(projectRoot, batchId, orchBranch, config);

		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(result.approved, false);
		assert.equal(result.optedIn, false);
		assert.equal(loadGateRecord(projectRoot, batchId).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("opted-in immediate auto journals decidedBy auto", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-auto-");
	const batchId = "20260712T140002";
	const orchBranch = "orch/spine-gate-wire-auto";
	try {
		const config = {
			gates: {
				requireBeforeIntegrate: true,
				integrateCategory: "read",
				postures: {
					read: { posture: "permissive", autoApproveAfterN: 0 },
				},
			},
		};
		openPendingGate(projectRoot, batchId, orchBranch, config);

		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(result.ok, true);
		assert.equal(result.approved, true);
		assert.equal(result.decidedBy, "auto");
		assert.equal(result.evaluation?.decision, "allow-auto");

		const gate = loadGateRecord(projectRoot, batchId);
		assert.equal(gate.status, "approved");
		assert.equal(gate.decidedBy, "auto");
		assert.ok(typeof gate.decidedAt === "string");

		const events = readJournalEvents(projectRoot, batchId);
		const approved = events.find((event) => event.type === "gate.approved");
		assert.ok(approved);
		assert.equal(approved.payload?.decidedBy, "auto");
		assert.equal(approved.payload?.postureDecision, "allow-auto");
		assert.equal(getCategoryStreak(projectRoot, "read"), 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("human approve journals decidedBy human and increments streak", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-human-");
	const batchId = "20260712T140003";
	const orchBranch = "orch/spine-gate-wire-human";
	try {
		openPendingGate(projectRoot, batchId, orchBranch, null);

		const approved = approveIntegrateGate({ projectRoot, batchId });
		assert.equal(approved.ok, true);
		assert.equal(approved.decidedBy, "human");
		assert.equal(loadGateRecord(projectRoot, batchId).decidedBy, "human");

		const events = readJournalEvents(projectRoot, batchId);
		const event = events.find((e) => e.type === "gate.approved");
		assert.ok(event);
		assert.equal(event.payload?.decidedBy, "human");
		assert.equal(getCategoryStreak(projectRoot, "execute"), 1);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("streak threshold auto-approve after N consecutive human approvals", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-streak-");
	try {
		const config = {
			gates: {
				integrateCategory: "write",
				postures: {
					write: { posture: "cautious", autoApproveAfterN: 2 },
				},
			},
		};

		// Two prior approvals build streak to 2
		for (let i = 0; i < 2; i++) {
			const batchId = `20260712T14001${i}`;
			const orchBranch = `orch/spine-gate-wire-streak-${i}`;
			openPendingGate(projectRoot, batchId, orchBranch, config);
			const human = approveIntegrateGate({ projectRoot, batchId });
			assert.equal(human.ok, true);
		}
		assert.equal(getCategoryStreak(projectRoot, "write"), 2);

		const batchId = "20260712T140019";
		const orchBranch = "orch/spine-gate-wire-streak-auto";
		openPendingGate(projectRoot, batchId, orchBranch, config);
		const auto = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(auto.approved, true);
		assert.equal(auto.decidedBy, "auto");
		assert.equal(auto.evaluation?.tier, 5);
		assert.equal(loadGateRecord(projectRoot, batchId).decidedBy, "auto");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("destroy category never auto-approves even with overlay attempt", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-destroy-");
	const batchId = "20260712T140004";
	const orchBranch = "orch/spine-gate-wire-destroy";
	try {
		const config = {
			gates: {
				integrateCategory: "destroy",
				postures: {
					destroy: { posture: "permissive", autoApproveAfterN: 0 },
				},
			},
		};
		openPendingGate(projectRoot, batchId, orchBranch, config);

		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(result.approved, false);
		assert.equal(result.optedIn, true);
		assert.equal(result.evaluation?.decision, "require-manual");
		assert.equal(loadGateRecord(projectRoot, batchId).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("auth category never auto-approves even with overlay attempt", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-auth-");
	const batchId = "20260712T140005";
	const orchBranch = "orch/spine-gate-wire-auth";
	try {
		const config = {
			gates: {
				integrateCategory: "auth",
				postures: {
					auth: { posture: "permissive", autoApproveAfterN: 0 },
				},
			},
		};
		openPendingGate(projectRoot, batchId, orchBranch, config);

		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(result.approved, false);
		assert.equal(result.evaluation?.decision, "require-manual");
		assert.equal(loadGateRecord(projectRoot, batchId).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("alwaysBreakOn tag blocks opted-in auto-approve", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-break-");
	const batchId = "20260712T140006";
	const orchBranch = "orch/spine-gate-wire-break";
	try {
		const config = {
			gates: {
				integrateCategory: "read",
				alwaysBreakOn: ["deploy-prod"],
				postures: {
					read: { posture: "permissive", autoApproveAfterN: 0 },
				},
			},
		};
		openPendingGate(projectRoot, batchId, orchBranch, config);

		const result = maybeAutoApproveIntegrateGate({
			projectRoot,
			batchId,
			config,
			tags: ["deploy-prod"],
		});
		assert.equal(result.approved, false);
		assert.equal(result.evaluation?.tier, 3);
		assert.equal(loadGateRecord(projectRoot, batchId).status, "pending");
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("reject resets category streak", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-reset-");
	try {
		const config = { gates: { integrateCategory: "write" } };
		const batchA = "20260712T140007";
		openPendingGate(projectRoot, batchA, "orch/spine-gate-wire-reset-a", config);
		approveIntegrateGate({ projectRoot, batchId: batchA });
		assert.equal(getCategoryStreak(projectRoot, "write"), 1);

		const batchB = "20260712T140008";
		openPendingGate(projectRoot, batchB, "orch/spine-gate-wire-reset-b", config);
		rejectIntegrateGate({ projectRoot, batchId: batchB, reason: "break streak" });
		assert.equal(getCategoryStreak(projectRoot, "write"), 0);
	} finally {
		await destroyGitRepo(projectRoot);
	}
});

test("sequence-safety coexistence: blunt --auto-approve-gate still fail-closed on real pi", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: true });
		assert.equal(check.ok, false);
		assert.equal(check.error, "auto_approve_gate_unsafe");
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("sequence-safety coexistence: release profile still blocks blunt auto-approve on real pi", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		const check = validateSequenceAutoApproveGate({
			autoApproveGate: true,
			profile: { id: "release" },
		});
		assert.equal(check.ok, false);
		assert.equal(check.error, "auto_approve_gate_unsafe");
		assert.match(check.output ?? "", /release/i);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("sequence-safety coexistence: stub mode still allows blunt auto-approve flag", () => {
	const prev = process.env.SPINE_WORKER_STUB;
	process.env.SPINE_WORKER_STUB = "1";
	try {
		const check = validateSequenceAutoApproveGate({ autoApproveGate: true });
		assert.equal(check.ok, true);
		assert.equal(check.stubMode, true);
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
	}
});

test("posture auto path does not require --auto-approve-gate (independent of sequence-safety flag)", async () => {
	const projectRoot = await initGitRepo("spine-gate-wire-indep-");
	const batchId = "20260712T140009";
	const orchBranch = "orch/spine-gate-wire-indep";
	const prev = process.env.SPINE_WORKER_STUB;
	delete process.env.SPINE_WORKER_STUB;
	try {
		// Real-pi: blunt flag would be refused, but posture opt-in still auto-approves.
		const flagCheck = validateSequenceAutoApproveGate({ autoApproveGate: true });
		assert.equal(flagCheck.ok, false);

		const config = {
			gates: {
				integrateCategory: "read",
				postures: {
					read: { posture: "permissive", autoApproveAfterN: 0 },
				},
			},
		};
		openPendingGate(projectRoot, batchId, orchBranch, config);
		const result = maybeAutoApproveIntegrateGate({ projectRoot, batchId, config });
		assert.equal(result.approved, true);
		assert.equal(result.decidedBy, "auto");
	} finally {
		if (prev === undefined) delete process.env.SPINE_WORKER_STUB;
		else process.env.SPINE_WORKER_STUB = prev;
		await destroyGitRepo(projectRoot);
	}
});
