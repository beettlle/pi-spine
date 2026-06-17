#!/usr/bin/env node
/**
 * One-shot staging: decompose Phase 28 M tasks (SP-257–262) into S children
 * SP-263–275, plus SP-276/277 docs tasks. Marks parents superseded.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASKS = path.join(ROOT, "spine-tasks");

const AGENT_MODELS = `## Agent Models (operator — set before batch)

| Role | Model |
|------|-------|
| Worker | \`cursor/auto\` |
| Reviewer | \`google/gemini-3.1-pro-preview\` |

\`\`\`bash
spine settings set agents.worker.model cursor/auto
spine settings set agents.reviewer.model google/gemini-3.1-pro-preview
\`\`\``;

const AMENDMENTS = `---

## Amendments (Added During Execution)
`;

const TEST_STEP = `### Step 3: Testing & Verification

- [ ] Run FULL test suite: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\`
- [ ] Run coverage gate: \`npm run coverage:check\` — ≥77% line coverage
- [ ] Build passes: \`npm run typecheck\``;

const DOC_STEP = `### Step 4: Documentation & Delivery

- [ ] Log discoveries in STATUS.md if needed
- [ ] Create \`.DONE\``;

const DO_NOT_REVIEW = `## Do NOT

- Refactor unrelated review.mjs logic outside file scope
- Skip \`spine_review_step\` at Level 2 checkpoints
`;

function statusHeader(id, title, size, reviewLevel, steps) {
	return `# ${id}: ${title} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-17
**Review Level:** ${reviewLevel}
**Review Counter:** 0
**Iteration:** 0
**Size:** ${size}

---

${steps.map((s, i) => `### Step ${i}: ${s.name}\n**Status:** ⬜ Not Started\n\n${s.items.map((x) => `- [ ] ${x}`).join("\n")}\n\n---\n`).join("\n")}

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
| 2026-06-17 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
`;
}

function prompt(packet) {
	const depsBlock =
		packet.deps.length === 0
			? "- **None**"
			: packet.deps.map((d) => `- **Task:** ${d}`).join("\n");
	const ctxBlock = packet.context.map((c) => `- \`${c}\``).join("\n");
	const scopeBlock = packet.fileScope.map((f) => `- \`${f}\``).join("\n");
	const contractRows = Object.entries(packet.contract)
		.map(([k, v]) => `| ${k} | ${v} |`)
		.join("\n");
	const stepsBlock = packet.steps.join("\n\n");
	const docBlock = packet.docReq
		? `## Documentation Requirements\n\n**Must Update:**\n${packet.docReq.must.map((d) => `- \`${d}\``).join("\n") || "- None"}\n\n**Check If Affected:**\n${packet.docReq.check.map((d) => `- \`${d}\``).join("\n") || "- None"}`
		: `## Documentation Requirements\n\n**Must Update:**\n- None\n\n**Check If Affected:**\n- None`;

	return `# Task: ${packet.id} — ${packet.title}

**Created:** 2026-06-17
**Size:** ${packet.size}

## Review Level: ${packet.reviewLevel}

**Assessment:** ${packet.assessment}
**Score:** ${packet.score}

## Mission

${packet.mission}

## Dependencies

${depsBlock}

${AGENT_MODELS}

## Context to Read First

${ctxBlock}

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

${scopeBlock}

## Contract

| Field | Value |
|-------|-------|
${contractRows}

## Steps

${stepsBlock}

${docBlock}

## Completion Criteria

- [ ] All steps complete
- [ ] Tests passing per contract
- [ ] \`.DONE\` created

## Git Commit Convention

- \`feat(${packet.id}): complete Step N — description\`
- \`fix(${packet.id}): description\`
- \`test(${packet.id}): description\`

${packet.doNot}
${AMENDMENTS}`;
}

/** @type {Array<{id:string,slug:string,prompt:string,status:string}>} */
const PACKETS = [];

function add(packet, statusSteps) {
	const dir = path.join(TASKS, `${packet.id}-${packet.slug}`);
	fs.mkdirSync(dir, { recursive: true });
	const p = prompt(packet);
	PACKETS.push({
		id: packet.id,
		slug: packet.slug,
		prompt: p,
		status: statusHeader(packet.id, packet.title, packet.size, packet.reviewLevelNum, statusSteps),
	});
}

