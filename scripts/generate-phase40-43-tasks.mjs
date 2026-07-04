#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const TASKS = [
	{
		id: "SP-318",
		slug: "atomic-write-util",
		name: "Shared atomic write utility",
		size: "S",
		level: 1,
		score: "2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0",
		assessment:
			"Extract shared tmp+rename write helpers from existing settings and rules-manifest code; low blast radius, established pattern.",
		deps: [],
		phase: 40,
		mission: `Create shared atomic file write utilities for pi-spine orchestration artifacts.

Extract writeJsonAtomic and writeTextAtomic into new src/fs/atomic-write.mjs using the pattern from writeSpineConfigAtomic in src/cli/settings-set.mjs.

Refactor existing callers in settings-set.mjs and discover.mjs to use the shared util with no behavior change.

Add unit tests covering write, rename, cleanup on failure, and unique temp suffixes.`,
		context: [
			"src/cli/settings-set.mjs",
			"src/config/cursor-rules/discover.mjs",
			"skills/create-spine-tasks/references/contract-template.md",
		],
		fileScope: [
			"src/fs/atomic-write.mjs",
			"src/cli/settings-set.mjs",
			"src/config/cursor-rules/discover.mjs",
			"tests/fs/atomic-write.test.mjs",
		],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fs/atomic-write.test.mjs",
			fileScopeMustChange: "src/fs/atomic-write.mjs",
			artifactsMustExist: "tests/fs/atomic-write.test.mjs",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Read existing atomic write implementations in settings-set and discover",
					"Confirm no other callers need migration in this task",
				],
			},
			{
				title: "Implement shared atomic write module",
				items: [
					"Create src/fs/atomic-write.mjs with writeJsonAtomic and writeTextAtomic",
					"Refactor settings-set.mjs and discover.mjs to use shared util",
					"Preserve existing fsync/rename semantics",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Add tests/fs/atomic-write.test.mjs",
					"Run FULL test suite: npm run typecheck && SPINE_WORKER_STUB=1 npm test",
					"Run coverage gate: npm run coverage:check — ≥77% line coverage",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: [
			"Shared atomic write module exists",
			"Existing callers refactored without behavior change",
			"Tests pass with coverage gate",
		],
		doNot: ["Change journal append-only semantics", "Add new npm dependencies"],
	},
	{
		id: "SP-319",
		slug: "atomic-batch-state-gate",
		name: "Atomic batch-state and gate writes",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment:
			"Orchestration truth files batch-state.json and gate.json need crash-safe writes; touches core batch persistence.",
		deps: ["SP-318"],
		phase: 40,
		mission: `Harden batch-state and gate record persistence using shared atomic writes from SP-318.

Update saveSpineBatchState in src/batch/state.mjs and saveGateRecord in src/batch/gate.mjs to use writeJsonAtomic.

Keep append-only journal and run-metrics unchanged.

Extend state-transition tests to assert no partial JSON on interrupted writes.`,
		context: [
			"src/batch/state.mjs",
			"src/batch/gate.mjs",
			"src/fs/atomic-write.mjs",
			"tests/batch/state-transition.test.mjs",
		],
		fileScope: ["src/batch/state.mjs", "src/batch/gate.mjs", "tests/batch/state-transition.test.mjs"],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/state-transition.test.mjs",
			fileScopeMustChange: "src/batch/state.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Identify all saveSpineBatchState and saveGateRecord call sites",
					"Confirm SP-318 atomic util is available",
				],
			},
			{
				title: "Apply atomic writes to batch-state and gate",
				items: [
					"Use writeJsonAtomic for batch-state.json writes",
					"Use writeJsonAtomic for gate.json writes",
					"Preserve recordTaskTransition ordering semantics",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Extend state-transition tests for atomic write behavior",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{
				title: "Documentation & Delivery",
				items: [
					"Add atomic writes note to docs/adoption/operator-runbook.md",
					"Create .DONE",
				],
			},
		],
		docs: ["docs/adoption/operator-runbook.md"],
		completion: ["batch-state and gate use atomic writes", "Journal/metrics unchanged", "Tests pass"],
		doNot: ["Change batch-state schema", "Convert journal to overwrite writes"],
	},
	{
		id: "SP-320",
		slug: "atomic-evidence-salvage",
		name: "Atomic evidence and salvage writes",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Evidence bundles and salvage JSON are crash-sensitive during integrate and orphan recovery.",
		deps: ["SP-318"],
		phase: 40,
		mission: `Harden evidence bundle and salvage artifact writes using atomic helpers.

Update src/batch/evidence.mjs and src/batch/salvage.mjs to write each file atomically.

For multi-file evidence bundles, write individual files atomically; optional evidence/.complete marker written last.`,
		context: ["src/batch/evidence.mjs", "src/batch/salvage.mjs", "src/fs/atomic-write.mjs"],
		fileScope: [
			"src/batch/evidence.mjs",
			"src/batch/salvage.mjs",
			"tests/batch/evidence*.test.mjs",
			"tests/batch/salvage*.test.mjs",
		],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/",
			fileScopeMustChange: "src/batch/evidence.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["List all evidence and salvage write paths", "Identify existing tests to extend"],
			},
			{
				title: "Apply atomic writes to evidence and salvage",
				items: [
					"Atomic write for each evidence bundle file",
					"Atomic write for salvage JSON",
					"Add .complete marker if multi-file bundle needs it",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Add or extend tests for evidence/salvage writes",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["Evidence and salvage use atomic writes", "Tests pass"],
		doNot: ["Change evidence bundle schema"],
	},
	{
		id: "SP-321",
		slug: "atomic-worker-output-done",
		name: "Atomic worker-output and .DONE",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment:
			"Worker completion signals (.DONE) and output logs can be torn on crash; aligns with SP-313 diagnosis work.",
		deps: ["SP-318"],
		phase: 40,
		mission: `Harden worker-output logs and .DONE completion marker writes.

Update src/batch/worker-output.mjs, bin/spine-worker-runner.mjs, and src/batch/agent-session-worker.mjs to use atomic writes.

.DONE content: minimal JSON { taskId, completedAt } so engine can reject empty/partial files.`,
		context: [
			"src/batch/worker-output.mjs",
			"bin/spine-worker-runner.mjs",
			"src/batch/agent-session-worker.mjs",
			"spine-tasks/SP-313-worker-exit-without-done/PROMPT.md",
		],
		fileScope: [
			"src/batch/worker-output.mjs",
			"bin/spine-worker-runner.mjs",
			"src/batch/agent-session-worker.mjs",
			"tests/batch/worker-output*.test.mjs",
		],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/",
			fileScopeMustChange: "src/batch/worker-output.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Trace .DONE write and read paths across engine and workers",
					"Review SP-313 worker_done_missing behavior",
				],
			},
			{
				title: "Apply atomic writes to worker-output and .DONE",
				items: [
					"Atomic write for worker-output logs",
					"Atomic write for .DONE with structured JSON content",
					"Update stub and agent-session workers consistently",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Test partial .DONE rejection if applicable",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{
				title: "Documentation & Delivery",
				items: ["Extend operator-runbook atomic writes section", "Create .DONE"],
			},
		],
		docs: ["docs/adoption/operator-runbook.md"],
		completion: [
			"Worker-output and .DONE use atomic writes",
			".DONE has structured content",
			"Tests pass",
		],
		doNot: [
			"Break existing .DONE detection for legacy empty files without migration path",
			"Change worker completion contract semantics",
		],
	},
	{
		id: "SP-322",
		slug: "macro-phase-module",
		name: "deriveMacroPhase module",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment:
			"New pure derivation module mapping diagnosis + batch signals to operator macro-phase enum.",
		deps: [],
		phase: 41,
		mission: `Create deriveMacroPhase — a pure function mapping batch lifecycle signals to a stable macro-phase enum.

New module src/batch/macro-phase.mjs accepts diagnosis, batch.phase, wave index, merge results, gate record, postMergeLimbo, integrate journal events.

Output enum: idle, planning, executing, merging, reviewing, gating, integrating, completed, failed, aborted, paused.`,
		context: [
			"src/batch/reconcile.mjs",
			"src/batch/diagnosis.mjs",
			"src/dashboard/snapshot.mjs",
			"tests/fixtures/batch-state/",
		],
		fileScope: ["src/batch/macro-phase.mjs", "tests/batch/macro-phase.test.mjs"],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/macro-phase.test.mjs",
			fileScopeMustChange: "src/batch/macro-phase.mjs",
			artifactsMustExist: "tests/batch/macro-phase.test.mjs",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Review diagnosis taxonomy and batch.phase values",
					"Identify fixture snapshots covering each macro-phase",
				],
			},
			{
				title: "Implement deriveMacroPhase",
				items: [
					"Create src/batch/macro-phase.mjs with enum and deriveMacroPhase()",
					"Document mapping table in module header",
					"Export macroPhaseLabel helper",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Add tests/batch/macro-phase.test.mjs using batch-state fixtures",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["deriveMacroPhase module exists with tests", "All macro-phase enum values covered by fixtures"],
		doNot: ["Replace diagnosis taxonomy", "Add batch-state schema fields"],
	},
	{
		id: "SP-323",
		slug: "macro-phase-cli",
		name: "Macro-phase in reconcile and CLI",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Wire macro-phase into reconcile output and spine status CLI; extends existing diagnosis flow.",
		deps: ["SP-322"],
		phase: 41,
		mission: `Expose macroPhase and macroPhaseLabel in reconciliation results and CLI output.

Update src/batch/reconcile.mjs to call deriveMacroPhase.

Update bin/spine-status.mjs to print Macro phase line after diagnosis.

Include macroPhase in --diagnose verbose signals.`,
		context: ["src/batch/macro-phase.mjs", "src/batch/reconcile.mjs", "bin/spine-status.mjs"],
		fileScope: [
			"src/batch/reconcile.mjs",
			"bin/spine-status.mjs",
			"tests/batch/reconcile*.test.mjs",
			"tests/cli/status*.test.mjs",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/macro-phase.test.mjs tests/cli/",
			fileScopeMustChange: "src/batch/reconcile.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Confirm SP-322 macro-phase module API", "Review existing status CLI output format"],
			},
			{
				title: "Wire macro-phase into reconcile and CLI",
				items: [
					"Add macroPhase fields to reconcileBatch output",
					"Print macro phase in spine status output",
					"Include in --diagnose signals when verbose",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Extend reconcile/status tests", "Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{
				title: "Documentation & Delivery",
				items: [
					"Add phase vs diagnosis vs macroPhase table to operator-runbook",
					"Create .DONE",
				],
			},
		],
		docs: ["docs/adoption/operator-runbook.md"],
		completion: [
			"spine status shows macro phase",
			"reconcile returns macroPhase fields",
			"Tests pass",
		],
		doNot: ["Replace diagnosis headline logic", "Change diagnosis suggestedCommand behavior"],
	},
	{
		id: "SP-324",
		slug: "macro-phase-dashboard",
		name: "Dashboard macro-phase in batch summary",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment:
			"Dashboard batch summary panel shows macro-phase alongside wave progress; banner still uses diagnosis.",
		deps: ["SP-322"],
		phase: 41,
		mission: `Show macroPhaseLabel in dashboard batch summary panel alongside wave progress.

Update src/dashboard/snapshot.mjs, src/dashboard/view.mjs, and src/dashboard/public/dashboard.js.

Banner continues using diagnosis for styling; macro-phase is informational only.`,
		context: [
			"src/batch/macro-phase.mjs",
			"src/dashboard/snapshot.mjs",
			"src/dashboard/view.mjs",
			"tests/dashboard/ui-contract.test.mjs",
		],
		fileScope: [
			"src/dashboard/snapshot.mjs",
			"src/dashboard/view.mjs",
			"src/dashboard/public/dashboard.js",
			"tests/dashboard/ui-contract.test.mjs",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs",
			fileScopeMustChange: "src/dashboard/snapshot.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Review batch summary panel structure in dashboard.js",
					"Confirm macro-phase module API from SP-322",
				],
			},
			{
				title: "Add macro-phase to dashboard batch summary",
				items: [
					"Wire macroPhaseLabel in snapshot builder",
					"Render in batch summary panel with wave progress",
					"Keep diagnosis banner styling unchanged",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Extend ui-contract tests", "Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{
				title: "Documentation & Delivery",
				items: ["Update docs/PRD.md §16.1 if applicable", "Create .DONE"],
			},
		],
		docs: ["docs/PRD.md", "docs/adoption/operator-runbook.md"],
		completion: [
			"Dashboard shows macro phase in batch summary",
			"Banner still uses diagnosis",
			"Tests pass",
		],
		doNot: ["Switch banner styling to macro-phase", "Remove existing diagnosis badge"],
	},
	{
		id: "SP-325",
		slug: "metrics-lane-duration",
		name: "Task metrics laneNumber and durationMs",
		size: "S",
		level: 1,
		score: "2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0",
		assessment:
			"Extend run-metrics task records with laneNumber and durationMs; backward compatible schemaVersion 1.",
		deps: [],
		phase: 42,
		mission: `Enrich task run-metrics records with laneNumber and durationMs.

Update buildTaskMetricRecord in src/batch/metrics.mjs and call sites in src/batch/engine-lanes/queue.mjs.

Fields are optional and backward compatible (schemaVersion 1).`,
		context: ["src/batch/metrics.mjs", "src/batch/engine-lanes/queue.mjs", "bin/spine.mjs"],
		fileScope: [
			"src/batch/metrics.mjs",
			"src/batch/engine-lanes/queue.mjs",
			"tests/batch/metrics*.test.mjs",
		],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/metrics",
			fileScopeMustChange: "src/batch/metrics.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Review current task metric record shape", "Identify laneNumber source at metric write time"],
			},
			{
				title: "Add laneNumber and durationMs to task metrics",
				items: [
					"Extend buildTaskMetricRecord with optional laneNumber, durationMs",
					"Pass laneNumber from engine-lanes call sites",
					"Compute durationMs from startedAt/endedAt",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Extend metrics tests for new fields", "Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{
				title: "Documentation & Delivery",
				items: ["Note new run-metrics fields in operator-runbook", "Create .DONE"],
			},
		],
		docs: ["docs/adoption/operator-runbook.md"],
		completion: [
			"Task metrics include laneNumber and durationMs when available",
			"Backward compatible",
			"Tests pass",
		],
		doNot: ["Bump schemaVersion without migration note", "Add token/tps fields (out of scope)"],
	},
	{
		id: "SP-326",
		slug: "lane-throughput-module",
		name: "Per-lane stats derivation module",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment:
			"New pure module deriving per-lane throughput from batch-state, journal, and run-metrics — task-based not token-based.",
		deps: ["SP-325"],
		phase: 42,
		mission: `Create per-lane throughput stats derivation module.

New src/dashboard/lane-throughput.mjs derives from batch-state lanes + journal + run-metrics when present.

Per lane: activeElapsedMs, completedCount, failedCount, throughputTasksPerHour.`,
		context: [
			"src/dashboard/snapshot.mjs",
			"src/batch/metrics.mjs",
			"tests/batch/integration-abc.test.mjs",
			"tests/fixtures/batch-state/",
		],
		fileScope: ["src/dashboard/lane-throughput.mjs", "tests/dashboard/lane-throughput.test.mjs"],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/lane-throughput.test.mjs",
			fileScopeMustChange: "src/dashboard/lane-throughput.mjs",
			artifactsMustExist: "tests/dashboard/lane-throughput.test.mjs",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Review journal event types for task lifecycle", "Identify batch-state lane shape"],
			},
			{
				title: "Implement lane-throughput derivation",
				items: [
					"Create src/dashboard/lane-throughput.mjs",
					"Derive per-lane stats from journal + batch-state",
					"Fall back gracefully when metrics missing",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Add tests/dashboard/lane-throughput.test.mjs",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["Lane throughput module exists with tests", "Stats are task-based not token-based"],
		doNot: ["Add LLM token metrics", "Require run-metrics for basic stats"],
	},
	{
		id: "SP-327",
		slug: "dashboard-lane-throughput",
		name: "Dashboard lane throughput columns",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Add Elapsed, Done, and Rate columns to dashboard lane table using lane-throughput module.",
		deps: ["SP-326"],
		phase: 42,
		mission: `Add per-lane throughput columns to dashboard lane table.

Wire lane-throughput.mjs into buildLaneRows in src/dashboard/snapshot.mjs.

New columns: Elapsed, Done, Rate (tasks/hr).`,
		context: [
			"src/dashboard/lane-throughput.mjs",
			"src/dashboard/snapshot.mjs",
			"src/dashboard/view.mjs",
			"src/dashboard/public/dashboard.js",
		],
		fileScope: [
			"src/dashboard/snapshot.mjs",
			"src/dashboard/view.mjs",
			"src/dashboard/public/dashboard.js",
		],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/",
			fileScopeMustChange: "src/dashboard/snapshot.mjs",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Review lane table columns in dashboard.js", "Confirm SP-326 lane-throughput API"],
			},
			{
				title: "Add throughput columns to dashboard",
				items: [
					"Wire lane stats into buildLaneRows",
					"Add Elapsed, Done, Rate columns to lane table UI",
					"Add optional summary row",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Extend dashboard tests", "Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{
				title: "Documentation & Delivery",
				items: ["Document throughput columns in operator-runbook dashboard section", "Create .DONE"],
			},
		],
		docs: ["docs/adoption/operator-runbook.md"],
		completion: ["Dashboard lane table shows throughput columns", "Rates are task-based", "Tests pass"],
		doNot: ["Show token/tps metrics", "Remove existing heartbeat/phase columns"],
	},
	{
		id: "SP-328",
		slug: "dashboard-throughput-tests",
		name: "Dashboard throughput contract tests",
		size: "S",
		level: 1,
		score: "2/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment: "Contract tests and batch-state fixture for multi-lane throughput dashboard display.",
		deps: ["SP-327"],
		phase: 42,
		mission: `Add dashboard contract tests and fixture for lane throughput display.

Extend tests/dashboard/ui-contract.test.mjs.

Add batch-state fixture with multi-lane completed tasks.`,
		context: [
			"tests/dashboard/ui-contract.test.mjs",
			"tests/fixtures/batch-state/",
			"src/dashboard/view.mjs",
		],
		fileScope: [
			"tests/dashboard/ui-contract.test.mjs",
			"tests/fixtures/batch-state/lane-throughput-multi-lane.json",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/dashboard/ui-contract.test.mjs",
			fileScopeMustChange: "tests/dashboard/ui-contract.test.mjs",
			artifactsMustExist: "tests/fixtures/batch-state/lane-throughput-multi-lane.json",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Review SP-327 dashboard column field names",
					"Identify minimal fixture for multi-lane throughput",
				],
			},
			{
				title: "Add throughput contract tests and fixture",
				items: [
					"Create batch-state fixture with multi-lane completed tasks",
					"Extend ui-contract tests for throughput view model",
					"Assert column labels and values",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["Fixture and contract tests exist", "Tests pass"],
		doNot: ["Change production dashboard code unless tests reveal bugs"],
	},
	{
		id: "SP-329",
		slug: "scenario-registry-module",
		name: "Scenario registry schema and module",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment:
			"New fixtures registry module and JSON schema — centralizes scattered incident/stub/adoption fixture metadata.",
		deps: [],
		phase: 43,
		mission: `Create scenario registry schema and core module.

New src/fixtures/scenario-registry.mjs loads tests/fixtures/scenarios/registry.json.

API: listScenarios(), getScenario(id), validateRegistry().`,
		context: [
			"tests/fixtures/incidents/README.md",
			"tests/batch/orphan-reconcile.test.mjs",
			"tests/fixtures/stall-sat020/README.md",
		],
		fileScope: [
			"src/fixtures/scenario-registry.mjs",
			"tests/fixtures/scenarios/registry.json",
			"tests/fixtures/scenario-registry.test.mjs",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fixtures/scenario-registry.test.mjs",
			fileScopeMustChange: "src/fixtures/scenario-registry.mjs",
			artifactsMustExist: "tests/fixtures/scenarios/registry.json",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Review existing incident README catalog",
					"Review duplicated loadFixture helpers in tests",
				],
			},
			{
				title: "Implement scenario registry module",
				items: [
					"Define registry.json schema and initial minimal file",
					"Create scenario-registry.mjs with list/get/validate API",
					"Add unit tests",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["Registry module and schema exist", "validateRegistry passes", "Tests pass"],
		doNot: ["Migrate all fixtures in this task (SP-330)", "Add CLI in this task (SP-332)"],
	},
	{
		id: "SP-330",
		slug: "scenario-registry-populate",
		name: "Populate scenario registry entries",
		size: "S",
		level: 1,
		score: "2/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment:
			"Data-only task: populate registry.json from existing incident, SAT-020, adoption, and ABC fixtures.",
		deps: ["SP-329"],
		phase: 43,
		mission: `Populate registry.json from existing fixtures.

Add entries for incidents README, SAT-020, adoption fixture, and ABC integration recipe.

Update incidents README to point at registry.json as source of truth.`,
		context: [
			"tests/fixtures/incidents/README.md",
			"tests/fixtures/scenarios/registry.json",
			"src/fixtures/scenario-registry.mjs",
		],
		fileScope: [
			"tests/fixtures/scenarios/registry.json",
			"tests/fixtures/incidents/README.md",
			"tests/fixtures/scenario-registry.test.mjs",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/fixtures/scenario-registry.test.mjs",
			fileScopeMustChange: "tests/fixtures/scenarios/registry.json",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Inventory all fixture README tables", "Confirm registry schema from SP-329"],
			},
			{
				title: "Populate registry entries",
				items: [
					"Add incident fixture entries",
					"Add SAT-020, adoption, ABC entries",
					"Update incidents README index",
					"Extend validateRegistry tests for entry count",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Run FULL test suite", "Run coverage gate — ≥77%"],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: ["tests/fixtures/incidents/README.md"],
		completion: ["All cataloged fixtures have registry entries", "validateRegistry passes", "Tests pass"],
		doNot: ["Refactor test files in this task (SP-331)", "Add CLI commands"],
	},
	{
		id: "SP-331",
		slug: "scenario-test-helpers",
		name: "Centralize scenario materialize helpers",
		size: "S",
		level: 1,
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment:
			"Consolidate duplicated loadFixture/materializeIncidentFixture into shared test helper; no behavior change.",
		deps: ["SP-329", "SP-330"],
		phase: 43,
		mission: `Centralize test scenario materialize helpers.

New tests/helpers/scenario-fixture.mjs: loadScenario(id), materializeScenario(projectRoot, id).

Refactor orphan-reconcile, journal-rebuild-incidents, orphan-detect-scope to use helper. No behavior change.`,
		context: [
			"tests/batch/orphan-reconcile.test.mjs",
			"tests/batch/journal-rebuild-incidents.test.mjs",
			"tests/helpers/",
		],
		fileScope: [
			"tests/helpers/scenario-fixture.mjs",
			"tests/batch/orphan-reconcile.test.mjs",
			"tests/batch/journal-rebuild-incidents.test.mjs",
			"tests/batch/orphan-detect-scope.test.mjs",
		],
		contract: {
			testCommand:
				"npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/batch/orphan-reconcile.test.mjs tests/batch/journal-rebuild-incidents.test.mjs tests/batch/orphan-detect-scope.test.mjs",
			fileScopeMustChange: "tests/helpers/scenario-fixture.mjs",
			artifactsMustExist: "tests/helpers/scenario-fixture.mjs",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Identify duplicated loadFixture patterns", "Confirm registry entries from SP-330"],
			},
			{
				title: "Create shared helper and refactor tests",
				items: [
					"Create tests/helpers/scenario-fixture.mjs",
					"Refactor orphan-reconcile, journal-rebuild-incidents, orphan-detect-scope",
					"Verify identical test outcomes",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Run refactored test files",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["Shared helper exists", "Refactored tests pass unchanged", "Tests pass"],
		doNot: ["Change fixture JSON contents", "Add CLI commands"],
	},
	{
		id: "SP-332",
		slug: "scenarios-cli",
		name: "spine scenarios CLI",
		size: "S",
		level: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "New operator CLI for listing, showing, and materializing scenario fixtures for dogfood/dev.",
		deps: ["SP-329"],
		phase: 43,
		mission: `Add spine scenarios CLI commands: list, show, materialize.

Materialize writes batch-state + journal tail into target .spine/ (dev/dogfood only).

Guard with --force if active batch present.`,
		context: ["src/fixtures/scenario-registry.mjs", "bin/spine.mjs", "tests/cli/"],
		fileScope: ["bin/spine.mjs", "bin/spine-cli/scenarios.mjs", "tests/cli/scenarios.test.mjs"],
		contract: {
			testCommand: "npm run typecheck && SPINE_WORKER_STUB=1 npm test -- tests/cli/scenarios.test.mjs",
			fileScopeMustChange: "bin/spine-cli/scenarios.mjs",
			artifactsMustExist: "tests/cli/scenarios.test.mjs",
		},
		steps: [
			{
				title: "Preflight",
				items: [
					"Review existing CLI subcommand patterns in bin/spine-cli/",
					"Confirm registry API from SP-329",
				],
			},
			{
				title: "Implement spine scenarios CLI",
				items: [
					"Add scenarios.mjs subcommand module",
					"Implement list, show, materialize",
					"Wire into bin/spine.mjs",
					"Add active-batch guard for materialize",
				],
			},
			{
				title: "Testing & Verification",
				items: [
					"Add tests/cli/scenarios.test.mjs",
					"Run FULL test suite",
					"Run coverage gate — ≥77%",
				],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: [],
		completion: ["spine scenarios list/show/materialize work", "Tests pass"],
		doNot: ["Materialize over active batch without --force", "Auto-start batches from materialize"],
	},
	{
		id: "SP-333",
		slug: "scenario-registry-docs",
		name: "Adoption smoke recipe and registry docs",
		size: "S",
		level: 0,
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment:
			"Docs-only task: register adoption-smoke scenario and document registry in operator runbook and bootstrap checklist.",
		deps: ["SP-332"],
		phase: 43,
		mission: `Register adoption-smoke scenario and document scenario registry for operators.

Update docs/adoption/operator-runbook.md and docs/adoption/bootstrap-checklist.md.`,
		context: [
			"docs/adoption/operator-runbook.md",
			"docs/adoption/bootstrap-checklist.md",
			"tests/fixtures/scenarios/registry.json",
		],
		fileScope: [
			"tests/fixtures/scenarios/registry.json",
			"docs/adoption/operator-runbook.md",
			"docs/adoption/bootstrap-checklist.md",
		],
		contract: {
			testCommand: "true",
			fileScopeMustChange: "docs/adoption/operator-runbook.md",
			artifactsMustExist: "",
		},
		steps: [
			{
				title: "Preflight",
				items: ["Review SP-332 CLI output format", "Review adoption-smoke.sh script"],
			},
			{
				title: "Register adoption-smoke and write docs",
				items: [
					"Add adoption-smoke registry entry",
					"Write operator-runbook scenario registry section",
					"Update bootstrap-checklist",
				],
			},
			{
				title: "Testing & Verification",
				items: ["Run FULL test suite: npm run typecheck && SPINE_WORKER_STUB=1 npm test"],
			},
			{ title: "Documentation & Delivery", items: ["Create .DONE"] },
		],
		docs: ["docs/adoption/operator-runbook.md", "docs/adoption/bootstrap-checklist.md"],
		completion: ["adoption-smoke scenario registered", "Operator docs updated", "Tests pass"],
		doNot: ["Change CLI implementation", "Add new markdown files beyond listed docs"],
	},
];

const REVIEW_LABELS = { 0: "None", 1: "Plan Only", 2: "Plan + Code", 3: "Full" };
const created = new Date().toISOString().slice(0, 10);

function depSection(deps) {
	if (!deps.length) return "-1. **None**";
	return deps.map((d, i) => `${i + 1}. **Task:** ${d}`).join("\n");
}

function promptMd(t) {
	const levelLabel = REVIEW_LABELS[t.level];
	const docsMust = t.docs.length
		? `**Must Update:**\n\n${t.docs.map((d) => `- \`${d}\``).join("\n")}\n`
		: "**Must Update:**\n\n- None\n";
	const artifacts = t.contract.artifactsMustExist || "—";
	const steps = t.steps
		.map((s, i) => {
			const items = s.items.map((it) => `- [ ] ${it}`).join("\n");
			return `### Step ${i}: ${s.title}\n\n${items}`;
		})
		.join("\n\n");
	const doNot = t.doNot.map((d) => `- ${d}`).join("\n");
	const completion = t.completion.map((c) => `- [ ] ${c}`).join("\n");
	const context = t.context.map((c) => `- \`${c}\``).join("\n");
	const fileScope = t.fileScope.map((f) => `- \`${f}\``).join("\n");

	return `# Task: ${t.id} — ${t.name}

**Created:** ${created}
**Size:** ${t.size}

## Review Level: ${t.level} (${levelLabel})

**Assessment:** ${t.assessment}
**Score:** ${t.score}

## Mission

${t.mission}

## Dependencies

${depSection(t.deps)}

## Context to Read First

${context}

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None (unit tests)

## File Scope

${fileScope}

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`${t.contract.testCommand}\` |
| fileScopeMustChange | \`${t.contract.fileScopeMustChange}\` |
| minLineCoverage | 77 |
| artifactsMustExist | \`${artifacts}\` |

## Steps

${steps}

## Documentation Requirements

${docsMust}
**Check If Affected:**

- \`docs/EXECUTION-FLOW.md\`

## Completion Criteria

${completion}

## Git Commit Convention

- \`feat(${t.id}): complete Step N — description\`
- \`fix(${t.id}): description\`
- \`test(${t.id}): description\`

## Do NOT

${doNot}

---

## Amendments (Added During Execution)
`;
}

function statusMd(t) {
	const steps = t.steps
		.map((s, i) => {
			const items = s.items.map((it) => `- [ ] ${it}`).join("\n");
			return `### Step ${i}: ${s.title}\n**Status:** ⬜ Not Started\n\n${items}`;
		})
		.join("\n\n---\n\n");
	return `# ${t.id}: ${t.name} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** ${created}
**Review Level:** ${t.level}
**Review Counter:** 0
**Iteration:** 0
**Size:** ${t.size}

---

${steps}

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| ${created} | Task staged | PROMPT.md and STATUS.md created (Phase ${t.phase}) |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
`;
}

const root = process.cwd();
for (const t of TASKS) {
	const dir = path.join(root, "spine-tasks", `${t.id}-${t.slug}`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "PROMPT.md"), promptMd(t));
	fs.writeFileSync(path.join(dir, "STATUS.md"), statusMd(t));
	console.log("Created", `${t.id}-${t.slug}`);
}

console.log("Done:", TASKS.length, "tasks");
