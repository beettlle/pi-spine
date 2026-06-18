# PROMPT.md Template (spine)

Copy this template when creating a new task. Replace all `[bracketed]` fields.

**Before creating:** Verify you have scored complexity and assigned Review Level.
Review Level 0 is ONLY for trivial changes. Most M+ tasks need Level ≥1.

---

````markdown
# Task: [PREFIX-###] — [Name]

**Created:** [YYYY-MM-DD]
**Size:** [S | M | L]

## Review Level: [0-3] ([None | Plan Only | Plan and Code | Full])

**Assessment:** [1-2 sentences explaining the score]
**Score:** [N]/8 — Blast radius: [N], Pattern novelty: [N], Security: [N], Reversibility: [N]

> **Real-pi batches (SP-195/SP-278):** Do **not** add per-step "Call `spine_review_step`" checkboxes for Review Level ≥ 1. The batch engine runs plan, code, and final reviews after worker `.DONE`. Stub batches (`SPINE_WORKER_STUB=1`) may still use in-worker stub plan review via the tool when a checkpoint marker requires it.

## Canonical Task Folder

```
[FULL_PATH_TO_TASK_FOLDER]/
├── PROMPT.md   ← This file (immutable above --- divider)
├── STATUS.md   ← Execution state (worker updates this)
├── .reviews/   ← Reviewer output (created by the orchestrator runtime)
└── .DONE       ← Created when complete
```

## Mission

[One paragraph: what you're building and why it matters]

## Dependencies

[Choose one:]

- **None**

[OR:]

- **Task:** [PREFIX-###] ([what must be complete])
- **Task:** [area-name/PREFIX-###] ([use area-qualified form if cross-area ID may be ambiguous])
- **External:** [what must be true]

## Context to Read First

> Only list docs the worker actually needs. Less is better.

**Tier 2 (area context):**
- `[path/to/CONTEXT.md]`

**Tier 3 (load only if needed):**
- `[path/to/specific-doc.md]` — [why needed]

## Environment

- **Workspace:** [primary folder/service being modified]
- **Services required:** [list, or "None"]

## File Scope

> The orchestrator uses this to avoid merge conflicts: tasks with overlapping
> file scope run on the same lane (serial), not in parallel. List the files and
> directories this task will create or modify. Use wildcards for directories.

- `[path/to/file.ext]`
- `[path/to/directory/*]`

## Contract

> **Required for new `SP-*` tasks** when `contract.mode` is `required` (pi-spine default).
> Defines machine-verifiable proof checked at final review. See
> [references/contract-template.md](contract-template.md) for field guidance and examples.
> Taskplane legacy `TP-*` tasks may omit this section when listed in `contract.legacyTaskIdPrefixes`.

| Field | Value |
|-------|-------|
| testCommand | `[shell command in backticks, or \`true\` for docs-only S tasks]` |
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
- [ ] Run targeted tests: `[test command] --changed` or specific test files

**Artifacts:**
- `path/to/file` (new | modified)

### Step [N-1]: Testing & Verification

> **Required for every task** — including docs-only and Review Level 0 packets.
> ZERO test failures allowed. This step runs the FULL test suite as a quality gate.
> (Earlier steps should use targeted tests for fast feedback — see worker prompt.)
>
> **Docs-only tasks:** keep this step; run the full test suite. Omit the coverage-gate
> checkbox below when the task does not change application code.

- [ ] Run FULL test suite: `[test command from project config]`
- [ ] Run coverage gate: `[testWithCoverage command, e.g. npm run coverage:check]` — **≥77% line coverage** on in-scope changed code (code-related tasks only; omit for docs-only)
- [ ] Run integration tests (if applicable)
- [ ] Fix all failures
- [ ] Build passes: `[build command]`

### Step [N]: Documentation & Delivery

- [ ] "Must Update" docs modified
- [ ] "Check If Affected" docs reviewed
- [ ] Discoveries logged in STATUS.md

## Documentation Requirements

**Must Update:**
- `[path/to/doc.md]` — [what to add/change]

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

---

## Amendments (Added During Execution)

<!-- Workers add amendments here if issues discovered during execution.
     Format:
     ### Amendment N — YYYY-MM-DD HH:MM
     **Issue:** [what was wrong]
     **Resolution:** [what was changed] -->
````

---

# STATUS.md Template

Create alongside PROMPT.md. If omitted, the execution engine may auto-generate
this from PROMPT.md.

````markdown
# [PREFIX-###]: [Name] — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** [YYYY-MM-DD]
**Review Level:** [0-3]
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

- [ ] FULL test suite passing
- [ ] Coverage gate passes (≥77% line coverage on in-scope code, when applicable)
- [ ] Integration tests (if applicable)
- [ ] All failures fixed
- [ ] Build passes

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