add(
	{
		id: "SP-263",
		slug: "sat020-coverage-diagnosis",
		title: "SAT-020 coverage flake diagnosis",
		size: "S",
		reviewLevel: "1 (Plan Only)",
		reviewLevelNum: 1,
		score: "2/8 — Blast radius: 0, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Read-only reproduction and root-cause documentation before code fix.",
		mission:
			"Reproduce `tests/batch/stall-sat020-integration.test.mjs` flake under `npm run coverage:check`, document root cause and proposed fix in STATUS.md for SP-264. No production code changes.",
		deps: [],
		context: [
			"tests/batch/stall-sat020-integration.test.mjs",
			"bin/spine-worker-runner.mjs",
			"spine-tasks/SP-257-stabilize-sat020-coverage/PROMPT.md",
		],
		fileScope: ["tests/batch/stall-sat020-integration.test.mjs", "tests/fixtures/stall-sat020/**"],
		contract: {
			testCommand: "`npm test -- tests/batch/stall-sat020-integration.test.mjs`",
			fileScopeMustNotChange: "bin/spine-worker-runner.mjs, src/batch/**",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Run SAT-020 test alone — confirm pass under \`npm test\`\n- [ ] Run \`npm run coverage:check\` ≥3 times — record pass/fail rate`,
			`### Step 1: Root-cause analysis\n> **Plan-review checkpoint**\n\n- [ ] Identify timing vs missing-event vs race under coverage instrumentation\n- [ ] Document fix approach in STATUS.md Discoveries for SP-264\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP.replace("Step 3", "Step 2").replace("Step 4", "Step 3"),
			DOC_STEP.replace("Step 4", "Step 3"),
		],
		doNot: `## Do NOT\n\n- Change production stall logic or worker-runner stub in this task\n- Implement the fix (SP-264 scope)`,
	},
	[
		{ name: "Preflight", items: ["Baseline npm test pass", "Coverage flake rate recorded"] },
		{ name: "Root-cause analysis", items: ["Root cause documented", "Fix plan for SP-264", "Plan review complete"] },
		{ name: "Testing & Verification", items: ["Targeted tests pass"] },
		{ name: "Documentation & Delivery", items: ["STATUS.md updated", ".DONE created"] },
	],
);

add(
	{
		id: "SP-264",
		slug: "sat020-coverage-fix",
		title: "SAT-020 coverage stabilization fix",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Implement minimal test-harness fix from SP-263 diagnosis.",
		mission:
			"Apply the fix documented in SP-263 so SAT-020 passes reliably under `npm run coverage:check` (3 consecutive runs). Preserve journal event order: checkpoint_warning → stall_killed → salvage_inspection → task.failed.",
		deps: ["SP-263"],
		context: ["spine-tasks/SP-263-sat020-coverage-diagnosis/STATUS.md", "tests/batch/stall-sat020-integration.test.mjs"],
		fileScope: ["tests/batch/stall-sat020-integration.test.mjs", "bin/spine-worker-runner.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "tests/batch/stall-sat020-integration.test.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Read SP-263 STATUS Discoveries — confirm fix approach\n- [ ] Reproduce flake if still present`,
			`### Step 1: Implement stabilization\n> **Code review checkpoint**\n\n- [ ] Apply minimal fix (prefer test harness over production stall defaults)\n- [ ] Keep SAT-020 stub semantics (2× step_completed, hang without .DONE)\n- [ ] Call \`spine_review_step\` after step`,
			`${TEST_STEP}\n- [ ] Run coverage gate **3 consecutive times**: \`npm run coverage:check\``,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Disable SAT-020 in CI\n- Change production default stall timeouts without PROMPT amendment\n- Touch review.mjs (SP-265+ scope)`,
	},
	[
		{ name: "Preflight", items: ["SP-263 findings read"] },
		{ name: "Implement stabilization", items: ["Fix applied", "Code review complete"] },
		{ name: "Testing & Verification", items: ["3× coverage:check pass", "Full suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-265",
		slug: "review-shared-pure-helpers",
		title: "Extract review-shared pure helpers",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1",
		assessment: "Create shared module with pure verdict/artifact helpers before wiring imports.",
		mission:
			"Create `src/batch/review-shared.mjs` with extracted pure helpers (verdict parsing, artifact paths) and unit tests. Do not rewire engine-lanes/review.mjs or review.mjs yet.",
		deps: [],
		context: ["src/batch/engine-lanes/review.mjs", "src/batch/review.mjs"],
		fileScope: ["src/batch/review-shared.mjs", "tests/batch/review-shared.test.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "src/batch/review-shared.mjs",
			artifactsMustExist: "src/batch/review-shared.mjs, tests/batch/review-shared.test.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Diff engine-lanes/review.mjs vs review.mjs — list duplicated pure helpers\n- [ ] Baseline: \`npm test -- tests/batch/engine-code-review.test.mjs\``,
			`### Step 1: Extract pure helpers\n> **Plan-review checkpoint**\n\n- [ ] Create review-shared.mjs with named exports\n- [ ] Add targeted unit tests\n- [ ] Call \`spine_review_step\` after step`,
			`${TEST_STEP}\n- [ ] Log extracted symbols in STATUS.md for SP-266`,
			DOC_STEP,
		],
		doNot: `${DO_NOT_REVIEW}\n- Wire imports in review.mjs yet (SP-266)`,
	},
	[
		{ name: "Preflight", items: ["Duplication inventory"] },
		{ name: "Extract pure helpers", items: ["review-shared.mjs created", "Unit tests added"] },
		{ name: "Testing & Verification", items: ["Suite + coverage green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-266",
		slug: "review-dedup-wire",
		title: "Wire review dedup imports",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Rewire both review files to use review-shared; behavior must stay identical.",
		mission:
			"Update `src/batch/engine-lanes/review.mjs` and `src/batch/review.mjs` to import from `review-shared.mjs` and remove duplicated blocks. No behavior change.",
		deps: ["SP-265"],
		context: ["src/batch/review-shared.mjs", "spine-tasks/SP-258-dedupe-engine-lanes-review/PROMPT.md"],
		fileScope: ["src/batch/engine-lanes/review.mjs", "src/batch/review.mjs", "tests/batch/engine-code-review.test.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "src/batch/engine-lanes/review.mjs, src/batch/review.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-265 complete (review-shared.mjs exists)\n- [ ] Baseline engine-code-review tests green`,
			`### Step 1: Rewire imports\n> **Code review checkpoint**\n\n- [ ] Update both review files to import shared helpers\n- [ ] Remove duplicate blocks ≥30 lines for extracted concerns\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: `${DO_NOT_REVIEW}\n- Extract spawn logic (SP-267)`,
	},
	[
		{ name: "Preflight", items: ["SP-265 verified"] },
		{ name: "Rewire imports", items: ["Both files import review-shared", "Duplicates removed"] },
		{ name: "Testing & Verification", items: ["engine-code-review tests pass", "Coverage green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-267",
		slug: "review-spawn-extract",
		title: "Extract review-spawn module",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Move spawnReviewerPi from review.mjs into review-spawn.mjs.",
		mission:
			"Extract `spawnReviewerPi` and tightly coupled private helpers from `src/batch/review.mjs` into `src/batch/review-spawn.mjs`. Preserve model argv, timeout, nested-reviewer guard, SPINE_REVIEW_TEST_NO_PI.",
		deps: ["SP-266"],
		context: ["src/batch/review.mjs", "src/batch/review-shared.mjs"],
		fileScope: ["src/batch/review-spawn.mjs", "src/batch/review.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "src/batch/review-spawn.mjs, src/batch/review.mjs",
			artifactsMustExist: "src/batch/review-spawn.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Identify spawnReviewerPi and coupled helpers to move\n- [ ] Baseline nested-reviewer-guard tests`,
			`### Step 1: Extract module\n> **Code review checkpoint**\n\n- [ ] Create review-spawn.mjs; review.mjs delegates\n- [ ] No duplicate spawn logic in review.mjs\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: DO_NOT_REVIEW,
	},
	[
		{ name: "Preflight", items: ["Spawn sites identified"] },
		{ name: "Extract module", items: ["review-spawn.mjs created", "review.mjs delegates"] },
		{ name: "Testing & Verification", items: ["Suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-268",
		slug: "review-spawn-tests",
		title: "Review-spawn tests and guard regression",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Add review-spawn unit tests and verify nested-reviewer guard.",
		mission:
			"Add `tests/batch/review-spawn.test.mjs` covering argv/model and fail-closed missing pi. Confirm nested-reviewer guard tests still pass.",
		deps: ["SP-267"],
		context: ["src/batch/review-spawn.mjs", "tests/batch/nested-reviewer-guard.test.mjs"],
		fileScope: ["tests/batch/review-spawn.test.mjs", "tests/batch/nested-reviewer-guard.test.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "tests/batch/review-spawn.test.mjs",
			artifactsMustExist: "tests/batch/review-spawn.test.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-267 complete`,
			`### Step 1: Add tests\n> **Code review checkpoint**\n\n- [ ] review-spawn.test.mjs — argv includes --model when pinned; missing pi fails closed\n- [ ] nested-reviewer-guard regression green\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: DO_NOT_REVIEW,
	},
	[
		{ name: "Preflight", items: ["SP-267 verified"] },
		{ name: "Add tests", items: ["review-spawn tests added", "Guard tests pass"] },
		{ name: "Testing & Verification", items: ["Full suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-269",
		slug: "config-loaders-to-src",
		title: "Move config loaders to src/config",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 0",
		assessment: "Create src/config modules and thin bin re-exports only.",
		mission:
			"Move `loadSpineConfig`, preflight helpers, and init constants from `bin/` into `src/config/*`. Make `bin/spine-config.mjs`, `bin/spine-preflight.mjs`, `bin/spine-init.mjs` thin re-exporters. Do not rewire src imports yet.",
		deps: [],
		context: ["bin/spine-config.mjs", "bin/spine-preflight.mjs", "bin/spine-init.mjs"],
		fileScope: [
			"src/config/spine-config-load.mjs",
			"src/config/spine-preflight-lib.mjs",
			"src/config/spine-init-constants.mjs",
			"bin/spine-config.mjs",
			"bin/spine-preflight.mjs",
			"bin/spine-init.mjs",
		],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "src/config/spine-config-load.mjs",
			artifactsMustExist: "src/config/spine-config-load.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Grep src imports from bin — inventory for SP-270/271\n- [ ] Confirm no circular deps`,
			`### Step 1: Move loaders\n> **Plan-review checkpoint**\n\n- [ ] Create three src/config modules\n- [ ] bin/*.mjs re-export from src\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Rewire src/** imports (SP-270/271)\n- Touch review.mjs`,
	},
	[
		{ name: "Preflight", items: ["Import inventory"] },
		{ name: "Move loaders", items: ["src/config modules created", "bin re-exports"] },
		{ name: "Testing & Verification", items: ["Suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-270",
		slug: "rewire-batch-config-imports",
		title: "Rewire batch imports off bin",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Update src/batch and dashboard snapshot imports to src/config.",
		mission:
			"Replace all `src/batch/**` and `src/dashboard/snapshot.mjs` imports from `../../bin/` with `src/config/*` equivalents.",
		deps: ["SP-269"],
		context: ["spine-tasks/SP-260-fix-src-bin-imports/PROMPT.md"],
		fileScope: ["src/batch/**/*.mjs", "src/dashboard/snapshot.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "src/batch/engine.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-269 complete`,
			`### Step 1: Rewire imports\n> **Code review checkpoint**\n\n- [ ] Update all src/batch and dashboard imports\n- [ ] Call \`spine_review_step\` after step`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Touch src/cli (SP-271)\n- Change spine-config.json schema`,
	},
	[
		{ name: "Preflight", items: ["SP-269 verified"] },
		{ name: "Rewire imports", items: ["batch imports updated"] },
		{ name: "Testing & Verification", items: ["Suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-271",
		slug: "rewire-cli-layer-test",
		title: "Rewire cli/migrate and layer inversion test",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Finish src→bin cleanup for cli/migrate plus static layer test.",
		mission:
			"Update `src/cli/**` and `src/migrate/**` to import from `src/config/*`. Add `tests/config/spine-config-layer.test.mjs` asserting zero `src/**` imports from `bin/**`.",
		deps: ["SP-269"],
		context: ["spine-tasks/SP-260-fix-src-bin-imports/PROMPT.md"],
		fileScope: ["src/cli/**/*.mjs", "src/migrate/**/*.mjs", "tests/config/spine-config-layer.test.mjs"],
		contract: {
			testCommand: "`npm run coverage:check`",
			fileScopeMustChange: "tests/config/spine-config-layer.test.mjs",
			artifactsMustExist: "tests/config/spine-config-layer.test.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-269 complete; SP-270 may land in parallel`,
			`### Step 1: Rewire + test\n> **Code review checkpoint**\n\n- [ ] Update cli/migrate imports\n- [ ] Add layer inversion grep/AST test\n- [ ] Call \`spine_review_step\` after step`,
			`${TEST_STEP}\n- [ ] \`node bin/spine.mjs doctor\` smoke`,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Leave any src/** importing bin/**`,
	},
	[
		{ name: "Preflight", items: ["SP-269 verified"] },
		{ name: "Rewire + test", items: ["cli/migrate updated", "layer test added"] },
		{ name: "Testing & Verification", items: ["Zero bin imports in src", "Suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-272",
		slug: "eslint-flat-config",
		title: "ESLint flat config and npm script",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 0",
		assessment: "Add eslint 9 flat config that passes on current tree.",
		mission:
			"Add `eslint.config.js`, `eslint` devDependency, and `npm run lint` scoped to src/bin/tests/scripts. Baseline rules only — no mass reformat.",
		deps: [],
		context: ["package.json", "spine-tasks/SP-261-add-eslint-baseline/PROMPT.md"],
		fileScope: ["package.json", "package-lock.json", "eslint.config.js"],
		contract: {
			testCommand: "`npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange: "eslint.config.js, package.json",
			artifactsMustExist: "eslint.config.js",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm no existing eslint config`,
			`### Step 1: ESLint setup\n> **Plan-review checkpoint**\n\n- [ ] Add eslint devDep (verify on npm registry)\n- [ ] eslint.config.js + npm run lint exits 0\n- [ ] Call \`spine_review_step\` after step`,
			`${TEST_STEP}\n- [ ] List enabled rules in STATUS.md`,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Enable aggressive style rules requiring whole-repo reformat\n- Wire CI yet (SP-273)`,
	},
	[
		{ name: "Preflight", items: ["No existing eslint config"] },
		{ name: "ESLint setup", items: ["eslint.config.js", "npm run lint passes"] },
		{ name: "Testing & Verification", items: ["Lint + test green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-273",
		slug: "eslint-ci-runbook",
		title: "Wire lint into CI and runbook",
		size: "S",
		reviewLevel: "1 (Plan Only)",
		reviewLevelNum: 1,
		score: "2/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 0",
		assessment: "CI and operator docs for npm run lint.",
		mission:
			"Add `npm run lint` to `.github/workflows/ci.yml` and document in operator runbook. Depends on SP-272 eslint config existing.",
		deps: ["SP-272"],
		context: [".github/workflows/ci.yml", "docs/adoption/operator-runbook.md"],
		fileScope: [".github/workflows/ci.yml", "docs/adoption/operator-runbook.md"],
		contract: {
			testCommand: "`npm run lint`",
			fileScopeMustChange: ".github/workflows/ci.yml",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-272 complete (\`npm run lint\` exists)`,
			`### Step 1: CI and docs\n\n- [ ] Add lint step to ci.yml after typecheck\n- [ ] Add npm run lint to operator runbook dev verification section`,
			`### Step 2: Testing & Verification\n\n- [ ] \`npm run lint\` exits 0\n- [ ] Full suite: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\``,
			DOC_STEP.replace("Step 4", "Step 3"),
		],
		doNot: `## Do NOT\n\n- Change eslint rules (SP-272)`,
		docReq: { must: ["docs/adoption/operator-runbook.md"], check: ["README.md"] },
	},
	[
		{ name: "Preflight", items: ["SP-272 verified"] },
		{ name: "CI and docs", items: ["ci.yml updated", "runbook updated"] },
		{ name: "Testing & Verification", items: ["Lint passes"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-274",
		slug: "tsconfig-batch-script",
		title: "Add tsconfig.batch and typecheck script",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 2, Security: 0, Reversibility: 1",
		assessment: "Expand typecheck infrastructure without fixing all module errors yet.",
		mission:
			"Add `tsconfig.batch.json` and update `npm run typecheck` to run extension tsc + batch checkJs pass.",
		deps: ["SP-271"],
		context: ["tsconfig.json", "package.json", "spine-tasks/SP-262-extend-src-typecheck/PROMPT.md"],
		fileScope: ["tsconfig.json", "tsconfig.batch.json", "package.json"],
		contract: {
			testCommand: "`npm run typecheck`",
			fileScopeMustChange: "package.json",
			artifactsMustExist: "tsconfig.batch.json",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-271 landed (src/config stable)\n- [ ] Baseline typecheck passes`,
			`### Step 1: Typecheck expansion\n> **Plan-review checkpoint**\n\n- [ ] Add tsconfig.batch.json with checkJs scope for src/batch + src/config\n- [ ] Update npm run typecheck script\n- [ ] Call \`spine_review_step\` after step`,
			`### Step 2: Testing & Verification\n\n- [ ] npm run typecheck passes (may defer module JSDoc to SP-275)\n- [ ] SPINE_WORKER_STUB=1 npm test`,
			DOC_STEP.replace("Step 4", "Step 3"),
		],
		doNot: `## Do NOT\n\n- Add JSDoc to all batch modules (SP-275)\n- Migrate entire repo to TypeScript`,
	},
	[
		{ name: "Preflight", items: ["SP-271 verified"] },
		{ name: "Typecheck expansion", items: ["tsconfig.batch.json", "typecheck script updated"] },
		{ name: "Testing & Verification", items: ["typecheck passes"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-275",
		slug: "batch-jsdoc-typecheck",
		title: "JSDoc checkJs for batch hot paths",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 2, Security: 0, Reversibility: 1",
		assessment: "Fix tsc errors in scoped batch modules with minimal JSDoc.",
		mission:
			"Resolve all tsc checkJs errors in engine.mjs, worker-host.mjs, worktree.mjs, spine-config-load.mjs. Add typecheck-batch regression test.",
		deps: ["SP-274"],
		context: ["tsconfig.batch.json"],
		fileScope: [
			"src/batch/engine.mjs",
			"src/batch/worker-host.mjs",
			"src/batch/worktree.mjs",
			"src/config/spine-config-load.mjs",
			"tests/config/typecheck-batch.test.mjs",
		],
		contract: {
			testCommand: "`npm run typecheck && npm run coverage:check`",
			fileScopeMustChange: "tests/config/typecheck-batch.test.mjs",
			artifactsMustExist: "tests/config/typecheck-batch.test.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-274 complete`,
			`### Step 1: JSDoc fixes\n> **Code review checkpoint**\n\n- [ ] Minimal @param/@returns only where tsc requires\n- [ ] No runtime behavior changes\n- [ ] Call \`spine_review_step\` after step`,
			`### Step 2: Regression test\n\n- [ ] Add tests/config/typecheck-batch.test.mjs`,
			TEST_STEP,
			`${DOC_STEP}\n- [ ] One-line typecheck scope note in operator runbook`,
		],
		doNot: `## Do NOT\n\n- Type review.mjs god-file in this slice`,
		docReq: { must: ["docs/adoption/operator-runbook.md"], check: ["README.md"] },
	},
	[
		{ name: "Preflight", items: ["SP-274 verified"] },
		{ name: "JSDoc fixes", items: ["tsc clean for scoped modules"] },
		{ name: "Testing & Verification", items: ["typecheck + coverage green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-276",
		slug: "document-best-of-n-readme",
		title: "Best-of-N README documentation",
		size: "S",
		reviewLevel: "0 (None)",
		reviewLevelNum: 0,
		score: "0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment: "Docs-only; dev script not shipped in npm package.",
		mission:
			"Document `scripts/best-of-n.mjs` in README: parallel pi runs across models in isolated worktrees, dev/git-checkout only (not in npm files whitelist), examples from script HELP, contrast with spine batch engine.",
		deps: [],
		context: ["scripts/best-of-n.mjs", "README.md"],
		fileScope: ["README.md"],
		contract: {
			testCommand: "`true`",
			fileScopeMustChange: "README.md",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Read scripts/best-of-n.mjs HELP and pick README section placement`,
			`### Step 1: Add Best-of-N section\n\n- [ ] What/when/prerequisites/examples/cleanup\n- [ ] Note: git checkout only, not npm install -g\n- [ ] Optional: one line in Feature summary`,
			`### Step 2: Testing & Verification\n\n- [ ] Run FULL test suite: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\``,
			DOC_STEP.replace("Step 4", "Step 3"),
		],
		doNot: `## Do NOT\n\n- Add best-of-n.mjs to package.json files whitelist\n- Create separate markdown docs file`,
		docReq: { must: ["README.md"], check: [] },
	},
	[
		{ name: "Preflight", items: ["Script HELP read"] },
		{ name: "Add Best-of-N section", items: ["README section added"] },
		{ name: "Testing & Verification", items: ["Full suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-277",
		slug: "ci-first-publish-docs",
		title: "CI-first publish doc sync",
		size: "S",
		reviewLevel: "0 (None)",
		reviewLevelNum: 0,
		score: "1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0",
		assessment: "Docs-only alignment with publish.yml CI workflow.",
		mission:
			"Update README, docs/release/*, and operator-runbook to describe CI-first release: bump version on main → green CI → publish.yml. Demote manual npm publish to emergency footnote. Sync README version with package.json.",
		deps: [],
		context: [
			".github/workflows/publish.yml",
			"docs/release/npm-publish.md",
			"docs/release/v1.0-checklist.md",
			"package.json",
		],
		fileScope: [
			"README.md",
			"docs/release/npm-publish.md",
			"docs/release/v1.0-checklist.md",
			"docs/adoption/operator-runbook.md",
		],
		contract: {
			testCommand: "`true`",
			fileScopeMustChange: "docs/release/npm-publish.md",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Read publish.yml trigger and skip-if-exists logic`,
			`### Step 1: Update release docs\n\n- [ ] CI-first flow in npm-publish.md and v1.0-checklist.md\n- [ ] README CI section mentions publish workflow + current version\n- [ ] Remove \"Until npm publish\" from operator-runbook`,
			`### Step 2: Testing & Verification\n\n- [ ] Run FULL test suite: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\``,
			DOC_STEP.replace("Step 4", "Step 3"),
		],
		doNot: `## Do NOT\n\n- Change publish.yml in this task\n- Run npm publish locally`,
		docReq: {
			must: ["docs/release/npm-publish.md", "docs/release/v1.0-checklist.md", "docs/adoption/operator-runbook.md"],
			check: ["README.md"],
		},
	},
	[
		{ name: "Preflight", items: ["publish.yml reviewed"] },
		{ name: "Update release docs", items: ["CI-first docs synced", "README version updated"] },
		{ name: "Testing & Verification", items: ["Full suite green"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

for (const p of PACKETS) {
	const dir = path.join(TASKS, `${p.id}-${p.slug}`);
	fs.writeFileSync(path.join(dir, "PROMPT.md"), p.prompt);
	fs.writeFileSync(path.join(dir, "STATUS.md"), p.status);
	console.log(`created ${p.id}-${p.slug}`);
}

const SUPERSEDED = {
	"SP-257": "SP-263, SP-264",
	"SP-258": "SP-265, SP-266",
	"SP-259": "SP-267, SP-268",
	"SP-260": "SP-269, SP-270, SP-271",
	"SP-261": "SP-272, SP-273",
	"SP-262": "SP-274, SP-275",
};

for (const [id, children] of Object.entries(SUPERSEDED)) {
	const dirs = fs.readdirSync(TASKS).filter((d) => d.startsWith(`${id}-`));
	for (const d of dirs) {
		const dir = path.join(TASKS, d);
		fs.writeFileSync(path.join(dir, ".SUPERSEDED"), `Superseded by ${children}\nStaged: 2026-06-17\n`);
		const promptPath = path.join(dir, "PROMPT.md");
		let text = fs.readFileSync(promptPath, "utf-8");
		if (!text.includes("Superseded — execution moved to")) {
			text = text.replace(
				AMENDMENTS.trim(),
				`## Amendments (Added During Execution)

### Amendment 1 — 2026-06-17
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to ${children}.
`,
			);
			fs.writeFileSync(promptPath, text);
		}
		console.log(`superseded ${d}`);
	}
}

const depsPath = path.join(TASKS, "dependencies.json");
const depsJson = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
for (const id of ["SP-257", "SP-258", "SP-259", "SP-260", "SP-261", "SP-262"]) {
	delete depsJson.tasks[id];
}
Object.assign(depsJson.tasks, {
	"SP-263": [],
	"SP-264": ["SP-263"],
	"SP-265": [],
	"SP-266": ["SP-265"],
	"SP-267": ["SP-266"],
	"SP-268": ["SP-267"],
	"SP-269": [],
	"SP-270": ["SP-269"],
	"SP-271": ["SP-269"],
	"SP-272": [],
	"SP-273": ["SP-272"],
	"SP-274": ["SP-271"],
	"SP-275": ["SP-274"],
	"SP-276": [],
	"SP-277": [],
});
depsJson.generatedAt = new Date().toISOString();
depsJson.source = "phase28-decomposition-2026-06-17";
fs.writeFileSync(depsPath, `${JSON.stringify(depsJson, null, 2)}\n`);
console.log("updated dependencies.json");
