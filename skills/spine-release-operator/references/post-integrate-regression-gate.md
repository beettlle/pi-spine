# Post-integrate regression gate

Operator-enforced full-suite check on `main` after each land loop. The spine CLI does **not** run this automatically — agents and humans must run it explicitly.

**Related:** manifest regression gate in [release-manifest-template.md](release-manifest-template.md); SP-560 / `detached-start-orphan-timeout.test.mjs` cross-file drift (v2.1.0).

---

## When required (blocking)

Run on current `main` after:

1. **Standard land loop** — `spine gate approve` → `spine integrate` → `npm install` → `spine batch complete`
2. **Manual integrate** — `git merge orch/*`, conflict resolution, `human_base_diverged` recovery, or `spine batch complete --detect-manual-merge`
3. **Before next wave** — do not start wave N+1 until gate passes on `main`
4. **Before first `git push origin main`** during a release cycle
5. **Before `npm version`** — Phase 5 `release:check` (same command; re-run if `main` moved)
6. **After gate green** — close GitHub `Closes #NNN` issues for tasks that just landed (spine-release-operator §4.3c); do not defer until publish

---

## Command

```bash
cd <repo-root>
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

Equivalent without `tee` (must capture exit code):

```bash
npm run release:check
echo "release:check exit: $?"
```

**If exit is non-zero:** STOP. Fix on `main`, commit, re-run gate. Do not start the next wave, push, or tag.

---

## Verification discipline

| Do | Do not |
|----|--------|
| Run full `npm run release:check` | Pipe through `tail` or `head` for pass/fail decisions |
| Verify exit code explicitly (`$?` or `${PIPESTATUS[0]}`) | Claim "passed" from truncated log tail |
| Save log path in manifest publish checklist | Assume scoped task `testCommand` covered full CI suite |

**Anti-pattern:** `npm run release:check 2>&1 | tail -20` — `tail` exits 0 even when `release:check` failed.

**Preferred in bash scripts:**

```bash
set -o pipefail
npm run release:check 2>&1 | tee /tmp/pi-spine-release-check.log
```

---

## Manual merge checklist

When any of these occurred on the current wave:

- [ ] `git merge orch/spine-*` into `main` (not only `spine integrate`)
- [ ] Merge conflict resolution in production or test files
- [ ] `spine batch complete --detect-manual-merge`
- [ ] Diagnosis `human_base_diverged` before integrate

Then post-integrate regression gate is **mandatory** before next wave or push. Record log path in manifest.

---

## Shared-module behavior changes

When production code changes user-visible strings, errors, or diagnosis headlines in modules consumed by multiple tests:

```bash
rg -l 'old phrase|OldErrorClass' tests/ src/
```

Every test file that asserts on the old behavior must either:

- Appear in the task's scoped `testCommand`, or
- Be covered by this post-integrate `release:check` on `main` before push

**Example (SP-560):** Changing orphan headlines in `src/batch/diagnosis*.mjs` required updating both `diagnosis-parent-exit.test.mjs` and `detached-start-orphan-timeout.test.mjs` — scoped contract on the new test alone was insufficient until full suite ran on `main`.

---

## Skills that reference this doc

| Skill | Section |
|-------|---------|
| `spine-release-operator` | Phase 4.3a |
| `spine-autonomous-operator` | Phase 3.3a |
| `spine-orchestrate-waves` | Per-wave outer loop |
| `create-spine-tasks` | Shared-module contract rule |
