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

---

## Field guidance

| Field | When to include | Value format |
|-------|-----------------|--------------|
| `testCommand` | **Required** for code tasks (Review Level ≥ 1, Size M/L, or implementation steps) | Shell command in backticks; max 500 chars; no newlines. Use `` `true` `` for docs-only S tasks with no code changes. |
| `fileScopeMustChange` | When you need proof specific paths were touched | Comma-separated paths/globs relative to repo root |
| `fileScopeMustNotChange` | When parallel tasks must not collide | Comma-separated paths/globs |
| `minLineCoverage` | When task changes application code | Integer 0–100 (pi-spine policy: **77**) |
| `artifactsMustExist` | When deliverables must exist on disk | Comma-separated file paths |

Unknown field names produce **warnings** at validate time (not errors). Duplicate rows are errors.

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

```markdown
## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
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

---

## Validate before plan

After authoring packets, run:

```bash
spine tasks validate pending
```

Fix contract and PROMPT errors before `spine plan pending` or `spine batch start`.
