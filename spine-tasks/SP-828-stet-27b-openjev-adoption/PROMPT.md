# Task: SP-828 — Stet contract review on qwen3.8-27b with the OpenJev critic

**Created:** 2026-10-11
**Size:** S

## Review Level: 1 (Plan Only)

**Risk:** `scripts/spine-stet-contract-run.sh` ends the Contract `testCommand` of every stet-gated packet, and `scripts/spine-worktree-setup.sh` runs before every worker. A wrong exit code either blocks every stet-gated task or lets findings through unreviewed.
**Score:** 2/8 — Blast radius: 2, Pattern novelty: 0, Security: 0, Reversibility: 0
**Problem theory:** The stet integration is still the v1.5.0 bootstrap (SP-494). `.review/config.toml` pins `qwen/qwen3-coder-next`, which does not fit in memory next to OpenJev, and has no critic. The stet repo replaced it with `qwen/qwen3.8-27b` plus the System One critic on local OpenJev (stet SP-039, `docs/research/model-comparison-qwen3-coder-next-vs-qwen3.8-27b.md`) and fixed both spine scripts while dogfooding (stet SP-035–SP-040). `scripts/spine-stet-contract-run.sh` reads the finding count from `stet status`, which also counts dismissed findings, so a contract that found anything stays red after triage. It also runs `stet finish` after a failed `stet run`. `scripts/spine-worktree-setup.sh` fails when `stet` is not on `PATH` and parses `.review/session.json` with `node -e`. `.gitignore` ignores only three `.review/` files, and an accidental gitlink `.review/worktrees/stet-0ca229b1c13e` (mode 160000) is tracked.

## Mission

Stet-gated contracts review the task diff with `qwen/qwen3.8-27b` and the OpenJev critic, pass once every finding is fixed or dismissed, and fail loudly when stet itself fails.

1. **Config** (`.review/config.toml`): match the stet repo's `.review/config.toml` (`/Users/cdelgado/Documents/github/stet/.review/config.toml`, or https://github.com/beettlle/stet/blob/main/.review/config.toml):
   - `provider = "openai"`, `model = "qwen/qwen3.8-27b"`, `openai_base_url = "http://127.0.0.1:1234/v1"`; keep `num_ctx`/`context_limit` 65536 and `max_completion_tokens` 4096.
   - Critic: `critic_enabled = true`, `critic_backend = "systemone"`, `systemone_base_url = "http://127.0.0.1:8080"`, `systemone_model = "openjev-latest"`, `systemone_timeout = "90s"`.
   - `rules_selector = false`, `rules_annotate = false`.
   - Add `"*.jsonl"` and `"*.sum"` to `exclude_patterns`.
   - Short comments: the LM Studio preset for the 27B model must have Enable Thinking off; OpenJev must be running (set `STET_CRITIC_ENABLED=false` otherwise); secrets stay env-only (`STET_SYSTEMONE_API_KEY`).
2. **Contract script** (`scripts/spine-stet-contract-run.sh`): port the stet repo's `scripts/spine-stet-contract-run.sh`:
   - Reject any strictness other than `lenient|default|strict` with exit 2.
   - Keep the session restore from `.review/spine-stet-baseline.ref`.
   - When `stet run` exits non-zero, print a hint (`stet doctor`; LM Studio and OpenJev up) and exit with that code; do not call `stet finish`.
   - Count active findings as the non-empty lines of `stet list`; a failing `stet list` exits 1.
   - Keep `SPINE_STET_NO_AUTO_FINISH=1` and the zero-finding `stet finish`.
   - Keep pi-spine's triage text: `stet list`, `stet dismiss <id> <reason>`, the four reasons, `docs/adoption/operator-runbook.md` §8.1, project defects → beettlle/pi-spine issues labeled `stet`, stet reviewer bugs → STATUS Discoveries and https://github.com/beettlle/stet/issues.
