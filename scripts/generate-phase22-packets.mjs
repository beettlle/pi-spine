#!/usr/bin/env node
/**
 * Generate Phase 22 spine task packets (SP-171–SP-191).
 * One-off authoring helper — not part of npm test.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const TASKS = path.join(ROOT, "spine-tasks");

/** @type {Array<{id:number,rel:number,slug:string,title:string,mission:string,deps:string[],scope:string[],review:number,testCmd?:string}>} */
const TASKS_SPEC = [
	{ id: 171, rel: 1, slug: "rel-handoff-doc", title: "Reliability handoff doc", mission: "Author docs/PRD-v2.1-reliability-handoff.md §1–7.", deps: ["SP-170"], scope: ["docs/PRD-v2.1-reliability-handoff.md"], review: 0, testCmd: "true" },
	{ id: 172, rel: 2, slug: "rel-explore-findings", title: "Reliability explore findings", mission: "Write spine-tasks/_explore/reliability-epic/findings.md and link in CONTEXT explore table.", deps: ["SP-171"], scope: ["spine-tasks/_explore/reliability-epic/findings.md", "spine-tasks/CONTEXT.md"], review: 0, testCmd: "true" },
	{ id: 173, rel: 3, slug: "rel-journal-reader", title: "Journal timeline reader", mission: "Create readJournalTimeline() filtering task/batch lifecycle events.", deps: ["SP-172"], scope: ["src/batch/journal-rebuild.mjs", "tests/batch/journal-rebuild.test.mjs"], review: 3 },
	{ id: 174, rel: 4, slug: "rel-journal-rebuild", title: "Journal rebuild core", mission: "Implement rebuildBatchStateFromJournal() applying events to task/segment rows.", deps: ["SP-173"], scope: ["src/batch/journal-rebuild.mjs", "tests/batch/journal-rebuild.test.mjs", "tests/fixtures/incidents/*"], review: 3 },
	{ id: 175, rel: 5, slug: "rel-reconcile-drift", title: "Reconcile state drift", mission: "Add detectBatchStateDrift() and state_drift diagnosis in reconcile.", deps: ["SP-174"], scope: ["src/batch/reconcile.mjs", "src/batch/diagnosis.mjs", "tests/batch/journal-rebuild.test.mjs"], review: 3 },
	{ id: 176, rel: 6, slug: "rel-transition-helper", title: "Atomic task transition", mission: "Add recordTaskTransition() single write path for journal + batch-state.", deps: ["SP-175"], scope: ["src/batch/state.mjs", "tests/batch/state-transition.test.mjs"], review: 3 },
	{ id: 177, rel: 7, slug: "rel-transition-wire", title: "Wire atomic transitions", mission: "Wire retry/resume success paths to recordTaskTransition; regression SP-120.", deps: ["SP-176"], scope: ["src/batch/retry.mjs", "src/batch/engine-lanes.mjs", "tests/batch/retry-state-drift.test.mjs"], review: 2 },
	{ id: 178, rel: 8, slug: "rel-real-pi-ci", title: "Real-pi CI workflow", mission: "Add .github/workflows/real-pi.yml (workflow_dispatch + weekly).", deps: ["SP-172"], scope: [".github/workflows/real-pi.yml", "docs/adoption/real-pi-e2e.md"], review: 1 },
	{ id: 179, rel: 9, slug: "rel-real-pi-fixture", title: "Multi-task real-pi fixture", mission: "Extend adoption fixture with second disjoint task for multi-task E2E.", deps: ["SP-178"], scope: ["tests/fixtures/adoption-repo/*", "scripts/real-pi-adoption-e2e.sh"], review: 2 },
	{ id: 180, rel: 10, slug: "rel-pilot-signoff", title: "Consumer pilot template", mission: "Add docs/adoption/consumer-pilot-report-template.md.", deps: ["SP-179"], scope: ["docs/adoption/consumer-pilot-report-template.md"], review: 0, testCmd: "true" },
	{ id: 181, rel: 11, slug: "rel-agentsession-doctor", title: "agentSession doctor", mission: "Doctor/preflight checks for lanes.workerBackend=agentSession.", deps: ["SP-177"], scope: ["bin/spine-doctor.mjs", "bin/spine-preflight.mjs", "tests/doctor/worker-backend.test.mjs"], review: 2 },
	{ id: 182, rel: 12, slug: "rel-agentsession-abort", title: "agentSession abort fail-loud", mission: "Journal lane.worker_abort_failed on abort failure; no empty catch.", deps: ["SP-181"], scope: ["src/batch/agent-session-worker.mjs", "tests/batch/agent-session-abort.test.mjs"], review: 2 },
	{ id: 183, rel: 13, slug: "rel-agentsession-dogfood", title: "agentSession dogfood report", mission: "Document stub-free agentSession batch sign-off.", deps: ["SP-182"], scope: ["docs/compatibility/agent-session-dogfood-report.md", "scripts/stub-free-dogfood.sh"], review: 0, testCmd: "true" },
	{ id: 184, rel: 14, slug: "rel-wait-terminal", title: "Resume wait-terminal default", mission: "Default resume to --wait-terminal after orphan diagnoses unless --detached.", deps: ["SP-175"], scope: ["src/batch/detached-start.mjs", "bin/spine-cli/batch.mjs", "tests/batch/detached-resume-wait.test.mjs"], review: 2 },
	{ id: 185, rel: 15, slug: "rel-doctor-worktree", title: "Doctor worktree health", mission: "Doctor advisory for relative gitdir, PI_SPINE_ROOT, worktreeSetupHook.", deps: ["SP-172"], scope: ["src/doctor/worktree-health.mjs", "bin/spine-doctor.mjs", "tests/doctor/worktree-health.test.mjs"], review: 1 },
	{ id: 186, rel: 16, slug: "rel-runbook-attached", title: "Attached-first runbook", mission: "Operator runbook attached-first policy and orphan recovery tree.", deps: ["SP-185"], scope: ["docs/adoption/operator-runbook.md", "README.md"], review: 0, testCmd: "true" },
	{ id: 187, rel: 17, slug: "rel-npm-publish-prep", title: "npm publish prep", mission: "Release checklist and package.json publish fields.", deps: ["SP-180"], scope: ["package.json", "docs/release/npm-publish.md"], review: 1 },
	{ id: 188, rel: 18, slug: "rel-auto-integrate", title: "Auto wave integrate", mission: "Config lanes.autoIntegrateBetweenWaves (default false) + engine hook.", deps: ["SP-177"], scope: ["src/batch/engine-scope.mjs", "src/config/settings-fields.mjs", "tests/batch/auto-integrate.test.mjs"], review: 2 },
	{ id: 189, rel: 19, slug: "rel-contract-required", title: "Contract required flip", mission: "Flip dogfood contract.mode to required; fix pending SP-* packets.", deps: ["SP-170"], scope: [".spine/spine-config.json", "spine-tasks/SP-171-*/PROMPT.md"], review: 1 },
	{ id: 190, rel: 20, slug: "rel-handoff-autowrite", title: "Handoff autoWriteOn", mission: "handoff.autoWriteOn session_start + /spine entry hook.", deps: ["SP-189"], scope: ["src/config/defaults.mjs", "extensions/spine/slash-commands.ts", "tests/cli/handoff-autowrite.test.mjs"], review: 2 },
	{ id: 191, rel: 0, slug: "rel-context-phase22", title: "CONTEXT Phase 22", mission: "Update CONTEXT.md Phase 22, dependencies.json, Next Task ID SP-192.", deps: ["SP-180", "SP-183", "SP-186", "SP-187", "SP-188", "SP-190"], scope: ["spine-tasks/CONTEXT.md", "spine-tasks/dependencies.json"], review: 0, testCmd: "true" },
];

