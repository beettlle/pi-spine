#!/usr/bin/env node
/**
 * One-shot generator for Phase 20 (SP-123–SP-140) task packets.
 * Run: node scripts/generate-phase20-tasks.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASKS_ROOT = path.join(ROOT, "spine-tasks");
const DATE = "2026-06-11";
const TEST_CMD = "npm run typecheck && SPINE_WORKER_STUB=1 npm test";
const COV_CMD = "npm run coverage:check";

/** @type {Array<{ id: string, slug: string, title: string, size: string, level: number, levelLabel: string, score: string, assessment: string, mission: string, deps: string[], context: string[], fileScope: string[], implSteps: string[], docsMust: string[], docsCheck: string[], doNot: string[], codeTask?: boolean }>} */
const TASKS = [
	{
		id: "SP-123",
		slug: "config-schema-v2",
		title: "Config schema v2",
		size: "M",
		level: 1,
		levelLabel: "Plan Only",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Config schema extension only; no engine behavior yet.",
		mission:
			"Extend spine-config.json with v2.0 sections (review, handoff, metrics, contract) and validation defaults. Export defaults for downstream Phase 20 tasks.",
		deps: ["SP-122"],
		context: [
			"docs/PRD-v2.0-implementation-handoff.md §6.2",
			"templates/spine-config.json",
			"src/config/",
		],
		fileScope: [
			"templates/spine-config.json",
			"src/config/*.mjs",
			"bin/spine-init.mjs",
			"tests/config/contract-mode.test.mjs",
			"docs/adoption/operator-runbook.md",
		],
		implSteps: [
			"Add review, handoff, metrics, contract blocks per handoff §6.2",
			"Validate on spine init and config load; merge defaults for missing keys",
			"Export typed defaults from config module",
			"Unit tests: defaults, invalid contract.mode rejected, legacyTaskIdPrefixes",
		],
		docsMust: ["docs/adoption/operator-runbook.md — config table for new keys"],
		docsCheck: [],
		doNot: ["Implement CLI behavior (downstream tasks)", "Break existing config load"],
	},
	{
		id: "SP-124",
		slug: "contract-parser",
		title: "Contract parser",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "New parser module integrated into existing validatePrompt path.",
		mission:
			"Parse ## Contract table from PROMPT.md; implement validateContract; integrate into validatePrompt based on contract.mode and legacy TP-* prefixes.",
		deps: ["SP-123"],
		context: [
			"docs/PRD-v2.0-implementation-handoff.md §4",
			"src/tasks/packet/parse-prompt.mjs",
			"src/tasks/packet/validate-prompt.mjs",
		],
		fileScope: [
			"src/tasks/packet/parse-prompt.mjs",
			"src/tasks/packet/validate-prompt.mjs",
			"src/tasks/packet/validate-contract.mjs",
			"src/tasks/packet/index.mjs",
			"tests/tasks/contract-parse.test.mjs",
			"test/fixtures/taskplane/FX-missing-contract/**",
			"test/fixtures/taskplane/FX-valid-contract/**",
		],
		implSteps: [
			"Implement parseContract(markdown) → ParsedContract per handoff §4.3",
			"Implement validateContract with mode and legacy prefix rules",
			"Extend validatePrompt to attach contract validation",
			"Add fixtures FX-missing-contract and FX-valid-contract",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Duplicate validation logic outside validate-contract.mjs", "Require Contract for TP-* legacy tasks"],
	},
	{
		id: "SP-125",
		slug: "tasks-validate-cli",
		title: "spine tasks validate CLI",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "New CLI exposing existing validation; planner scope reuse.",
		mission:
			"Implement spine tasks validate <scope> with --json and --warnings-only. Reuse planner scope resolution and formatPromptValidationFailures.",
		deps: ["SP-124"],
		context: [
			"docs/PRD-v2.0-implementation-handoff.md §6.4, §7.1",
			"src/planner/index.mjs",
			"src/tasks/packet/validate-prompt.mjs",
		],
		fileScope: [
			"bin/spine-tasks.mjs",
			"bin/spine.mjs",
			"tests/tasks/validate-cli.test.mjs",
			"test/fixtures/taskplane/FX-invalid-no-testing/**",
		],
		implSteps: [
			"Create bin/spine-tasks.mjs with scope resolution (same as spine plan)",
			"Human + JSON output per TasksValidateResult schema",
			"Exit codes 0/1/2; --warnings-only for non-blocking checks",
			"Wire spine help tasks subcommand",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Duplicate validatePrompt schema", "Mutate batch state"],
	},
	{
		id: "SP-126",
		slug: "preflight-tasks-validate",
		title: "Preflight tasks-validate + slash",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Thin wiring of SP-125 into preflight and slash.",
		mission:
			"Add preflight check id tasks-validate for pending scope; register /spine-validate slash command.",
		deps: ["SP-125"],
		context: ["bin/spine-preflight.mjs", "extensions/spine/slash-commands.ts"],
		fileScope: [
			"bin/spine-preflight.mjs",
			"extensions/spine/slash-commands.ts",
			"tests/spine-preflight.test.mjs",
		],
		implSteps: [
			"Add tasks-validate check using shared validate helper",
			"suggestedCommand on fail: spine tasks validate pending",
			"Register /spine-validate slash delegating to CLI",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Bury validate errors inside plan check message"],
	},
	{
		id: "SP-127",
		slug: "handoff-cli",
		title: "spine handoff CLI",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 1, Pattern novelty: 1, Security: 1, Reversibility: 1",
		assessment: "New CLI module reading reconcile + journal; secret redaction required.",
		mission:
			"Implement spine handoff [--batch ID] [--json] writing .spine/handoff.md with normative sections per handoff §7.4.",
		deps: ["SP-123"],
		context: [
			"docs/PRD-v2.0-implementation-handoff.md §7.4",
			"src/batch/reconcile.mjs",
			"src/batch/journal.mjs",
		],
		fileScope: [
			"src/cli/handoff.mjs",
			"bin/spine.mjs",
			"tests/cli/spine-handoff.test.mjs",
			"tests/fixtures/handoff-golden.md",
		],
		implSteps: [
			"Implement handoff data assembly from reconcileBatch and journal tail",
			"Markdown renderer with normative section order",
			"--json output with handoffPath",
			"Redact secrets (NFR-UXB-02); idle state when no active batch",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Include API keys, tokens, or worker log bodies"],
	},
	{
		id: "SP-128",
		slug: "handoff-slash-journal",
		title: "Handoff slash + journal + next hint",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Wiring only after SP-127 core module exists.",
		mission:
			"Wire /spine-handoff slash, journal handoff.written event, and spine next handoff path hint.",
		deps: ["SP-127"],
		context: ["src/cli/handoff.mjs", "extensions/spine/slash-commands.ts"],
		fileScope: [
			"extensions/spine/slash-commands.ts",
			"src/batch/journal.mjs",
			"bin/spine-cli/batch.mjs",
			"tests/cli/spine-handoff.test.mjs",
		],
		implSteps: [
			"/spine-handoff delegates to spine handoff CLI",
			"Append handoff.written journal event when batch active",
			"spine next appends Handoff hint when file exists",
		],
		docsMust: [],
		docsCheck: [],
		doNot: [],
	},
	{
		id: "SP-129",
		slug: "final-verdict-parse",
		title: "Final verdict parsing",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Extends review.mjs; must not break step APPROVE/REVISE.",
		mission:
			"Extend parseReviewVerdict and spine review step for --type final with PASS/REVISE/REPLAN verdicts.",
		deps: ["SP-123"],
		context: ["src/batch/review.mjs", "docs/PRD-v1.3-upstream-execution-bridge.md §6.4"],
		fileScope: [
			"src/batch/review.mjs",
			"bin/spine-review-step.mjs",
			"tests/batch/review.test.mjs",
		],
		implSteps: [
			"parseReviewVerdict accepts PASS/REVISE/REPLAN when reviewType is final",
			"Step plan|code still APPROVE/REVISE only",
			"Artifact path .reviews/final-{timestamp}.md",
			"Regression: existing step review tests green",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Break step APPROVE/REVISE behavior (M-UXB-07)"],
	},
	{
		id: "SP-130",
		slug: "final-verdict-engine",
		title: "Final verdict engine loop",
		size: "L",
		level: 3,
		levelLabel: "Full",
		score: "6/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 2",
		assessment: "Engine integration — highest risk Phase 20 task; REVISE cap and merge block.",
		mission:
			"Integrate final review loop in engine-lanes.mjs: REVISE retry cap, REPLAN fail path, Review Level 0 skip, wave merge block on needs_replan.",
		deps: ["SP-129"],
		context: ["src/batch/engine-lanes.mjs", "docs/PRD-v2.0-implementation-handoff.md §8"],
		fileScope: [
			"src/batch/engine-lanes.mjs",
			"tests/batch/final-verdict.test.mjs",
			"test/fixtures/taskplane/FX-final-replan/**",
		],
		implSteps: [
			"Final review phase after steps when requireFinalVerdict && reviewLevel >= 1",
			"REVISE: increment finalAttempt; cap at maxFinalAttempts → review_exhausted",
			"REPLAN: failed + exitReason needs_replan; journal task.verdict_recorded; no .DONE",
			"Block wave merge while needs_replan present",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Weaken existing step review flow"],
	},
	{
		id: "SP-131",
		slug: "contract-verifier",
		title: "Contract verifier at final review",
		size: "M",
		level: 3,
		levelLabel: "Full",
		score: "5/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 2",
		assessment: "Machine checks in worktree; integrates with final review path.",
		mission:
			"Implement verifyContract machine checks (testCommand, file scope, coverage, artifacts) in lane worktree before final reviewer verdict.",
		deps: ["SP-124", "SP-129"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §4.5"],
		fileScope: [
			"src/batch/contract-verify.mjs",
			"src/batch/review.mjs",
			"src/batch/engine-lanes.mjs",
			"tests/batch/contract-verify.test.mjs",
		],
		implSteps: [
			"verifyContract(worktreePath, parsedContract, config) per §4.5",
			"Reuse coverage parser from existing testing policy",
			"Attach verifier result to final review input",
			"Skip for legacy TP-* and absent Contract",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Run verifier on step reviews"],
	},
	{
		id: "SP-132",
		slug: "needs-replan-diagnosis",
		title: "needs_replan diagnosis",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Diagnosis taxonomy + reconcile precedence extension.",
		mission:
			"Add needs_replan to diagnosis taxonomy and reconciliation precedence; operator JSON per handoff §9.",
		deps: ["SP-130"],
		context: ["src/batch/diagnosis.mjs", "src/batch/reconcile.mjs"],
		fileScope: [
			"src/batch/diagnosis.mjs",
			"src/batch/reconcile.mjs",
			"tests/compat/final-verdict-reconcile.test.mjs",
		],
		implSteps: [
			"Add needs_replan to DIAGNOSIS_TAXONOMY",
			"Detect exitReason needs_replan and last REPLAN verdict",
			"Precedence: needs_replan over needs_retry; blocks needs_merge",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: ["Change plain needs_retry for non-replan failures"],
	},
	{
		id: "SP-133",
		slug: "agent-templates-final-contract",
		title: "Agent templates final + contract",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Template-only; extends SP-063/065 patterns.",
		mission:
			"Update worker and reviewer templates for final verdict and contract verification per handoff §8.",
		deps: ["SP-129", "SP-131"],
		context: ["templates/agents/worker.md", "templates/agents/reviewer.md"],
		fileScope: [
			"templates/agents/worker.md",
			"templates/agents/reviewer.md",
			"tests/agent-template-drift.test.mjs",
		],
		implSteps: [
			"Worker: final review sequence before .DONE",
			"Reviewer: PASS/REVISE/REPLAN section for --type final",
			"Extend agent template drift test",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Change step review enums"],
	},
	{
		id: "SP-134",
		slug: "run-metrics-writer",
		title: "run-metrics.jsonl writer",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 1, Reversibility: 0",
		assessment: "Append-only persistence; no secrets in records.",
		mission:
			"Append task and batch metric lines to .spine/run-metrics.jsonl on terminal outcomes per handoff §6.5.",
		deps: ["SP-130"],
		context: ["src/batch/lifecycle.mjs", "src/batch/engine-lanes.mjs"],
		fileScope: [
			"src/batch/metrics.mjs",
			"src/batch/engine-lanes.mjs",
			"src/batch/lifecycle.mjs",
			"tests/batch/run-metrics.test.mjs",
		],
		implSteps: [
			"appendTaskMetric on completed/failed/skipped",
			"appendBatchMetric on batch terminal",
			"Include finalVerdict, contractOk, finalAttempts",
			"Respect metrics.enabled; no prompt text or secrets",
		],
		docsMust: [],
		docsCheck: [],
		doNot: ["Log prompt text or env secrets"],
	},
	{
		id: "SP-135",
		slug: "metrics-show-cli",
		title: "spine metrics show CLI",
		size: "S",
		level: 1,
		levelLabel: "Plan Only",
		score: "2/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Read-only CLI over JSONL file.",
		mission:
			"Implement spine metrics show [--batch ID] [--json] [--last N] and doctor advisory hint.",
		deps: ["SP-134"],
		context: ["docs/PRD-v2.0-implementation-handoff.md §6.5"],
		fileScope: [
			"bin/spine.mjs",
			"bin/spine-doctor.mjs",
			"tests/batch/run-metrics.test.mjs",
		],
		implSteps: [
			"Filter by batchId; human table + JSON output",
			"Doctor advisory when metrics file exists",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/operator-runbook.md"],
		doNot: [],
	},
	{
		id: "SP-136",
		slug: "wave-a-docs",
		title: "Wave A doc completion",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Docs-only delta checklist; no src changes.",
		mission:
			"Finalize Wave A adoption docs (upstream workflow, README, bootstrap cross-links) per FR-UXB-01 delta checklist.",
		deps: [],
		context: [
			"docs/adoption/upstream-execution-workflow.md",
			"docs/PRD-v2.0-implementation-handoff.md",
		],
		fileScope: [
			"docs/adoption/upstream-execution-workflow.md",
			"docs/adoption/bootstrap-checklist.md",
			"README.md",
		],
		implSteps: [
			"Verify decision tree and spine-native command sequence",
			"README Documentation table links workflow doc",
			"Explicit: pi-spine does not invoke zero-pi",
		],
		docsMust: [
			"docs/adoption/upstream-execution-workflow.md",
			"docs/adoption/bootstrap-checklist.md",
			"README.md",
		],
		docsCheck: [],
		doNot: ["Re-specify finished prose — delta only"],
		codeTask: false,
	},
	{
		id: "SP-137",
		slug: "skill-contract-explore",
		title: "create-spine-tasks Contract + explore",
		size: "M",
		level: 1,
		levelLabel: "Plan Only",
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Skill and template updates for authors.",
		mission:
			"Update create-spine-tasks skill with Step 0 explore and ## Contract authoring guidance; add contract-template.md.",
		deps: ["SP-124"],
		context: [
			"skills/create-spine-tasks/SKILL.md",
			"docs/PRD-v2.0-implementation-handoff.md §4",
		],
		fileScope: [
			"skills/create-spine-tasks/SKILL.md",
			"skills/create-spine-tasks/references/prompt-template.md",
			"skills/create-spine-tasks/references/explore-template.md",
			"skills/create-spine-tasks/references/contract-template.md",
		],
		implSteps: [
			"Step 0 Explore when-to-skip guidance",
			"Add Contract section to prompt-template",
			"Create contract-template.md with examples",
			"Launch sequence includes spine tasks validate pending",
		],
		docsMust: ["skills/create-spine-tasks/references/contract-template.md"],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-138",
		slug: "operator-runbook-v20",
		title: "Operator runbook v2.0 sections",
		size: "M",
		level: 0,
		levelLabel: "None",
		score: "1/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 1",
		assessment: "Docs-only after CLI tasks land.",
		mission:
			"Add operator runbook sections: validate, handoff, needs_replan, Contract mode, metrics show.",
		deps: ["SP-125", "SP-128", "SP-132"],
		context: ["docs/adoption/operator-runbook.md"],
		fileScope: ["docs/adoption/operator-runbook.md"],
		implSteps: [
			"spine tasks validate section",
			"spine handoff workflow",
			"needs_replan diagnosis and retry flow",
			"Contract mode and legacy TP-* guidance",
			"spine metrics show usage",
		],
		docsMust: ["docs/adoption/operator-runbook.md"],
		docsCheck: [],
		doNot: [],
		codeTask: false,
	},
	{
		id: "SP-139",
		slug: "integration-fixtures-smoke",
		title: "Integration fixtures + adoption smoke",
		size: "M",
		level: 2,
		levelLabel: "Plan + Code",
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "E2E fixtures tying Phase 20 together.",
		mission:
			"Extend adoption fixtures and smoke script: validate before batch, REPLAN → needs_replan integration path.",
		deps: ["SP-126", "SP-132", "SP-135"],
		context: ["scripts/adoption-smoke.sh", "tests/adoption/"],
		fileScope: [
			"test/fixtures/taskplane/FX-*",
			"scripts/adoption-smoke.sh",
			"tests/adoption/**",
		],
		implSteps: [
			"FX fixtures for contract validate and final REPLAN",
			"adoption-smoke: spine tasks validate before batch",
			"Integration test: REPLAN → needs_replan diagnosis",
		],
		docsMust: [],
		docsCheck: ["docs/adoption/bootstrap-checklist.md"],
		doNot: [],
	},
	{
		id: "SP-140",
		slug: "context-phase20-tracking",
		title: "CONTEXT Phase 20 tracking",
		size: "S",
		level: 0,
		levelLabel: "None",
		score: "0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment: "Meta tracking task — updates CONTEXT and dependencies graph.",
		mission:
			"Finalize spine-tasks/CONTEXT.md Phase 20 section, dependencies.json edges, Next Task ID SP-141.",
		deps: [
			"SP-123",
			"SP-124",
			"SP-125",
			"SP-126",
			"SP-127",
			"SP-128",
			"SP-129",
			"SP-130",
			"SP-131",
			"SP-132",
			"SP-133",
			"SP-134",
			"SP-135",
			"SP-136",
			"SP-137",
			"SP-138",
			"SP-139",
		],
		context: ["spine-tasks/CONTEXT.md", "spine-tasks/dependencies.json"],
		fileScope: ["spine-tasks/CONTEXT.md", "spine-tasks/dependencies.json"],
		implSteps: [
			"Add Phase 20 wave table and exit criteria",
			"Set Next Task ID to SP-141",
			"Verify spine plan SP-123 respects dependency graph",
		],
		docsMust: ["spine-tasks/CONTEXT.md"],
		docsCheck: [],
		doNot: ["Implement feature code in this task"],
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

function fileScopeSection(paths) {
	return paths.map((p) => `- \`${p}\``).join("\n");
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
			return `### Step ${i + 1}: ${s.split(";")[0].slice(0, 60)}

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

## Canonical Task Folder

\`\`\`
${folderPath}/
├── PROMPT.md
├── STATUS.md
└── .DONE
\`\`\`

## Mission

${task.mission}

**Source:** [docs/PRD-v2.0-implementation-handoff.md](../../docs/PRD-v2.0-implementation-handoff.md)

## Dependencies

${depSection(task.deps)}

${contextSection(task.context)}## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

${fileScopeSection(task.fileScope)}

## Steps

### Step 0: Preflight

- [ ] Read handoff doc section for this task
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
- [ ] Acceptance criteria in handoff doc satisfied for ${task.id}

## Git Commit Convention

- \`feat(${task.id}): complete Step N — description\`
- \`fix(${task.id}): description\`

## Do NOT

${task.doNot.map((d) => `- ${d}`).join("\n")}

---

## Amendments (Added During Execution)
`;
}

function buildStatus(task) {
	const stepBlocks = [
		`### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Read handoff doc section
- [ ] Dependencies satisfied`,
		...task.implSteps.map(
			(s, i) => `### Step ${i + 1}: Work
**Status:** ⬜ Not Started

- [ ] ${s}`,
		),
		`### Step ${task.implSteps.length + 1}: Testing & Verification
**Status:** ⬜ Not Started

- [ ] FULL test suite passing
- [ ] Coverage gate (if applicable)`,

		`### Step ${task.implSteps.length + 2}: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updated
- [ ] .DONE created`,
	];

	return `# ${task.id}: ${task.title} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** ${DATE}
**Review Level:** ${task.level}
**Review Counter:** 0
**Iteration:** 0
**Size:** ${task.size}

---

${stepBlocks.join("\n\n---\n\n")}

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

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
	const absFolder = `spine-tasks/${folder}`;
	fs.writeFileSync(path.join(folderPath, "PROMPT.md"), buildPrompt(task, absFolder));
	fs.writeFileSync(path.join(folderPath, "STATUS.md"), buildStatus(task));
	console.log(`Created ${folder}`);
}

// Merge dependencies.json
const depsPath = path.join(TASKS_ROOT, "dependencies.json");
const depsJson = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
for (const [id, deps] of Object.entries(depEdges)) {
	depsJson.tasks[id] = deps;
}
depsJson.generatedAt = new Date().toISOString();
fs.writeFileSync(depsPath, `${JSON.stringify(depsJson, null, 2)}\n`);
console.log("Updated dependencies.json");

console.log("Done — 18 task packets created (SP-123–SP-140)");
