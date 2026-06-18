#!/usr/bin/env node
/**
 * Decompose M tasks SP-282, SP-284, SP-292 into S children SP-294–299.
 * Marks parents superseded. Run after resizing SP-289/290 to S.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const TASKS = path.join(ROOT, "spine-tasks");
const DEPS_PATH = path.join(TASKS, "dependencies.json");

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

const TEST_STEP = `### Step 2: Testing & Verification

> **Code review checkpoint**

- [ ] Run: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\`
- [ ] Run: \`npm run coverage:check\` — ≥77% line coverage`;

const DOC_STEP = `### Step 3: Documentation & Delivery

- [ ] Create \`.DONE\``;

function statusHeader(id, title, size, reviewLevel, steps) {
	return `# ${id}: ${title} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-18
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

| Finding | Impact |
|---------|--------|

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-06-18 | Task staged | PROMPT.md and STATUS.md created |
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
	const closesBlock = packet.closes
		? `\n**Closes:** [#${packet.closes}](https://github.com/beettlle/pi-spine/issues/${packet.closes})\n`
		: "";
	const docBlock = packet.docReq
		? `## Documentation Requirements\n\n**Must Update:**\n${packet.docReq.must.map((d) => `- \`${d}\``).join("\n") || "- None"}\n\n**Check If Affected:**\n${packet.docReq.check.map((d) => `- \`${d}\``).join("\n") || "- None"}`
		: `## Documentation Requirements\n\n**Must Update:**\n- None\n\n**Check If Affected:**\n- None`;

	const completionExtra = packet.closes
		? `\n- [ ] Issue #${packet.closes} closed with comment referencing ${packet.id}`
		: "";

	return `# Task: ${packet.id} — ${packet.title}

**Created:** 2026-06-18
**Size:** ${packet.size}

## Review Level: ${packet.reviewLevel}

**Assessment:** ${packet.assessment}
**Score:** ${packet.score}
${closesBlock}
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
- [ ] Tests passing per contract${completionExtra}
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
	PACKETS.push({
		id: packet.id,
		slug: packet.slug,
		prompt: prompt(packet),
		status: statusHeader(packet.id, packet.title, packet.size, packet.reviewLevelNum, statusSteps),
	});
}

// SP-282 → SP-294 (core) + SP-295 (delivery)
add(
	{
		id: "SP-294",
		slug: "early-artifact-honor-core",
		title: "Early artifact honor core",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Review spawn wait loop — poll on-disk artifact and kill hung pi without full stall timeout.",
		mission:
			"Implement core early-artifact honor for engine reviewer spawn (parent SP-282, issue #5).\n\n" +
			"**Required behavior:**\n" +
			"1. While awaiting reviewer `pi` exit, poll for terminal on-disk review artifact (APPROVE/PASS/REVISE/REPLAN) on bounded interval with mtime quiescence.\n" +
			"2. When artifact is valid, journal `review.completed` with `honorReason: artifact_ready`, terminate hung child.\n" +
			"3. Final review: honor only when contract verification already passed (same guard as `honorReviewSpawnFailureWhenEligible`).\n" +
			"4. Preserve SP-279 timeout backstop when no artifact appears.",
		deps: ["SP-285"],
		context: [
			"spine-tasks/SP-282-reviewer-artifact-early-honor/PROMPT.md",
			"src/batch/review.mjs",
			"src/batch/review-spawn.mjs",
			"src/batch/task-stall-budget.mjs",
		],
		fileScope: [
			"src/batch/review.mjs",
			"src/batch/review-spawn.mjs",
			"src/batch/task-stall-budget.mjs",
		],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange: "src/batch/review.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Read SP-282 parent mission and issue #5 timeline\n- [ ] Confirm SP-285 nested-spawn env fix merged`,
			`### Step 1: Early artifact honor loop\n\n> **Plan-review checkpoint**\n\n- [ ] Poll artifact path during reviewer wait\n- [ ] Honor terminal verdict + kill hung pi\n- [ ] Final-review contract guard preserved`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Honor partial/invalid artifacts\n- Skip contract verification on final reviews\n- Close GitHub issue in this slice (SP-295 delivery)`,
	},
	[
		{ name: "Preflight", items: ["Issue #5 timeline reviewed", "SP-285 merged"] },
		{ name: "Early artifact honor loop", items: ["Poll + honor implemented", "Final-review guard intact"] },
		{ name: "Testing & Verification", items: ["Typecheck + stub tests pass", "Coverage ≥77%"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-295",
		slug: "early-artifact-honor-delivery",
		title: "Early artifact honor delivery",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Fixture tests, runbook, and issue close for SP-282 / #5.",
		mission:
			"Complete delivery slice for early-artifact honor (parent SP-282).\n\n" +
			"Add fixture test from batch `20260618T000943`, update operator runbook, close GitHub issue #5.",
		closes: "5",
		deps: ["SP-294"],
		context: [
			"spine-tasks/SP-294-early-artifact-honor-core/PROMPT.md",
			"tests/batch/review-spawn-timeout-recovery.test.mjs",
			"tests/batch/engine-final-review-timeout.test.mjs",
			".spine/runtime/20260618T000943/archive/",
		],
		fileScope: [
			"tests/batch/reviewer-artifact-early-honor.test.mjs",
			"tests/batch/review-spawn-timeout-recovery.test.mjs",
			"docs/adoption/operator-runbook.md",
		],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange:
				"tests/batch/reviewer-artifact-early-honor.test.mjs, docs/adoption/operator-runbook.md",
			minLineCoverage: "77",
			artifactsMustExist: "tests/batch/reviewer-artifact-early-honor.test.mjs",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-294 core honor merged`,
			`### Step 1: Tests and runbook\n\n- [ ] \`reviewer-artifact-early-honor.test.mjs\`: hung spawn + on-disk APPROVE → seconds not 90m\n- [ ] Runbook entry for hung reviewer with artifact on disk`,
			TEST_STEP,
			`### Step 3: Documentation & Delivery\n\n- [ ] Close GitHub issue #5: \`gh issue close 5 --comment "Fixed in SP-282/SP-295: engine honors on-disk reviewer artifact and kills hung pi without waiting full stall timeout."\`\n- [ ] Create \`.DONE\``,
		],
		docReq: { must: ["docs/adoption/operator-runbook.md"], check: [] },
		doNot: `## Do NOT\n\n- Re-implement core honor loop (belongs in SP-294)`,
	},
	[
		{ name: "Preflight", items: ["SP-294 merged"] },
		{ name: "Tests and runbook", items: ["Fixture test added", "Runbook updated"] },
		{ name: "Testing & Verification", items: ["Full suite + coverage pass"] },
		{ name: "Documentation & Delivery", items: ["Issue #5 closed", ".DONE created"] },
	],
);

// SP-284 → SP-296 + SP-297
add(
	{
		id: "SP-296",
		slug: "engine-orphan-resume-core",
		title: "Engine orphan resume core",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "4/8 — Blast radius: 2, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Allow batch resume when engine PID dead without manual pause first.",
		mission:
			"Implement core dead-engine resume path (parent SP-284, issue #7).\n\n" +
			"**Required behavior:**\n" +
			"1. When engine PID is absent/stale and diagnosis is `engine_orphaned` or recoverable `worker_orphaned`, `batch resume --attached` succeeds without prior `batch pause`.\n" +
			"2. `--force` bypasses `phase: running` only when engine is confirmed dead.\n" +
			"3. Reuse `finalizeBatchForIntegrate` when post-merge limbo conditions hold.",
		deps: [],
		context: [
			"spine-tasks/SP-284-engine-orphan-resume/PROMPT.md",
			"src/batch/resume-multi-validate.mjs",
			"src/batch/resume-multi.mjs",
			"src/batch/detached-start.mjs",
		],
		fileScope: [
			"src/batch/resume-multi-validate.mjs",
			"src/batch/resume-multi.mjs",
			"src/batch/detached-start.mjs",
		],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange: "src/batch/resume-multi-validate.mjs",
			minLineCoverage: "77",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Trace resume rejection for phase running + dead enginePid\n- [ ] Read issue #7 timeline`,
			`### Step 1: Dead-engine resume path\n\n> **Plan-review checkpoint**\n\n- [ ] Resume allowed when engine orphaned\n- [ ] Force bypass only when PID confirmed dead\n- [ ] Post-merge limbo finalize wired`,
			TEST_STEP,
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Auto-resume while engine PID alive and batch intentionally paused\n- Close issue in this slice (SP-297 delivery)`,
	},
	[
		{ name: "Preflight", items: ["Resume rejection path traced"] },
		{ name: "Dead-engine resume path", items: ["Orphan resume without pause"] },
		{ name: "Testing & Verification", items: ["Typecheck + stub tests pass"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-297",
		slug: "engine-orphan-resume-delivery",
		title: "Engine orphan resume delivery",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Regression test, diagnosis/runbook, issue close for SP-284 / #7.",
		mission:
			"Complete delivery slice for engine orphan resume (parent SP-284).\n\n" +
			"Add `engine-orphan-resume.test.mjs`, update diagnosis messaging and runbook, close GitHub issue #7.",
		closes: "7",
		deps: ["SP-296"],
		context: [
			"spine-tasks/SP-296-engine-orphan-resume-core/PROMPT.md",
			"tests/batch/resume-engine-crash.test.mjs",
			".spine/runtime/20260618T191236/archive/",
		],
		fileScope: [
			"tests/batch/engine-orphan-resume.test.mjs",
			"src/batch/diagnosis.mjs",
			"docs/adoption/operator-runbook.md",
		],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange:
				"tests/batch/engine-orphan-resume.test.mjs, docs/adoption/operator-runbook.md",
			minLineCoverage: "77",
			artifactsMustExist: "tests/batch/engine-orphan-resume.test.mjs",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-296 core resume merged`,
			`### Step 1: Tests and runbook\n\n- [ ] \`engine-orphan-resume.test.mjs\`: dead engine + running phase → resume without pause\n- [ ] Runbook: ENGINE ORPHANED → resume (no pause step)`,
			TEST_STEP,
			`### Step 3: Documentation & Delivery\n\n- [ ] Close GitHub issue #7: \`gh issue close 7 --comment "Fixed in SP-284/SP-297: dead engine resume no longer requires manual pause when phase is running."\`\n- [ ] Create \`.DONE\``,
		],
		docReq: { must: ["docs/adoption/operator-runbook.md"], check: ["src/batch/diagnosis.mjs"] },
		doNot: `## Do NOT\n\n- Re-implement validate.mjs fix (belongs in SP-296)`,
	},
	[
		{ name: "Preflight", items: ["SP-296 merged"] },
		{ name: "Tests and runbook", items: ["Regression test added", "Runbook updated"] },
		{ name: "Testing & Verification", items: ["Full suite + coverage pass"] },
		{ name: "Documentation & Delivery", items: ["Issue #7 closed", ".DONE created"] },
	],
);

// SP-292 → SP-298 + SP-299
add(
	{
		id: "SP-298",
		slug: "tasks-analyze-module",
		title: "tasks analyze module",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "Core analyze logic — blocking checks for overlap and dependency graph.",
		mission:
			"Implement `analyzeTasksScope` core module (parent SP-292).\n\n" +
			"**Blocking checks:**\n" +
			"- Parallel-eligible tasks with overlapping `## File Scope`\n" +
			"- `dependencies.json` cycles or orphan task IDs\n\n" +
			"Return structured findings with severity blocking vs warning (warnings implemented in SP-299).",
		deps: [],
		context: [
			"spine-tasks/SP-292-tasks-analyze-cli/PROMPT.md",
			"bin/spine-tasks.mjs",
			"src/planner/graph.mjs",
			"src/planner/lanes.mjs",
			"tests/tasks/validate-cli.test.mjs",
		],
		fileScope: ["src/tasks/analyze/index.mjs"],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange: "src/tasks/analyze/index.mjs",
			minLineCoverage: "77",
			artifactsMustExist: "src/tasks/analyze/index.mjs",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Review \`spine tasks validate\` scope resolution\n- [ ] List blocking vs warning checks from SP-292 mission`,
			`### Step 1: Analyze module\n\n> **Plan-review checkpoint**\n\n- [ ] Create \`src/tasks/analyze/index.mjs\` with \`analyzeTasksScope({ projectRoot, scope })\`\n- [ ] File-scope overlap for parallel-eligible tasks\n- [ ] Deps graph cycle/orphan checks`,
			TEST_STEP.replace("Step 2", "Step 2").replace("Code review checkpoint", "Code review checkpoint"),
			DOC_STEP,
		],
		doNot: `## Do NOT\n\n- Wire CLI in this slice (SP-299)\n- Invoke LLM or external APIs`,
	},
	[
		{ name: "Preflight", items: ["Validate CLI patterns reviewed"] },
		{ name: "Analyze module", items: ["index.mjs with blocking checks"] },
		{ name: "Testing & Verification", items: ["Unit tests for module logic"] },
		{ name: "Documentation & Delivery", items: [".DONE created"] },
	],
);

add(
	{
		id: "SP-299",
		slug: "tasks-analyze-cli-delivery",
		title: "tasks analyze CLI delivery",
		size: "S",
		reviewLevel: "2 (Plan + Code)",
		reviewLevelNum: 2,
		score: "3/8 — Blast radius: 1, Pattern novelty: 1, Security: 0, Reversibility: 1",
		assessment: "CLI wiring, warning checks, tests, and docs for spine tasks analyze.",
		mission:
			"Complete delivery slice for `spine tasks analyze` (parent SP-292).\n\n" +
			"Wire CLI with `--json`, implement warning-only checks (wave M-count, explore refs, deps/PROMPT drift), add tests and docs.",
		deps: ["SP-298"],
		context: [
			"spine-tasks/SP-298-tasks-analyze-module/PROMPT.md",
			"src/tasks/analyze/index.mjs",
			"bin/spine-tasks.mjs",
		],
		fileScope: [
			"bin/spine-tasks.mjs",
			"src/tasks/analyze/index.mjs",
			"tests/tasks/analyze-cli.test.mjs",
			"docs/QUICK-REFERENCE.md",
			"docs/adoption/upstream-execution-workflow.md",
		],
		contract: {
			testCommand: "`npm run typecheck && SPINE_WORKER_STUB=1 npm test`",
			fileScopeMustChange: "bin/spine-tasks.mjs, tests/tasks/analyze-cli.test.mjs",
			minLineCoverage: "77",
			artifactsMustExist: "tests/tasks/analyze-cli.test.mjs",
		},
		steps: [
			`### Step 0: Preflight\n\n- [ ] Confirm SP-298 analyze module merged`,
			`### Step 1: CLI and warnings\n\n- [ ] Add \`spine tasks analyze\` with \`--json\`; exit 0 unless blocking issues\n- [ ] Warning checks: wave M-count, explore refs, PROMPT/JSON deps drift`,
			`### Step 2: Testing & Verification\n\n- [ ] \`analyze-cli.test.mjs\`: overlap blocking, clean passes, cycle fails, warnings-only exits 0\n- [ ] Run: \`npm run typecheck && SPINE_WORKER_STUB=1 npm test\`\n- [ ] Run: \`npm run coverage:check\` — ≥77%`,
			`### Step 3: Documentation & Delivery\n\n- [ ] QUICK-REFERENCE + upstream-execution-workflow entries\n- [ ] Create \`.DONE\``,
		],
		docReq: {
			must: ["docs/QUICK-REFERENCE.md", "docs/adoption/upstream-execution-workflow.md"],
			check: [],
		},
		doNot: `## Do NOT\n\n- Block batch start automatically (analyze is operator-opt-in)`,
	},
	[
		{ name: "Preflight", items: ["SP-298 merged"] },
		{ name: "CLI and warnings", items: ["analyze subcommand wired"] },
		{ name: "Testing & Verification", items: ["analyze-cli tests pass", "Coverage ≥77%"] },
		{ name: "Documentation & Delivery", items: ["Docs updated", ".DONE created"] },
	],
);

for (const p of PACKETS) {
	const dir = path.join(TASKS, `${p.id}-${p.slug}`);
	fs.writeFileSync(path.join(dir, "PROMPT.md"), p.prompt);
	fs.writeFileSync(path.join(dir, "STATUS.md"), p.status);
	console.log(`created ${p.id}-${p.slug}`);
}

const SUPERSEDED = {
	"SP-282": "SP-294, SP-295",
	"SP-284": "SP-296, SP-297",
	"SP-292": "SP-298, SP-299",
};

for (const [id, children] of Object.entries(SUPERSEDED)) {
	const dirs = fs.readdirSync(TASKS).filter((d) => d.startsWith(`${id}-`));
	for (const d of dirs) {
		const dir = path.join(TASKS, d);
		fs.writeFileSync(path.join(dir, ".SUPERSEDED"), `Superseded by ${children}\nStaged: 2026-06-18\n`);
		const promptPath = path.join(dir, "PROMPT.md");
		let text = fs.readFileSync(promptPath, "utf-8");
		if (!text.includes("Superseded — execution moved to")) {
			text = text.replace(
				AMENDMENTS.trim(),
				`## Amendments (Added During Execution)

### Amendment 1 — 2026-06-18
**Issue:** Original M packet too large for reliable pi workers.
**Resolution:** Superseded — execution moved to ${children}.
`,
			);
			fs.writeFileSync(promptPath, text);
		}
		console.log(`superseded ${d}`);
	}
}

const deps = JSON.parse(fs.readFileSync(DEPS_PATH, "utf-8"));
const t = deps.tasks;
delete t["SP-282"];
delete t["SP-284"];
delete t["SP-292"];
t["SP-294"] = ["SP-285"];
t["SP-295"] = ["SP-294"];
t["SP-296"] = [];
t["SP-297"] = ["SP-296"];
t["SP-298"] = [];
t["SP-299"] = ["SP-298"];
if (t["SP-293"]) {
	t["SP-293"] = t["SP-293"].map((id) => (id === "SP-292" ? "SP-299" : id));
}
deps.generatedAt = new Date().toISOString();
deps.source = "ml-decomposition-2026-06-18";
fs.writeFileSync(DEPS_PATH, `${JSON.stringify(deps, null, 2)}\n`);
console.log("updated dependencies.json");

console.log("\nDone. Next: update CONTEXT.md, run spine tasks validate pending && spine plan pending");
