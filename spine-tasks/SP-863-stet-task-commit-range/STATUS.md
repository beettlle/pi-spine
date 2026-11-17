# SP-863: stet task commit range — Status

**Current Step:** Complete
**Status:** ✅ Complete — final-review REVISE addressed, awaiting engine re-review
**Last Updated:** 2026-11-17
**Review Level:** 1
**Review Counter:** 1
**Iteration:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read the current baseline/first_task_commit/session-switch block; list exact lines that open `..HEAD` and that finish/restart sessions
- [x] `rg -n "spine-stet-contract-run|first_task_commit" tests/`

### Step 1: Bound range + preserve dismissals
**Status:** ✅ Complete

- [x] End range at last task-folder commit (not later siblings' HEAD)
- [x] Avoid dismissal-wiping session restart across task switches when baseline for this task is stable

### Step 2: Tests
**Status:** ✅ Complete

- [x] Fixture: earlier task re-review excludes later task commits/paths

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] Contract `testCommand` passing
- [x] All failures fixed

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries logged in STATUS.md
- [x] Create `.DONE`

### Completion Criteria

- [x] Retried task review range ends at the task's last folder commit, not sibling HEAD
- [x] Session handling no longer drops dismissals solely because a later lane task committed
- [x] Contract `testCommand` exits 0 (ran: lint + typecheck + 26 tests, exit 0)

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|
| 0 | plan | 0 | APPROVE | `.reviews/0-20261117T014019.md` |
| 1 | final | — | REVISE → addressed: fail-closed checkout + fixture test | `.reviews/final-20261117T014423.md` |

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| reviewCommand run on commit 230235a gated (exit 1) on a WARNING finding: the header comment said a failed range-bound checkout "falls back to unbounded HEAD", contradicting the fail-closed requirement | Fixed in the REVISE pass — behavior and comment now agree: a refused checkout exits 1 (fail closed), no unbounded fallback | `scripts/spine-stet-contract-run.sh` |
| stet v1.5.0 reviews `baseline..HEAD-at-run-time` (`Run` resolves live HEAD; `diff.Hunks(repoRoot, baselineRef, headRef)`); `stet start [ref]` accepts only a baseline — no end-ref flag exists | Script bounds the end itself: temporarily `git checkout --detach` at the task's last folder commit for the duration of the stet calls; lane HEAD restored via EXIT/INT/TERM trap; if checkout fails (e.g. dirty worktree) the script exits 1 — fail closed (final-review REVISE) rather than review an unbounded range that would attribute later siblings' commits to this task | `scripts/spine-stet-contract-run.sh` |
| Dismissal preservation: the computed baseline (parent of first task-folder commit) is HEAD-independent, so a sibling commit can no longer trigger finish/restart; when a genuine task switch finishes the session, stet ≥v1.4 restores recorded dismissals from `.review/history.jsonl` into the new session with line-shift remapping (verified in stet source: `cli/internal/run/restore_dismissals.go`; `stet dismiss` appends history immediately with ReviewOutput+DiffRef) | No spine-side dismissal archive needed; keep-session-on-stable-baseline invariant documented in the script header | `scripts/spine-stet-contract-run.sh` |
| End bound uses "last commit touching the task folder" as the proxy for the task's completion commit; a hypothetical code-only commit with no STATUS.md change would fall outside the range | Accepted — #373 proposes exactly this proxy, and pi-spine workers update STATUS.md at every step boundary, so step commits touch the folder | `scripts/spine-stet-contract-run.sh`, this STATUS |
| Added `SPINE_STET_PRINT_RANGE=1` debug mode: prints computed `lane_baseline`/`baseline`/`end`/`path:` lines and exits 0 without touching stet | Used by the new fixture test (`tests/scripts/spine-stet-contract-range.test.mjs`); also usable by operators to inspect a lane's review scope | `scripts/spine-stet-contract-run.sh` |
| `stet finish` on baseline mismatch now runs before the detach so the finished session's analytics note lands on the then-current HEAD; `stet start`/`run`/auto-finish run detached so their notes attribute to the task range | Intentional ordering change | `scripts/spine-stet-contract-run.sh` |
| `docs/stet-overview.md` checked per PROMPT "Check If Affected": no factual one-liner contradicted by the bounded range (runbook's task-scoped re-review description still accurate) | No doc edit required | `docs/stet-overview.md` |
| GitNexus `impact` on the script returned risk UNKNOWN (file node, no graph-resolvable callers); confirmed via text search that the script is only invoked as a shell `reviewCommand` — CLI args and exit codes unchanged, backward compatible | Pre-edit risk check satisfied (text-search confirmation per UNKNOWN protocol) | `scripts/spine-stet-contract-run.sh` |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-16 | Task staged | PROMPT.md created |
| 2026-11-16 | Step 0 preflight | Range opens at `first_task_commit` (line 72), baseline `parent(first)^` (line 74), session restart via `stet finish` (line 83); stet Run confirmed to diff `baseline..HEAD-at-run-time` |
| 2026-11-16 | Step 1 | Bounded range + detach/restore + session-keep invariant; existing 20 contract-run tests still pass; committed `e85f5535` |
| 2026-11-16 | Step 2 | New fixture `tests/scripts/spine-stet-contract-range.test.mjs` — 5/5 pass; committed `a738d5f7` |
| 2026-11-16 | Step 3 | Contract `testCommand` (lint + typecheck + 3 test files, worker env unset) exit 0; committed `58c61299` |
| 2026-11-16 | Step 4 | Discoveries logged; `.DONE` created |
| 2026-11-17 | Final review REVISE (`.reviews/final-20261117T014423.md`) | Checkout-failure path now exits 1 fail-closed; new fixture test "checkout failure fails closed" (6/6 range tests pass); contract `testCommand` rerun exit 0; `.DONE` recreated |

## Blockers

*None*
