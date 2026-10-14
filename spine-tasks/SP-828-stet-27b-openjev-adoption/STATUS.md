# SP-828: Stet contract review on qwen3.8-27b with the OpenJev critic — Status

**Current Step:** Step 5: Testing & Verification
**Status:** 🔄 In Progress
**Last Updated:** 2026-10-14
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] `stet doctor` recorded
- [x] Script callers recorded
- [x] Dependencies satisfied

### Step 1: Config and hygiene
**Status:** ✅ Complete

- [x] Review config
- [x] `.gitignore`
- [x] Gitlink removed

### Step 2: Scripts
**Status:** ✅ Complete

- [x] Contract script
- [x] Setup hook

### Step 3: Tests
**Status:** ✅ Complete

- [x] Mock `list` + dismissed count
- [x] Existing cases pass
- [x] New cases

Note: the suite strips inherited `SPINE_STET_NO_AUTO_FINISH` / `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` from the child env — spine worker sessions export `SPINE_STET_NO_AUTO_FINISH=1`, which leaked into the first run and (correctly) suppressed finish.

### Step 4: Docs
**Status:** ✅ Complete

- [x] Runbook §8.1 (incl. `SPINE_STET_NO_AUTO_FINISH=1` required for batches)

### Step 5: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Lint
- [ ] Contract `testCommand`
- [ ] `.review` status clean
- [ ] `git ls-files -s .review` lists only `config.toml` (100644)
- [ ] Fix all failures

### Step 6: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

---

## Discoveries

| # | Finding |
|---|---------|
| 1 | `stet doctor` exit 0: `OpenAI-compatible API OK` / `Model: qwen/qwen3-coder-next` (doctor prints no System One line). OpenJev verified directly: `GET http://127.0.0.1:8080/v1/models` → `openjev-latest` (openjev-0.1) available. LM Studio `/v1/models` lists `qwen/qwen3.8-27b`; a 1-token chat completion probe against it succeeded (JIT load works). Services are up — not a blocker. |
| 2 | Callers of the two scripts: `tests/scripts/spine-stet-contract-run.test.mjs` (runs the real contract script with a mock `stet`; in File Scope). `tests/batch/worktree-setup-hook.test.mjs` and `tests/batch/dirty-worktree-symlink.test.mjs` write their **own** hook bodies; they only reuse the real path string. `tests/doctor/worktree-health.test.mjs` + `tests/batch/matrix-execution.test.mjs` reference the hook path string only. `tests/batch/merge-gitignored-paths.test.mjs` + `tests/batch/gitignored-auto-clean.test.mjs` use `.review/...` strings inside temp fixtures — independent of the real `.gitignore`. No outside-scope caller asserts script output — not a blocker. |
| 3 | Engine (`src/batch/lane-dirty-check.mjs`, `src/batch/lane-dirty-check-commit.mjs`) matches `.review/` as a gitignored-artifact marker by prefix, independent of the real `.gitignore` — switching to `.review/*` + `!.review/config.toml` is safe. Repo `.spine/spine-config.json` has `gitignoredPaths: []`. |
| 4 | Lane worktree has a live stet session: `.review/session.json` + `.review/spine-stet-baseline.ref` = `bdf7f6f5` (pre-worker HEAD), so the Step 5 contract review covers this task's diff. |
| 5 | `docs/stet-overview.md` (out of File Scope) needs edits: line 52 claims the v1.5.0 contract path uses `--auto-finish-zero`; lines 78/81/197–203 show example testCommands with `--auto-finish-zero`; no model name there, but examples should mirror the new ported-contract behavior. Recorded for a follow-up docs packet. |

## Blockers

_None._
