#!/usr/bin/env node
/**
 * Generator for Phase 20b (SP-141–SP-170) S-sized split tasks.
 * Run: node scripts/generate-phase20b-tasks.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASKS_ROOT = path.join(ROOT, "spine-tasks");
const DATE = "2026-06-11";
const TEST_CMD = "npm run typecheck && SPINE_WORKER_STUB=1 npm test";
const COV_CMD = "npm run coverage:check";

/** @type {Array<{ id: string, slug: string, title: string, size: string, level: number, levelLabel: string, score: string, assessment: string, mission: string, replaces: string, deps: string[], context: string[], fileScope: string[], implSteps: string[], docsMust: string[], docsCheck: string[], doNot: string[], codeTask?: boolean }>} */
const TASKS = [
	{
		id: "SP-141",
		slug: "config-defaults-v2",
		title: "Config defaults v2",
		replaces: "SP-123a",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Template and init defaults for review, handoff, metrics sections only.",
		mission:
			"Add review, handoff, and metrics blocks to spine-config.json template and spine init scaffold with merge defaults on load.",
		deps: ["SP-122"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §11.1", "templates/spine-config.json"],
		fileScope: ["templates/spine-config.json", "bin/spine-init.mjs", "src/config/*.mjs"],
		implSteps: [
			"Add review, handoff, metrics sections per handoff §6.2 (no contract yet)",
			"Merge defaults on config load for repos missing new keys",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Add contract.mode yet (SP-142)", "Implement CLI behavior"],
	},
	{
		id: "SP-142",
		slug: "contract-config-validate",
		title: "Contract config validation",
		replaces: "SP-123b",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "contract.mode enum validation and legacyTaskIdPrefixes defaults.",
		mission:
			"Add contract section to config schema: mode enum (required|optional|legacy) and legacyTaskIdPrefixes default [TP-].",
		deps: ["SP-141"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §3", "src/config/*.mjs"],
		fileScope: ["src/config/*.mjs", "tests/config/contract-mode.test.mjs"],
		implSteps: [
			"Add contract block to template and config validation",
			"Unit tests: defaults, invalid mode rejected, legacy prefix array",
		],
		docsMust: ["docs/adoption/operator-runbook.md — contract config table"],
		docsCheck: [],
		doNot: ["Implement parseContract (SP-143)"],
	},
	{
		id: "SP-143",
		slug: "contract-parse",
		title: "Contract parser",
		replaces: "SP-124a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Pure parseContract module with unit tests.",
		mission: "Implement parseContract(markdown) extracting the ## Contract table per handoff §4.3.",
		deps: ["SP-142"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §4", "src/tasks/packet/parse-prompt.mjs"],
		fileScope: [
			"src/tasks/packet/parse-prompt.mjs",
			"src/tasks/packet/validate-contract.mjs",
			"tests/tasks/contract-parse.test.mjs",
		],
		implSteps: [
			"Implement parseContract → ParsedContract with all five fields",
			"Unit tests for valid table, empty table, unknown fields as warnings",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Wire into validatePrompt yet (SP-144)"],
	},
	{
		id: "SP-144",
		slug: "contract-validate-wire",
		title: "Contract validate wire-up",
		replaces: "SP-124b",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "validateContract + validatePrompt integration and fixtures.",
		mission:
			"Implement validateContract with contract.mode and TP-* legacy exemption; integrate into validatePrompt.",
		deps: ["SP-143"],
		context: ["src/tasks/packet/validate-prompt.mjs", "src/tasks/packet/index.mjs"],
		fileScope: [
			"src/tasks/packet/validate-contract.mjs",
			"src/tasks/packet/validate-prompt.mjs",
			"src/tasks/packet/index.mjs",
			"test/fixtures/taskplane/FX-missing-contract/**",
			"test/fixtures/taskplane/FX-valid-contract/**",
		],
		implSteps: [
			"validateContract with mode and legacyTaskIdPrefixes rules",
			"Extend validatePrompt; add FX-missing-contract and FX-valid-contract fixtures",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Duplicate validation logic outside validate-contract.mjs"],
	},
	{
		id: "SP-145",
		slug: "tasks-validate-core",
		title: "tasks validate CLI core",
		replaces: "SP-125a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Core spine tasks validate with scope resolution and human output.",
		mission:
			"Create bin/spine-tasks.mjs: scope resolution (same as spine plan), human output, exit codes 0/1/2.",
		deps: ["SP-144"],
		context: ["src/planner/index.mjs", "src/tasks/packet/validate-prompt.mjs"],
		fileScope: ["bin/spine-tasks.mjs", "bin/spine.mjs", "tests/tasks/validate-cli.test.mjs"],
		implSteps: [
			"Implement spine tasks validate with planner scope resolution",
			"Human output: Validated N task(s): X passed, Y failed; wire spine.mjs router",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Mutate batch state", "Duplicate validatePrompt schema"],
	},
	{
		id: "SP-146",
		slug: "tasks-validate-json",
		title: "tasks validate JSON output",
		replaces: "SP-125b",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "--json, --warnings-only, and spine help tasks.",
		mission:
			"Add --json TasksValidateResult output, --warnings-only mode, and spine help tasks documentation.",
		deps: ["SP-145"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §6.4"],
		fileScope: ["bin/spine-tasks.mjs", "bin/spine.mjs", "tests/tasks/validate-cli.test.mjs"],
		implSteps: [
			"--json output per TasksValidateResult schema",
			"--warnings-only for folder name, missing STATUS, deps mismatch; spine help tasks",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: [],
	},
	{
		id: "SP-147",
		slug: "handoff-data",
		title: "Handoff data assembly",
		replaces: "SP-127a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Data layer for handoff from reconcile and journal.",
		mission:
			"Create src/cli/handoff.mjs data assembly: reconcileBatch, batch-state, journal tail into structured object.",
		deps: ["SP-142"],
		context: ["src/batch/reconcile.mjs", "src/batch/journal.mjs"],
		fileScope: ["src/cli/handoff.mjs", "tests/cli/spine-handoff.test.mjs"],
		implSteps: [
			"assembleHandoffData(projectRoot, batchId?) returning normative fields",
			"Idle state when no active batch; unit tests for data shape",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Include secrets in output (NFR-UXB-02)"],
	},
	{
		id: "SP-148",
		slug: "handoff-render",
		title: "Handoff render and CLI",
		replaces: "SP-127b",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 0",
		assessment: "Markdown renderer, --json, redaction, golden snapshot test.",
		mission:
			"Render handoff.md per §7.4 section order; spine handoff CLI with --json; secret redaction; golden test.",
		deps: ["SP-147"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §7.4"],
		fileScope: [
			"src/cli/handoff.mjs",
			"bin/spine.mjs",
			"tests/cli/spine-handoff.test.mjs",
			"tests/fixtures/handoff-golden.md",
		],
		implSteps: [
			"Markdown renderer with normative section order; write .spine/handoff.md",
			"--json output; redact *_KEY, *_TOKEN, *SECRET*; golden snapshot test",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Include worker log bodies"],
	},
	{
		id: "SP-149",
		slug: "final-verdict-parse",
		title: "Final verdict parsing",
		replaces: "SP-129a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "parseReviewVerdict extension for PASS/REVISE/REPLAN.",
		mission:
			"Extend parseReviewVerdict to accept PASS, REVISE, REPLAN when reviewType is final. Step enums unchanged.",
		deps: ["SP-142"],
		context: ["src/batch/review.mjs", "tests/batch/review.test.mjs"],
		fileScope: ["src/batch/review.mjs", "tests/batch/review.test.mjs"],
		implSteps: [
			"parseReviewVerdict(content, { reviewType: 'final' }) accepts PASS/REVISE/REPLAN",
			"Regression: step APPROVE/REVISE tests unchanged",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Break step APPROVE/REVISE (M-UXB-07)"],
	},
	{
		id: "SP-150",
		slug: "final-review-spawn",
		title: "Final review spawn path",
		replaces: "SP-129b",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "--type final CLI and artifact paths.",
		mission:
			"Add spine review step --type final spawn path and .reviews/final-{timestamp}.md artifact naming.",
		deps: ["SP-149"],
		context: ["bin/spine-review-step.mjs", "src/batch/review.mjs"],
		fileScope: ["src/batch/review.mjs", "bin/spine-review-step.mjs", "tests/batch/review.test.mjs"],
		implSteps: [
			"buildFinalReviewArtifactPath helper",
			"CLI --type final documented and tested; spawn failure exits non-zero at level ≥1",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Integrate engine loop yet (SP-151)"],
	},
	{
		id: "SP-151",
		slug: "engine-final-phase",
		title: "Engine final review phase",
		replaces: "SP-130a",
		size: "S",
		level: 3,
		levelLabel: "Full",
		score: "5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "Engine enters final-review phase after steps complete.",
		mission:
			"Integrate final-review phase gate in engine-lanes.mjs when requireFinalVerdict && reviewLevel ≥ 1.",
		deps: ["SP-150"],
		context: ["src/batch/engine-lanes.mjs"],
		fileScope: ["src/batch/engine-lanes.mjs", "tests/batch/final-verdict.test.mjs"],
		implSteps: [
			"Enter final review phase after all steps complete (before .DONE)",
			"Skip final when reviewLevel 0; journal task.verdict_recorded on verdict",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Implement REVISE cap or REPLAN yet"],
	},
	{
		id: "SP-152",
		slug: "engine-revise-cap",
		title: "Engine REVISE cap",
		replaces: "SP-130b",
		size: "S",
		level: 3,
		levelLabel: "Full",
		score: "5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "REVISE retry loop and review.exhausted cap.",
		mission:
			"Implement REVISE on final: increment finalAttempt, re-invoke; cap at maxFinalAttempts → review_exhausted.",
		deps: ["SP-151"],
		context: ["src/batch/engine-lanes.mjs"],
		fileScope: ["src/batch/engine-lanes.mjs", "tests/batch/final-verdict.test.mjs"],
		implSteps: [
			"REVISE loop with finalAttempt counter",
			"On cap: task failed, exitReason review_exhausted, journal review.exhausted",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Implement REPLAN path yet (SP-153)"],
	},
	{
		id: "SP-153",
		slug: "engine-replan-block",
		title: "Engine REPLAN and merge block",
		replaces: "SP-130c",
		size: "S",
		level: 3,
		levelLabel: "Full",
		score: "5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "REPLAN fail path and wave merge block.",
		mission:
			"REPLAN on final: status failed, exitReason needs_replan, no .DONE; block wave merge while needs_replan present.",
		deps: ["SP-152"],
		context: ["src/batch/engine-lanes.mjs", "test/fixtures/taskplane/FX-final-replan/**"],
		fileScope: [
			"src/batch/engine-lanes.mjs",
			"tests/batch/final-verdict.test.mjs",
			"test/fixtures/taskplane/FX-final-replan/**",
		],
		implSteps: [
			"REPLAN path: failed, exitReason needs_replan, journal task.verdict_recorded, no .DONE",
			"Block wave merge when any task has exitReason needs_replan; FX-final-replan fixture",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Run in parallel with SP-151/152 batches"],
	},
	{
		id: "SP-154",
		slug: "contract-verify-core",
		title: "Contract verify core",
		replaces: "SP-131a",
		size: "S",
		level: 3,
		levelLabel: "Full",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "testCommand and artifactsMustExist machine checks.",
		mission:
			"Create src/batch/contract-verify.mjs with testCommand (exit 0) and artifactsMustExist checks.",
		deps: ["SP-144", "SP-150"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §4.5"],
		fileScope: ["src/batch/contract-verify.mjs", "tests/batch/contract-verify.test.mjs"],
		implSteps: [
			"verifyContract runs testCommand in worktree; checks artifactsMustExist",
			"Return ContractVerifyResult with per-check ok/message",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Hook into engine yet (SP-155)"],
	},
	{
		id: "SP-155",
		slug: "contract-verify-hook",
		title: "Contract verify engine hook",
		replaces: "SP-131b",
		size: "S",
		level: 3,
		levelLabel: "Full",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "file scope, coverage checks, engine-lanes integration.",
		mission:
			"Add fileScopeMustChange/NotChange and minLineCoverage checks; hook verifier into final review path in engine-lanes.",
		deps: ["SP-154", "SP-151"],
		context: ["src/batch/engine-lanes.mjs", "src/batch/review.mjs"],
		fileScope: [
			"src/batch/contract-verify.mjs",
			"src/batch/engine-lanes.mjs",
			"src/batch/review.mjs",
			"tests/batch/contract-verify.test.mjs",
		],
		implSteps: [
			"fileScope and minLineCoverage checks; reuse coverage parser",
			"Hook into final review before reviewer spawn; skip for legacy TP-*",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Run verifier on step reviews"],
	},
	{
		id: "SP-156",
		slug: "needs-replan-taxonomy",
		title: "needs_replan taxonomy",
		replaces: "SP-132a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Add needs_replan to diagnosis taxonomy.",
		mission: "Add needs_replan to DIAGNOSIS_TAXONOMY in diagnosis.mjs with headline and suggestedCommand.",
		deps: ["SP-153"],
		context: ["src/batch/diagnosis.mjs", "docs/PRD-v2.0-implementation-handoff.md §9"],
		fileScope: ["src/batch/diagnosis.mjs", "tests/compat/final-verdict-reconcile.test.mjs"],
		implSteps: [
			"Add needs_replan entry with headline and suggestedCommand per §9.1",
			"Unit test for diagnosis messaging shape",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Change reconcile precedence yet (SP-157)"],
	},
	{
		id: "SP-157",
		slug: "needs-replan-reconcile",
		title: "needs_replan reconcile",
		replaces: "SP-132b",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Reconcile precedence and compat integration test.",
		mission:
			"Implement reconcile precedence: needs_replan over needs_retry; blocks needs_merge and needs_integrate.",
		deps: ["SP-156"],
		context: ["src/batch/reconcile.mjs"],
		fileScope: ["src/batch/reconcile.mjs", "tests/compat/final-verdict-reconcile.test.mjs"],
		implSteps: [
			"Detect exitReason needs_replan in reconcile",
			"Precedence rules §9.2; integration test REPLAN → needs_replan diagnosis",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Change plain needs_retry for non-replan failures"],
	},
	{
		id: "SP-158",
		slug: "metrics-task-writer",
		title: "Task metrics writer",
		replaces: "SP-134a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "appendTaskMetric JSONL writer.",
		mission:
			"Create src/batch/metrics.mjs with appendTaskMetric; hook on task terminal outcomes in engine-lanes.",
		deps: ["SP-153"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §6.5"],
		fileScope: ["src/batch/metrics.mjs", "src/batch/engine-lanes.mjs", "tests/batch/run-metrics.test.mjs"],
		implSteps: [
			"appendTaskMetric per TaskMetricRecord schema",
			"Hook on completed/failed/skipped; respect metrics.enabled; no secrets",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Log prompt text"],
	},
	{
		id: "SP-159",
		slug: "metrics-batch-writer",
		title: "Batch metrics writer",
		replaces: "SP-134b",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "appendBatchMetric and lifecycle hook.",
		mission: "Add appendBatchMetric on batch terminal in lifecycle.mjs.",
		deps: ["SP-158"],
		context: ["src/batch/lifecycle.mjs"],
		fileScope: ["src/batch/metrics.mjs", "src/batch/lifecycle.mjs", "tests/batch/run-metrics.test.mjs"],
		implSteps: [
			"appendBatchMetric per BatchMetricRecord schema",
			"Hook on batch completed/dismissed/aborted/failed",
		],
		docsMust: [],
		docsCheck: [],
		doNot: [],
	},
	{
		id: "SP-160",
		slug: "skill-explore-step0",
		title: "Skill explore Step 0",
		replaces: "SP-137a",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "create-spine-tasks Step 0 explore guidance.",
		mission:
			"Update create-spine-tasks SKILL.md with Step 0 Explore when-to-skip guidance; verify explore-template.md.",
		deps: ["SP-144"],
		context: ["skills/create-spine-tasks/SKILL.md"],
		fileScope: [
			"skills/create-spine-tasks/SKILL.md",
			"skills/create-spine-tasks/references/explore-template.md",
		],
		implSteps: [
			"Document Step 0 Explore with when-to-skip and findings.md path",
			"Verify explore-template.md matches v1.3 §6.3 schema",
		],
		docsMust: ["skills/create-spine-tasks/SKILL.md"],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-161",
		slug: "skill-contract-template",
		title: "Skill Contract template",
		replaces: "SP-137b",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Contract authoring in prompt-template and new contract-template.md.",
		mission:
			"Add ## Contract section to prompt-template.md; create contract-template.md; update launch sequence with spine tasks validate.",
		deps: ["SP-144"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §4"],
		fileScope: [
			"skills/create-spine-tasks/SKILL.md",
			"skills/create-spine-tasks/references/prompt-template.md",
			"skills/create-spine-tasks/references/contract-template.md",
		],
		implSteps: [
			"Add Contract section to prompt-template with field guidance",
			"Create contract-template.md with examples; update skill launch commands",
		],
		docsMust: [
			"skills/create-spine-tasks/references/contract-template.md",
			"skills/create-spine-tasks/references/prompt-template.md",
		],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-162",
		slug: "runbook-validate-handoff",
		title: "Runbook validate and handoff",
		replaces: "SP-138a",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Operator runbook sections for validate and handoff.",
		mission: "Add operator runbook sections: spine tasks validate and spine handoff workflow.",
		deps: ["SP-146", "SP-148"],
		context: ["docs/adoption/operator-runbook.md"],
		fileScope: ["docs/adoption/operator-runbook.md"],
		implSteps: [
			"spine tasks validate section: when, scope, fixing errors",
			"spine handoff section: session continuity workflow",
		],
		docsMust: ["docs/adoption/operator-runbook.md"],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-163",
		slug: "runbook-replan-metrics",
		title: "Runbook replan and metrics",
		replaces: "SP-138b",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Operator runbook sections for needs_replan, contract mode, metrics.",
		mission:
			"Add runbook sections: needs_replan diagnosis, Contract mode config, spine metrics show usage.",
		deps: ["SP-157", "SP-169"],
		context: ["docs/adoption/operator-runbook.md"],
		fileScope: ["docs/adoption/operator-runbook.md"],
		implSteps: [
			"needs_replan: edit PROMPT, retry flow",
			"Contract mode and legacy TP-* guidance; spine metrics show usage",
		],
		docsMust: ["docs/adoption/operator-runbook.md"],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-164",
		slug: "fixtures-phase20",
		title: "Phase 20 fixtures",
		replaces: "SP-139a",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "FX fixtures for validate, contract, and REPLAN paths.",
		mission:
			"Create test fixtures: FX-invalid-no-testing, FX-missing-contract, FX-valid-contract, FX-final-replan.",
		deps: ["SP-146", "SP-153"],
		context: ["test/fixtures/taskplane/"],
		fileScope: ["test/fixtures/taskplane/FX-*"],
		implSteps: [
			"Create or consolidate FX fixtures for validate and contract paths",
			"FX-final-replan fixture for REPLAN integration path",
		],
		docsMust: [],
		docsCheck: [],
		doNot: [],
	},
	{
		id: "SP-165",
		slug: "adoption-smoke-phase20",
		title: "Adoption smoke Phase 20",
		replaces: "SP-139b",
		size: "S",
		level: 2,
		levelLabel: "Plan + Code",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Extend adoption-smoke.sh and integration tests.",
		mission:
			"Extend scripts/adoption-smoke.sh with spine tasks validate before batch; integration test REPLAN → needs_replan.",
		deps: ["SP-166", "SP-157", "SP-169"],
		context: ["scripts/adoption-smoke.sh", "tests/adoption/"],
		fileScope: ["scripts/adoption-smoke.sh", "tests/adoption/**"],
		implSteps: [
			"adoption-smoke: spine tasks validate before batch start",
			"Integration test: REPLAN → needs_replan diagnosis",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/bootstrap-checklist.md"],
		doNot: [],
	},
	{
		id: "SP-166",
		slug: "preflight-tasks-validate",
		title: "Preflight tasks-validate slash",
		replaces: "SP-126",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Preflight tasks-validate check and /spine-validate slash.",
		mission:
			"Add preflight check id tasks-validate; register /spine-validate slash delegating to spine tasks validate.",
		deps: ["SP-146"],
		context: ["bin/spine-preflight.mjs", "extensions/spine/slash-commands.ts"],
		fileScope: [
			"bin/spine-preflight.mjs",
			"extensions/spine/slash-commands.ts",
			"tests/spine-preflight.test.mjs",
		],
		implSteps: [
			"tasks-validate check with suggestedCommand spine tasks validate pending",
			"/spine-validate slash; preflight test for distinct check name",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Bury validate errors inside plan check"],
	},
	{
		id: "SP-167",
		slug: "handoff-slash-journal",
		title: "Handoff slash and journal",
		replaces: "SP-128",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "/spine-handoff, journal event, spine next hint.",
		mission:
			"Wire /spine-handoff slash, handoff.written journal event, spine next handoff path hint.",
		deps: ["SP-148"],
		context: ["extensions/spine/slash-commands.ts", "src/batch/journal.mjs"],
		fileScope: [
			"extensions/spine/slash-commands.ts",
			"src/batch/journal.mjs",
			"bin/spine-cli/batch.mjs",
			"tests/cli/spine-handoff.test.mjs",
		],
		implSteps: [
			"/spine-handoff delegates to CLI; handoff.written journal event",
			"spine next appends Handoff hint when file exists",
		],
		docsMust: [],
		docsCheck: [],
		doNot: [],
	},
	{
		id: "SP-168",
		slug: "agent-templates-final",
		title: "Agent templates final verdict",
		replaces: "SP-133",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Worker and reviewer template updates for final + contract.",
		mission:
			"Update templates/agents/worker.md and reviewer.md for final verdict and contract verification per §8.",
		deps: ["SP-150", "SP-155"],
		context: ["templates/agents/worker.md", "templates/agents/reviewer.md"],
		fileScope: [
			"templates/agents/worker.md",
			"templates/agents/reviewer.md",
			"tests/agent-template-drift.test.mjs",
		],
		implSteps: [
			"Worker: final review sequence before .DONE",
			"Reviewer: PASS/REVISE/REPLAN section; extend drift test",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Change step review enums"],
	},
	{
		id: "SP-169",
		slug: "metrics-show-cli",
		title: "metrics show CLI",
		replaces: "SP-135",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "spine metrics show and doctor advisory.",
		mission: "Implement spine metrics show [--batch ID] [--json] [--last N] and doctor metrics advisory.",
		deps: ["SP-159"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §6.5"],
		fileScope: ["bin/spine.mjs", "bin/spine-doctor.mjs", "tests/batch/run-metrics.test.mjs"],
		implSteps: [
			"spine metrics show with batch filter and human table output",
			"Doctor advisory when metrics file exists",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: [],
	},
	{
		id: "SP-170",
		slug: "context-phase20b",
		title: "CONTEXT Phase 20b tracking",
		replaces: "SP-140",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment: "Meta: CONTEXT.md Phase 20b table and Next Task ID SP-171.",
		mission:
			"Finalize spine-tasks/CONTEXT.md Phase 20b section, verify dependencies.json graph, set Next Task ID SP-171.",
		deps: ["SP-165", "SP-163", "SP-162", "SP-168", "SP-167", "SP-166", "SP-161", "SP-160"],
		context: ["spine-tasks/CONTEXT.md", "spine-tasks/dependencies.json"],
		fileScope: ["spine-tasks/CONTEXT.md", "spine-tasks/dependencies.json"],
		implSteps: [
			"Add Phase 20b wave table with all SP-141–169 rows and exit criteria",
			"Set Next Task ID SP-171; verify spine plan pending respects graph",
		],
		docsMust: ["spine-tasks/CONTEXT.md"],
		docsCheck: [],
		doNot: ["Implement feature code"],
		codeTask: false,
	},
];

function depSection(deps) {
	if (!deps.length) return "- **None**";
	return deps.map((d) => `- **Task:** ${d}`).join("\n");
}

function contextSection(items) {
	if (!items.length) return "";
	return `## Context to Read First

**Tier 3:**
${items.map((i) => `- \`${i}\``).join("\n")}

`;
}

function buildPrompt(task, folderPath) {
	const codeTask = task.codeTask !== false;
	const stepCount = task.implSteps.length;
	const steps = task.implSteps
		.map((s, i) => {
			const checkpoint =
				task.level >= 2 && i === 0
					? "\n> **Plan-review checkpoint**\n"
					: task.level >= 2 && i === stepCount - 1
						? "\n> **Code review checkpoint**\n"
						: "";
			return `### Step ${i + 1}: ${s.split(";")[0].slice(0, 55)}

${checkpoint}- [ ] ${s}`;
		})
		.join("\n\n");

	const testingStep = `### Step ${stepCount + 1}: Testing & Verification

- [ ] Run FULL test suite: \`${TEST_CMD}\`${
		codeTask
			? `
- [ ] Run coverage gate: \`${COV_CMD}\` — ≥77% line coverage on in-scope changed code`
			: ""
	}
- [ ] Fix all failures`;

	const docStep = `### Step ${stepCount + 2}: Documentation & Delivery

${task.docsMust.map((d) => `- [ ] Update: ${d}`).join("\n") || "- [ ] Review docs per Documentation Requirements"}
- [ ] Create \`.DONE\` when complete`;

	return `# Task: ${task.id} — ${task.title}

**Created:** ${DATE}
**Size:** ${task.size}

## Review Level: ${task.level} (${task.levelLabel})

**Assessment:** ${task.assessment}
**Score:** ${task.score}

**Replaces:** ${task.replaces}

## Mission

${task.mission}

**Source:** [docs/PRD-v2.0-implementation-handoff.md §11.1](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

${depSection(task.deps)}

${contextSection(task.context)}## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

${task.fileScope.map((p) => `- \`${p}\``).join("\n")}

## Steps

### Step 0: Preflight

- [ ] Read handoff §11.1 entry for ${task.id}
- [ ] Dependencies satisfied (${task.deps.join(", ") || "none"})

${steps}

${testingStep}

${docStep}

## Documentation Requirements

**Must Update:**
${task.docsMust.length ? task.docsMust.map((d) => `- \`${d}\``).join("\n") : "- None"}

**Check If Affected:**
${task.docsCheck.length ? task.docsCheck.map((d) => `- \`${d}\``).join("\n") : "- None"}

## Completion Criteria

- [ ] All steps complete
- [ ] Full test suite green
- [ ] Acceptance criteria in handoff §11.1 satisfied for ${task.id}

## Git Commit Convention

- \`feat(${task.id}): complete Step N — description\`

## Do NOT

${task.doNot.map((d) => `- ${d}`).join("\n") || "- Expand scope beyond handoff §11.1"}

---

## Amendments (Added During Execution)
`;
}

function buildStatus(task) {
	return `# ${task.id}: ${task.title} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** ${DATE}
**Review Level:** ${task.level}
**Size:** ${task.size}

---

### Step 0: Preflight
**Status:** ⬜ Not Started

---

## Blockers

*None*

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| ${DATE} | Task staged | PROMPT.md and STATUS.md created |
`;
}

const depEdges = {};
for (const task of TASKS) {
	depEdges[task.id] = [...task.deps];
}

for (const task of TASKS) {
	const folder = `${task.id}-${task.slug}`;
	const folderPath = path.join(TASKS_ROOT, folder);
	fs.mkdirSync(folderPath, { recursive: true });
	fs.writeFileSync(
		path.join(folderPath, "PROMPT.md"),
		buildPrompt(task, `spine-tasks/${folder}`),
	);
	fs.writeFileSync(path.join(folderPath, "STATUS.md"), buildStatus(task));
	console.log(`Created ${folder}`);
}

const depsPath = path.join(TASKS_ROOT, "dependencies.json");
const depsJson = JSON.parse(fs.readFileSync(depsPath, "utf-8"));

for (const id of Object.keys(depsJson.tasks)) {
	if (/^SP-12[3-9]$/.test(id) || /^SP-13[0-9]$/.test(id) || id === "SP-140") {
		delete depsJson.tasks[id];
	}
}
for (const [id, deps] of Object.entries(depEdges)) {
	depsJson.tasks[id] = deps;
}
depsJson.generatedAt = new Date().toISOString();
fs.writeFileSync(depsPath, `${JSON.stringify(depsJson, null, 2)}\n`);
console.log("Updated dependencies.json (removed SP-123–140, added SP-141–170)");
