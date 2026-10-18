# PROMPT.md Template (spine)

Copy this template when creating a new task. Replace all `[bracketed]` fields.

**Before creating:** Verify you have chosen the task type (SKILL Step 2a), scored complexity, and assigned Review Level.
Code tasks default to Level 1; Level 0 is for `Type: execute`, docs-only, and trivial config; Level 2 only for security, data-model, or hot shared modules.
Deterministic commands use the [execute-task variant](#execute-task-variant) instead of this LLM template.

---

````markdown
# Task: [PREFIX-###] — [Name]

**Created:** [YYYY-MM-DD]
**Size:** [S | M | L]
**Type:** [llm | execute]
**Profile:** [optional — worker profile name from `agents.profiles`]
**Thinking:** [optional — off | minimal | low | medium | high | xhigh]
**Reviewer Profile:** [optional — profile from `agents.profiles` whose `reviewer` block judges this task]

> **Agent header fields (#355):** All three are optional; omit them to use `agents.activeProfile`. Names allow `A-Z a-z 0-9 . _ -`. Engine reviews resolve the reviewer per task: `**Reviewer Profile:**` → `agents.profiles.<worker profile>.reviewerProfile` → `agents.reviewerProfile` → `agents.reviewer`, skipping any reviewer in the same model family as the worker. When no cross-family reviewer remains, the task fails with `review_blocked` before any reviewer spawns. `**Profile:**` feeds that resolution today; the worker spawn does not yet apply `**Profile:**` or `**Thinking:**`. See the operator runbook, "Reviewer profiles".

## Review Level: [0-2] ([None | Plan Only | Plan and Code])

**Risk:** [1-2 sentences: severity/blast radius — what breaks and how far the change reaches]
**Score:** [N]/8 — Blast radius: [N], Pattern novelty: [N], Security: [N], Reversibility: [N]
**Problem theory:** [Optional, bug-fix tasks — working diagnosis: why the fault occurs and why this change resolves it]

> **Assessment disambiguation ([#281](https://github.com/beettlle/pi-spine/issues/281)):** Use `**Risk:**` for severity/blast (pairs with **Score**) and `**Problem theory:**` for the working diagnosis. Legacy `**Assessment:**` alone remains accepted by tooling and validators — do not mass-rewrite historical packets.

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`. Stub batches (`SPINE_WORKER_STUB=1`) may still use in-worker stub plan review via the tool when a checkpoint marker requires it.

> **Environment ([#150](https://github.com/beettlle/pi-spine/issues/150)):** Review Level **2+** requires cross-model reviewer support. `SPINE_WORKER_STUB=1` simulates reviews only — verify operator environment before assigning Level 2+.

## Mission

> **Issue links ([#147](https://github.com/beettlle/pi-spine/issues/147)):** Use `Closes #N` when this task fully resolves the issue. Use `Partial #N` when this task is one of several addressing the issue. Place on the first line below (not `Closes: [#N]` or `GitHub: [#N]` variants).

[Closes #N | Partial #N] — [One paragraph: what you're building and why it matters]

## Dependencies

[Choose one:]

- **None**

[OR:]

- **Task:** [PREFIX-###] ([what must be complete])
- **Task:** [area-name/PREFIX-###] ([use area-qualified form if cross-area ID may be ambiguous])
- **External:** [what must be true]

## Context to Read First

> Only list docs the worker actually needs. Less is better.

- `[path/to/CONTEXT.md]`
- `[path/to/specific-doc.md]` — [why needed]
- `Parent split: SP-### — [what was split out]` — **successor tasks only** ([#146](https://github.com/beettlle/pi-spine/issues/146)); omit when not a split child

## Environment

- **Workspace:** [primary folder/service being modified]
- **Services required:** [list, or "None"]

## File Scope

> The orchestrator uses this to avoid merge conflicts: tasks with overlapping
> file scope run on the same lane (serial), not in parallel. List the files and
> directories this task will create or modify. Use wildcards for directories.

- `[path/to/file.ext]`
- `[path/to/directory/*]`
- `[docs/adoption/operator-runbook.md]` — include when listed under Documentation Requirements **Must Update**

## Contract

> **Required for new `SP-*` tasks** when `contract.mode` is `required` (pi-spine default).
> Defines machine-verifiable proof checked at final review. See
> [references/contract-template.md](contract-template.md) for field guidance and examples.
> Taskplane legacy `TP-*` tasks may omit this section when listed in `contract.legacyTaskIdPrefixes`.

| Field | Value |
|-------|-------|
| testCommand | `[shell command in backticks, or \`true\` for docs-only S tasks]` |
| runCommand | `[execute tasks only: the job command; testCommand then proves the result]` |
| fileScopeMustChange | `[optional: comma-separated paths/globs that must change]` |
| fileScopeMustNotChange | `[optional: comma-separated paths/globs that must not change]` |
| minLineCoverage | `[optional: integer 0–100; use 77 for code tasks]` |
| artifactsMustExist | `[optional: comma-separated file paths that must exist]` |

> **Code tasks:** include `testCommand` and usually `minLineCoverage` (≥77%). **Docs-only**
> Review Level 0 + Size S may set `testCommand` to `` `true` ``.

## Steps

> **Section order:** All steps — including `Testing & Verification` and
> `Documentation & Delivery` — belong **inside** `## Steps`, **before**
> `## Completion Criteria`. Never end `## Steps` at implementation work and
> jump straight to Completion Criteria; missing a Testing step fails batch launch
> (`prompt_parse_failed`, SP-075).
>
> **Hydration:** STATUS.md tracks outcomes, not individual code changes. Workers
> expand steps when runtime discoveries warrant it. See `.spine/agents/worker.md` for rules.

### Step 0: Preflight

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

### Step 1: [Name]

- [ ] [Specific, verifiable task]
- [ ] [Specific, verifiable task]
- [ ] [Specific, verifiable task]

**Artifacts:**
- `path/to/file` (new | modified)

### Step [N-1]: Testing & Verification

> **Required for every task** — including docs-only and Review Level 0 packets.
> ZERO test failures allowed. Run the commands below; do **not** assume the Testing step equals full CI parity.
> Contract verify runs only `testCommand` from `## Contract` at final review.
> Operator post-integrate `npm run release:check` owns the whole-repo gate (typecheck → lint → full tests → coverage).
>
> **Code tasks** (File Scope touches `src/`, `bin/`, `tests/`, or `scripts/`): include `npm run lint` in Contract `testCommand` and mirror it here.
> **Docs-only tasks:** keep this step; run only tests that reference the changed docs (`rg -l '<doc path>' tests/`). If there are no hits, record "no tests reference this doc". Post-integrate `release:check` owns the full suite. Omit lint and coverage checkboxes when no application code changes.
>
> Use `--test-reporter=dot` on `node --test` so passing tests do not flood the worker context.

- [ ] Run lint (code tasks only): `npm run lint` — or project analyze command when present
- [ ] Run Contract `testCommand`: `[exact command from ## Contract — typically lint && typecheck && scoped node --test --test-reporter=dot]`
- [ ] Run coverage gate (Size L, or when Contract sets `minLineCoverage`): `[testWithCoverage command, e.g. npm run coverage:check]` — **≥77% line coverage** on in-scope changed code
- [ ] Run integration tests (if applicable)
- [ ] Fix all failures

### Step [N]: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

> **File Scope rule ([#144](https://github.com/beettlle/pi-spine/issues/144)):** Every path under **Must Update**
> **must** also appear in `## File Scope`. If a doc is advisory only, list it under **Check If Affected**
> instead — do not require workers to edit paths outside File Scope.

**Must Update:**
- `[path/to/doc.md]` — [what to add/change] *(also list this path in `## File Scope`)*

**Check If Affected:**
- `[path/to/doc.md]` — [update if relevant]

## Completion Criteria

- [ ] All steps complete
- [ ] All tests passing
- [ ] Documentation updated

## Git Commit Convention

Commits happen at **step boundaries** (not after every checkbox). All commits
for this task MUST include the task ID for traceability:

- **Step completion:** `feat([PREFIX-###]): complete Step N — description`
- **Bug fixes:** `fix([PREFIX-###]): description`
- **Tests:** `test([PREFIX-###]): description`
- **Hydration:** `hydrate: [PREFIX-###] expand Step N checkboxes`

## Do NOT

- Expand task scope — add tech debt to CONTEXT.md instead
- Skip tests
- Modify framework/standards docs without explicit user approval
- Load docs not listed in "Context to Read First"
- Commit without the task ID prefix in the commit message
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` — maintained by spine engine / GitNexus ([#149](https://github.com/beettlle/pi-spine/issues/149))

---

## Amendments (Added During Execution)

> Rarely used — workers normally log discoveries in STATUS.md Notes instead.

<!-- Workers add amendments here if issues discovered during execution.
     Format:
     ### Amendment N — YYYY-MM-DD HH:MM
     **Issue:** [what was wrong]
     **Resolution:** [what was changed] -->
````

---

## Example — Review Level block fields ([#281](https://github.com/beettlle/pi-spine/issues/281))

Use unambiguous field names: `**Risk:**` for severity/blast (pairs with **Score**), `**Problem theory:**` for the working diagnosis. Legacy `**Assessment:**` alone remains valid — do not mass-rewrite historical packets.

```markdown
**Risk:** Docs and templates only; no runtime code paths touched.
**Score:** 1/8 — Blast radius: 1, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** The `Assessment` field was overloaded — packets used it for score blurbs and fault theories interchangeably, so workers could not tell severity from diagnosis.
```

---

## Execute-task variant

Use for deterministic commands (generators, smoke runs, evidence collection, deploys). The engine runs `runCommand` in the lane worktree with **no LLM worker**, then verifies the Contract. `validatePrompt` still requires the standard sections and a Testing step; keep them short — the engine does not execute steps. Add a `## Matrix` table to fan out across targets (see [contract-template.md](contract-template.md#execute-matrix-task)).

````markdown
# Task: [PREFIX-###] — [Name]

**Created:** [YYYY-MM-DD]
**Size:** S
**Type:** execute

## Review Level: 0 (None)

**Risk:** [What the command touches; deterministic, no code authored]
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0

## Mission

[Closes #N | Partial #N] — Run `[script]` to produce `[artifact]` for [purpose].

## Dependencies

- **Task:** [PREFIX-###] ([LLM task that authored the script, when split])

## File Scope

- `[out/report.json]`

## Contract

| Field | Value |
|-------|-------|
| runCommand | `[sh scripts/collect.sh]` |
| testCommand | `[test -f out/report.json]` |
| fileScopeMustChange | `[out/report.json]` |

## Steps

### Step 0: Run command

- [ ] Engine runs Contract `runCommand`

### Step 1: Testing & Verification

- [ ] Contract `testCommand` passes (artifact exists)

## Completion Criteria

- [ ] `runCommand` exit 0 and Contract verified

## Do NOT

- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/` ([#149](https://github.com/beettlle/pi-spine/issues/149))
````

Keep `testCommand` cheap — it re-runs at contract verify. Omitting `runCommand` makes the engine run `testCommand` as the job **and** again at verify.

---

# STATUS.md Template

Create alongside PROMPT.md. If omitted, the execution engine may auto-generate
this from PROMPT.md.

````markdown
# [PREFIX-###]: [Name] — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** [YYYY-MM-DD]
**Review Level:** [0-2]
**Review Counter:** 0
**Iteration:** 0
**Size:** [S | M | L]

> **Hydration:** Checkboxes represent meaningful outcomes, not individual code
> changes. Workers expand steps when runtime discoveries warrant it — aim for
> 2-5 outcome-level items per step, not exhaustive implementation scripts.

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Required files and paths exist
- [ ] Dependencies satisfied

---

### Step 1: [Name]
**Status:** ⬜ Not Started

[If items are known at creation time, list each one:]
- [ ] [Specific item from PROMPT.md]
- [ ] [Specific item from PROMPT.md]

[If items depend on runtime discovery:]
> ⚠️ Hydrate: Expand checkboxes when entering this step based on [what]

- [ ] [High-level placeholder — worker will expand]

---

### Step [N-1]: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Contract `testCommand` passing (full suite runs at post-integrate `release:check`)
- [ ] Coverage gate passes (≥77% line coverage on in-scope code, when applicable)
- [ ] Integration tests (if applicable)
- [ ] All failures fixed

---

### Step [N]: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged

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
| [YYYY-MM-DD] | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
````