3. **Setup hook** (`scripts/spine-worktree-setup.sh`): port the stet repo's `scripts/spine-worktree-setup.sh`: print `{"ok":true,"skipped":"stet not on PATH"}` and exit 0 when `stet` is missing; otherwise take the baseline from `git rev-parse HEAD`, run `stet start "$baseline" --allow-dirty --quiet >&2`, write the baseline to `.review/spine-stet-baseline.ref`, and print `{"ok":true}`. No `node -e`.
4. **Hygiene and docs:**
   - `.gitignore`: replace the three `.review/` lines with `.review/*` and `!.review/config.toml`.
   - `git rm --cached .review/worktrees/stet-0ca229b1c13e` (accidental gitlink; do not delete the local directory contents beyond what `git rm --cached` does).
   - `docs/adoption/operator-runbook.md` §8.1: model and env exports (`STET_MODEL=qwen/qwen3.8-27b`), OpenJev prerequisite and the `STET_CRITIC_ENABLED=false` fallback, contract behavior (active findings from `stet list`; `stet run` failure fails the contract; zero findings run `stet finish`), remove the claim that the contract uses `--auto-finish-zero`, level guidance (S low-risk → `lenient` or none; M → `default`; review/gate/security code → `default` or `strict`), and the known hazards below.
   - In the same section, change `SPINE_STET_NO_AUTO_FINISH=1` from optional to **required for spine batches**: export it before `spine batch start` / `resume`. Reasons: the engine re-runs the Contract at final review (`contract.verified`), and `worktreeSetupHook` opens the session once per lane, not once per task. Without it, the worker's passing run calls `stet finish`, and the engine's re-run (or the next task on the same lane) starts a fresh full review from the lane baseline. That review can resurface dismissed findings and include earlier tasks' diffs. Keep auto-finish as the default for manual, one-off contract runs.

**Known hazards to document (from stet dogfooding):**

- `stet finish` clears the session. Re-running a contract after it passed starts a fresh review that can resurface dismissed findings.
- On diffs that add a new file, the reviewer can report syntax or indentation defects that lint/typecheck/tests disprove. Tool output beats reviewer claims; dismiss with that evidence.
- The Contract `testCommand` wall clock is 10 minutes. A first stet review of a small diff takes about 3–5 minutes with the critic; re-runs after dismissals are incremental.

## Dependencies

- **None**

## Context to Read First

- `/Users/cdelgado/Documents/github/stet/scripts/spine-stet-contract-run.sh` and `/Users/cdelgado/Documents/github/stet/scripts/spine-worktree-setup.sh` (reference implementations)
- `/Users/cdelgado/Documents/github/stet/.review/config.toml`
- `/Users/cdelgado/Documents/github/stet/spine-tasks/CONTEXT.md` — "Stet in spine (dogfooding)" section
- `scripts/spine-stet-contract-run.sh`, `scripts/spine-worktree-setup.sh`, `.review/config.toml`, `.gitignore` (~lines 50-56)
- `tests/scripts/spine-stet-contract-run.test.mjs`; `tests/batch/worktree-setup-hook.test.mjs`; `tests/batch/dirty-worktree-symlink.test.mjs`
- `docs/adoption/operator-runbook.md` §8.1 (~lines 2188-2250)

## Environment

- **Workspace:** pi-spine repo root
- **Services required:** LM Studio at `http://127.0.0.1:1234` with `qwen/qwen3.8-27b` loaded (Enable Thinking off) and OpenJev System One at `http://127.0.0.1:8080`, for the stet step of the Contract only. Unit tests use a mock `stet`.
- **Tests:** the Contract `testCommand` (scoped; post-integrate `release:check` runs the full suite); run with `SPINE_IS_WORKER` / `SPINE_WORKER_RUNNER` unset

## File Scope

- `.review/config.toml`
- `.review/worktrees/stet-0ca229b1c13e` (index removal only)
- `.gitignore`
- `scripts/spine-stet-contract-run.sh`
- `scripts/spine-worktree-setup.sh`
- `tests/scripts/spine-stet-contract-run.test.mjs`
- `docs/adoption/operator-runbook.md`

## Contract

| Field | Value |
|-------|-------|
| testCommand | `npm run lint && npm run typecheck && SPINE_WORKER_STUB=1 node --experimental-strip-types --test --test-reporter=dot tests/scripts/spine-stet-contract-run.test.mjs tests/batch/worktree-setup-hook.test.mjs tests/batch/dirty-worktree-symlink.test.mjs && bash scripts/spine-stet-contract-run.sh lenient` |
| fileScopeMustChange | `.review/config.toml`, `scripts/spine-stet-contract-run.sh`, `scripts/spine-worktree-setup.sh`, `tests/scripts/spine-stet-contract-run.test.mjs` |
| fileScopeMustNotChange | `.spine/**`, `src/**` |
| completionCriteria | Mock-stet tests cover dismissed findings, `stet run` failure, and invalid strictness; the setup hook skips cleanly without stet; the stet review of this diff exits 0 after triage; `git ls-files -s .review` lists only `.review/config.toml` (mode 100644) |

