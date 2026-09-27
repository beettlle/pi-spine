# Task: SP-789 — Runbook: v2.25.0 recovery-evidence hardening

**Created:** 2026-09-27
**Size:** S

## Review Level: 0 (None)

**Risk:** Docs only.
**Score:** 0/8 — Blast radius: 0, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** v2.25.0 changes what operators see when recovery evidence is damaged or integrate is unsafe: torn journal lines are reported instead of crashing status, corrupt batch-state is quarantined and start refuses, integrate can fail with `BaseMoved` or succeed with a `DirtyOverlap` warning, and matrix rows can be refused or time out. The operator runbook must say what each signal means and what to run.

## Mission

Document the new operator-visible behaviors from SP-780, SP-782/SP-784, SP-781/SP-783, and SP-786 in `docs/adoption/operator-runbook.md`. Read the landed code on `main` for exact names and messages — do not invent fields.

1. New section **"v2.25.0 recovery-evidence hardening (#296–#303)"** in §6 (near "Resume engine crash (fail-closed)"), with one short subsection each:
   - **Torn journal lines** — `signals.journalCorruptLines` in `spine status --diagnose` (count + line/byte offsets); reads skip the bad line; new appends start on a fresh line; nothing is rewritten. What to inspect.
   - **Corrupt batch-state quarantine** — file renamed to `batch-state.corrupt-<ts>.json`; `spine batch start` refuses even with `--skip-preflight`; recovery: inspect the file and journal, `spine status --diagnose`, then `spine batch dismiss --force`. `.pi/batch-state.json` is never modified by spine.
   - **Engine crash** — `engine.crashed` journal event; batch marked `failed` (SP-788 — describe only if landed on `main`; otherwise omit).
2. §4 Land loop — add **"Integrate base moved / dirty overlap (#298)"**: `BaseMoved` means base changed mid-integrate, nothing orphaned, re-run `spine integrate`; `DirtyOverlap` warning lists paths whose local edits were kept, and how to reconcile them. State that integrate never syncs files into a checkout that is not on base.
3. §2.4 Matrix tasks — add a short note: row values with `$`, backticks, `;`, `|`, `||`, or lone `&` fail the row before spawn; row commands time out after 10 minutes by default (`SPINE_MATRIX_ROW_TIMEOUT_MS` overrides) with exit 124; row output kept in memory is capped.

## Dependencies

- **Task:** SP-780 (journal corrupt-line signal)
- **Task:** SP-783 (matrix row timeout and env override)
- **Task:** SP-784 (integrate `BaseMoved` / `DirtyOverlap`)
- **Task:** SP-786 (batch-state quarantine)

## Context to Read First

- `docs/adoption/operator-runbook.md` — §2.4 (~line 263), §4 (~line 967), §6 (~line 1369), "Resume engine crash (fail-closed)" (~line 1776)
- Landed code on `main`: `src/batch/journal.mjs`, `src/batch/reconcile-batch.mjs`, `src/batch/batch-state-io.mjs`, `src/batch/state.mjs`, `src/batch/integrate.mjs`, `src/batch/integrate-worktree.mjs`, `src/batch/engine-lanes/matrix.mjs`, `src/batch/engine-lanes/matrix-run.mjs`, `src/batch/engine-crash-guard.mjs` (if present)
- GitHub #296, #297, #298, #303, #306

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** None

## File Scope

- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `true` |
| fileScopeMustChange | `docs/adoption/operator-runbook.md` |
| fileScopeMustNotChange | `src/**`, `bin/**` |

## Steps

### Step 0: Preflight

- [ ] Confirm SP-780, SP-783, SP-784, SP-786 are `.DONE` on `main`
- [ ] `rg -n "journalCorruptLines|batch-state.corrupt|BaseMoved|DirtyOverlap|dirty_overlap|SPINE_MATRIX_ROW_TIMEOUT_MS|engine.crashed" src` — capture exact names/messages
- [ ] Dependencies satisfied

### Step 1: Runbook sections

- [ ] §6 recovery-evidence section (journal, quarantine, engine crash if landed)
- [ ] §4 BaseMoved / DirtyOverlap subsection
- [ ] §2.4 matrix row guard + timeout note
- [ ] Every name/message matches the code

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 2: Testing & Verification

- [ ] Run Contract `testCommand` (`true`)
- [ ] Run docs/adoption tests: `env -u SPINE_IS_WORKER -u SPINE_WORKER_RUNNER SPINE_WORKER_STUB=1 node --experimental-strip-types --test tests/adoption/*.test.mjs`
- [ ] Fix all failures

### Step 3: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md`

**Check If Affected:**
- `README.md` — only if it lists recovery commands that changed

## Completion Criteria

- [ ] Operators can map each new signal/message to a recovery command
- [ ] Docs match landed code names exactly

## Git Commit Convention

- `docs(SP-789): runbook for v2.25.0 recovery-evidence hardening`

## Do NOT

- Edit `src/**`, `bin/**`, or `tests/**`
- Document behavior that is not on `main`
- Modify `.spine/`, `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

_None._
