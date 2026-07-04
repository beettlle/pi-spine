# Contract template (spine v2.0)

Add a `## Contract` section to every new `SP-*` task `PROMPT.md`. Place it after `## File Scope` and before `## Steps`. The contract defines **machine-verifiable proof** checked at final review — not merely worker assertion.

Normative schema: [PRD v2.0 implementation handoff §4](../../docs/PRD-v2.0-implementation-handoff.md#4--contract-normative-schema).

**Taskplane migrants (`TP-*`):** When `contract.legacyTaskIdPrefixes` includes `TP-`, legacy tasks skip contract validation. New `SP-*` tasks require a contract when `contract.mode` is `required` (pi-spine default).

---

## Authoring format

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/batch/review.mjs`, `bin/spine-tasks.mjs` |
| fileScopeMustNotChange | `src/planner/**` |
| minLineCoverage | 77 |
| artifactsMustExist | `tests/batch/final-verdict.test.mjs` |
```

**Path list formatting:** wrap each path in its own backticks. Do **not** put multiple comma-separated paths inside one pair:

```markdown
| fileScopeMustChange | `bin/a.mjs`, `bin/b.mjs` |
```

Avoid `` `bin/a.mjs,bin/b.mjs` `` — `tasks validate` warns (or errors in required mode) and the parser must recover for legacy packets.

---

## Field guidance

| Field | When to include | Value format |
|-------|-----------------|--------------|
| `testCommand` | **Required** for code tasks (Review Level ≥ 1, Size M/L, or implementation steps) | Shell command in backticks; max 500 chars; no newlines. Use `` `true` `` for docs-only S tasks with no code changes. When `` `true` ``, **always** pair with `fileScopeMustChange` (see below). |
| `fileScopeMustChange` | When you need proof specific paths were touched; **required** when `testCommand` is `` `true` `` | Comma-separated paths/globs relative to repo root; **one backtick per path** (not `` `a.mjs,b.mjs` ``). Trailing `/` means directory prefix match (e.g. `src/domain/types/` matches any file under that directory). For docs-only tasks, list at least one documentation deliverable path — without it, workers can pass contract by creating only `.DONE` (SP-214 batch `20260612T204048`, SP-457 batch `20260703T022335`). |
| `fileScopeMustNotChange` | When **parallel lanes** must not collide on product paths (see semantics below) | Comma-separated paths/globs relative to repo root; **one backtick per path** |
| `minLineCoverage` | When task changes application code | Integer 0–100 (pi-spine policy: **77**) |
| `artifactsMustExist` | When deliverables must exist on disk | Comma-separated file paths; **one backtick per path** |
| `stallTimeoutMinutes` | Long external jobs (operator matrix, CI arms) exceeding global/size stall budget | Positive integer minutes; engine uses `max(global, size floor, contract)` |
| `extendGraceOnFileScope` | STATUS-only progress during long external work | `true` or `false`; when `true`, file-scope mtime extends stall grace for this task |

Unknown field names produce **warnings** at validate time (not errors). Duplicate rows are errors.

---

## `fileScopeMustNotChange` semantics

**Parallel lanes only.** Use this field to guard product paths that **concurrent tasks on different lanes** must not edit in the same wave. It is **not** for isolating paths touched by **prior serialized tasks** on the same lane.

**How verify works today:** Final contract verify compares changed files on the lane branch against each pattern (currently `main...HEAD` cumulative diff until per-task scoping lands in SP-416). On a serialized lane, commits from earlier tasks remain in that diff — so `fileScopeMustNotChange` can fail even when the current worker behaved correctly.

**Planner overlap warning:** When `spine plan` reports:

```text
File scope overlaps (tasks serialized to the same lane):
  Wave N: SP-AAA ↔ SP-BBB
```

those tasks run **sequentially on one lane**, not in parallel. Do **not** rely on `fileScopeMustNotChange` to separate them; use distinct `fileScopeMustChange` paths or accept cumulative diff semantics until per-task verify ships. The overlap warning means **concurrency is already prevented** — `fileScopeMustNotChange` targets **different lanes** editing the same product path in the same wave.

### Never ban `spine-tasks/**`

Workers **must** update `STATUS.md`, create `.DONE`, and may write `.reviews/`. These orchestration artifacts are not product-code scope violations.

- **Never** list `spine-tasks/**` in `fileScopeMustNotChange`.
- **Never** list the **current task folder** (e.g. `spine-tasks/SP-410-*/**`) — it blocks required worker outputs.

**Good** (parallel collision guard on product paths):

```markdown
| fileScopeMustNotChange | `extension/**`, `.spine/**` |
```

**Bad** (blocks required worker artifacts — fails `contract.verified` even when implementation is correct):

```markdown
| fileScopeMustNotChange | `extension/**`, `.spine/**`, `spine-tasks/**` |
```

**Bad** (blocks current task's `STATUS.md` and `.DONE`):

```markdown
| fileScopeMustNotChange | `spine-tasks/SP-410-contract-template-parallel-semantics/**` |
```

Symptom in journal: `testCommand` passes but `fileScopeMustNotChange` fails with messages like `forbidden change spine-tasks/SP-001/STATUS.md` or `.DONE`.

---

## Examples

### Minimal S task (code change)

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm test -- tests/tasks/validate-cli.test.mjs` |
```

### M task with coverage gate

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run coverage:check` |
| fileScopeMustChange | `src/tasks/packet/validate-prompt.mjs` |
| minLineCoverage | 77 |
```

### Docs-only Review Level 0 (no application code)

When `testCommand` is `` `true` ``, **always** include `fileScopeMustChange` listing at least one documentation file the task must modify. Without it, workers can pass contract by creating only `.DONE` — two batches were rejected for this reason (SP-214 batch `20260612T204048`, SP-457 batch `20260703T022335`).

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
```

### Scope guard for parallel wave

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| fileScopeMustChange | `src/batch/review.mjs` |
| fileScopeMustNotChange | `src/planner/**`, `src/batch/journal.mjs` |
| artifactsMustExist | `tests/batch/final-verdict.test.mjs` |
```

### Operator matrix / long external job (SP-314)

Use when a task runs a multi-hour external matrix or CI arm with little in-repo checkpoint progress (only `STATUS.md` edits). Per-task override avoids raising global `lanes.stallTimeoutMinutes` for the whole batch.

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run typecheck && SPINE_WORKER_STUB=1 npm test` |
| stallTimeoutMinutes | 240 |
| extendGraceOnFileScope | true |
| fileScopeMustChange | `spine-tasks/SP-029-*/STATUS.md` |
```

Recommended: **240** minutes for jobs expected to run 2+ hours. Size S floor (90m) and global default (120m) are additive floors; contract value wins when higher.

---

## Cross-model authoring (worker ≠ reviewer)

When the worker model differs from the reviewer model (e.g. worker `cursor/auto`, reviewer `google/gemini-3.1-pro-preview`), contract shape directly affects review outcomes. The most common cross-model failure is `review_exhausted` caused by broad `testCommand` or missing context — not reviewer rejection of code quality.

### Scoped `testCommand`

Lane worktrees are **not** identical to the developer checkout. Worktree setup hooks, missing assets, pre-existing test failures, and Flutter/monorepo full-suite pollution can cause a scoped worker to pass targeted tests while the unscoped `testCommand` in Contract fails at final verify.

| Avoid | Prefer |
|-------|--------|
| `` `flutter test` `` / `` `npm test` `` (full suite in lane worktree) | Targeted command matching the Testing step: `` `flutter test test/unit/services/foo_test.dart` `` |
| Same command in Contract and global `testing.test` without verifying lane compatibility | Document when to use `` `true` `` (docs-only) vs scoped shell proof |
| Unscoped command producing >10 MB stdout (SP-426 `maxBuffer`) | Narrow test scope; prefer `npm test -- tests/feature.test.mjs` |

**Engine-side lane fixes:** [#78](https://github.com/beettlle/pi-spine/issues/78), [#80](https://github.com/beettlle/pi-spine/issues/80) track worktree setup hook and analyzer hygiene — docs alone cannot fix lane environment drift.

### Self-contained PROMPT for independent reviewers

Reviewers spawn as **fresh sessions** with no memory of the worker session (FR-REV-04). Cross-model reviewers receive:

| Worker sees | Reviewer sees |
|-------------|---------------|
| `taskplane-worker-cursor.mdc`, glob-matched language standards | Bounded rule subset via `profile.reviewer.*` (FR-REV-08); worker/authoring rules excluded |
| `referenceDocs` (e.g. `docs/constitution.md`) | **Not** auto-loaded; 16 KiB rule cap |
| Full PROMPT + STATUS in session, accumulated context | Fresh spawn; review request + diff + Contract only |

**Authoring implication:** Place acceptance criteria, spec references, and "done means" in PROMPT `## Mission`, `## Contract`, and step checkboxes — do not assume the reviewer read `IMPLEMENTATION.md`, domain plans, or `referenceDocs` unless quoted verbatim in PROMPT.

### `testCommand` decision table

| Task type | Recommended `testCommand` |
|-----------|---------------------------|
| Docs-only, no code changes | `` `true` `` **and** `fileScopeMustChange` with at least one deliverable doc path |
| Single module, targeted tests exist | `` `npm test -- tests/feature.test.mjs` `` or `` `flutter test test/unit/services/foo_test.dart` `` |
| Full-suite safe in lane worktree | `` `npm run typecheck && SPINE_WORKER_STUB=1 npm test` `` |
| Coverage gate required (pi-spine ≥77%) | `` `npm run coverage:check` `` |
| Long external job (>2h) | Scoped command + `stallTimeoutMinutes` and `extendGraceOnFileScope` in Contract (see SP-314 example above) |

---

## Validate before plan

After authoring packets, run:

```bash
spine tasks validate pending
```

Fix contract and PROMPT errors before `spine plan pending` or `spine batch start`.