const REVIEW_LABELS = ["None", "Plan Only", "Plan and Code", "Full"];
const DEFAULT_TEST = "npm run typecheck && SPINE_WORKER_STUB=1 npm test";

function reviewScore(level) {
	if (level === 0) return { score: "0/8", blast: 0, pattern: 0, sec: 0, rev: 0 };
	if (level === 1) return { score: "2/8", blast: 1, pattern: 0, sec: 0, rev: 1 };
	if (level === 2) return { score: "4/8", blast: 1, pattern: 1, sec: 0, rev: 1 };
	return { score: "6/8", blast: 2, pattern: 1, sec: 0, rev: 1 };
}

function depLines(deps) {
	if (!deps.length) return "- **None**";
	return deps.map((d) => `- **Task:** ${d}`).join("\n");
}

function scopeLines(scope) {
	return scope.map((s) => `- \`${s}\``).join("\n");
}

function buildPrompt(t) {
	const relTag = t.rel ? ` (SP-REL-${String(t.rel).padStart(3, "0")})` : "";
	const rs = reviewScore(t.review);
	const testCmd = t.testCmd ?? DEFAULT_TEST;
	const contractFileScope =
		t.review === 0 && t.testCmd === "true" ? "" : t.scope.map((s) => `\`${s}\``).join(", ");

	return `# Task: SP-${t.id} — ${t.title}

**Created:** 2026-06-11
**Size:** S

## Review Level: ${t.review} (${REVIEW_LABELS[t.review]})

**Assessment:** Phase 22 reliability epic${relTag}.
**Score:** ${rs.score} — Blast radius: ${rs.blast}, Pattern novelty: ${rs.pattern}, Security: ${rs.sec}, Reversibility: ${rs.rev}

## Mission

${t.mission}

**Source:** [docs/PRD-v2.1-reliability-handoff.md](../../docs/PRD-v2.1-reliability-handoff.md)

## Dependencies

${depLines(t.deps)}

## Context to Read First

**Tier 3:**
- \`docs/PRD-v2.1-reliability-handoff.md\`
- \`spine-tasks/_explore/reliability-epic/findings.md\`

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

${scopeLines(t.scope)}

## Contract

| Field | Value |
|-------|-------|
| testCommand | \`${testCmd}\` |
| fileScopeMustChange | ${contractFileScope} |
| fileScopeMustNotChange | |
${t.review > 0 ? "| minLineCoverage | 77 |" : ""}
| artifactsMustExist | |

## Steps

### Step 0: Preflight

- [ ] Read handoff entry for SP-${t.id}
- [ ] Dependencies satisfied

### Step 1: Implement

- [ ] Deliver mission scope for SP-${t.id}

### Step 2: Testing & Verification

- [ ] Run: \`${testCmd}\`
${t.review > 0 ? "- [ ] Run coverage gate: `npm run coverage:check` — ≥77% on in-scope changed code" : ""}
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Update docs per scope
- [ ] Create \`.DONE\` when complete

## Completion Criteria

- [ ] All steps complete
- [ ] Handoff §4 acceptance for SP-${t.id}

## Git Commit Convention

- \`feat(SP-${t.id}): complete Step N — description\`

## Do NOT

- Expand scope beyond File Scope without replan
`;
}

function buildStatus(t) {
	return `# SP-${t.id}: ${t.title} — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-11
**Review Level:** ${t.review}
**Size:** S

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
| 2026-06-11 | Task staged | PROMPT.md and STATUS.md created |
`;
}

/** @type {Record<string, string[]>} */
const depGraph = {};

for (const t of TASKS_SPEC) {
	const dir = path.join(TASKS, `SP-${t.id}-${t.slug}`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, "PROMPT.md"), buildPrompt(t));
	fs.writeFileSync(path.join(dir, "STATUS.md"), buildStatus(t));
	depGraph[`SP-${t.id}`] = t.deps;
	console.log(`created SP-${t.id}-${t.slug}`);
}

const depsPath = path.join(TASKS, "dependencies.json");
const existing = JSON.parse(fs.readFileSync(depsPath, "utf-8"));
for (const [id, deps] of Object.entries(depGraph)) {
	existing.tasks[id] = deps;
}
existing.generatedAt = new Date().toISOString();
existing.source = "phase22-generator";
fs.writeFileSync(depsPath, `${JSON.stringify(existing, null, 2)}\n`);
console.log("updated dependencies.json");