## Steps

### Step 0: Preflight

- [ ] `stet doctor` from the repo root (paste the model and System One lines into Discoveries; if OpenJev is down, record it as a blocker)
- [ ] `rg -n 'spine-stet-contract-run|spine-worktree-setup|spine-stet-baseline' src bin tests scripts` — record every caller in Discoveries; any outside File Scope that asserts script output is a blocker
- [ ] Dependencies satisfied

### Step 1: Config and hygiene

- [ ] `.review/config.toml` matches Mission item 1
- [ ] `.gitignore` uses `.review/*` + `!.review/config.toml`
- [ ] Gitlink removed from the index

**Artifacts:**
- `.review/config.toml` (modified)
- `.gitignore` (modified)

### Step 2: Scripts

- [ ] Contract script ported (Mission item 2)
- [ ] Setup hook ported (Mission item 3)

**Artifacts:**
- `scripts/spine-stet-contract-run.sh` (modified)
- `scripts/spine-worktree-setup.sh` (modified)

### Step 3: Tests

- [ ] Mock `stet` answers `list` with one line per active finding and supports a dismissed count that `status` reports but `list` omits
- [ ] Existing cases still pass (zero findings finish, non-zero findings fail with triage text, `SPINE_STET_NO_AUTO_FINISH=1`, baseline restore, missing baseline)
- [ ] New cases: dismissed-only findings pass and finish; `run` exit 3 → contract exits 3 and `finish` not called; `stet list` failure → exit 1; strictness `bogus` → exit 2

**Artifacts:**
- `tests/scripts/spine-stet-contract-run.test.mjs` (modified)

### Step 4: Docs

- [ ] Runbook §8.1 updated (Mission item 4 and Known hazards)

**Artifacts:**
- `docs/adoption/operator-runbook.md` (modified)

### Step 5: Testing & Verification

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (includes the stet review of this diff; triage findings per the new triage text)
- [ ] `git status --porcelain .review` shows only `config.toml` and the gitlink deletion (paste into Discoveries)
- [ ] After committing, `git ls-files -s .review` lists only `.review/config.toml` with mode `100644` (paste into Discoveries)
- [ ] Fix all failures

### Step 6: Documentation & Delivery

- [ ] Discoveries logged in STATUS.md
- [ ] Create `.DONE`

## Documentation Requirements

**Must Update:**
- `docs/adoption/operator-runbook.md` §8.1

**Check If Affected:**
- `docs/stet-overview.md` (record needed edits in Discoveries; out of File Scope)

## Completion Criteria

- [ ] `.review/config.toml` uses `qwen/qwen3.8-27b` with the System One critic
- [ ] Dismissing every finding turns the contract green
- [ ] A `stet run` failure fails the contract without finishing the session
- [ ] The setup hook exits 0 without stet on `PATH`
- [ ] No tracked gitlink under `.review/`: `git ls-files -s .review` lists only `.review/config.toml` (mode `100644`)
- [ ] Runbook §8.1 says `SPINE_STET_NO_AUTO_FINISH=1` is required for spine batches

## Git Commit Convention

- `fix(SP-828): stet contract counts active findings; 27B + OpenJev review config`

## Do NOT

- Change `src/**`, the engine's `worktreeSetupHook` handling, or anything under `.spine/`
- Commit secrets or API keys to `.review/config.toml`
- Dismiss a real defect to pass the Contract
- Run `git add -A` or `git add .` while `.review/worktrees/` exists (that is how the stet review worktree got committed as a gitlink); stage File Scope paths explicitly
- Modify `AGENTS.md`, `CLAUDE.md`, or `.gitnexus/`

## Amendments

- **2026-10-14 (operator, packet audit):** Mission item 4 makes `SPINE_STET_NO_AUTO_FINISH=1` required for spine batches (engine re-runs the Contract at final review; the setup hook runs once per lane). Removed the coverage gate (#342: S packets use scoped tests; `release:check` owns coverage). Added `--test-reporter=dot`, the `git ls-files -s .review` completion check, and the `git add -A` prohibition.
