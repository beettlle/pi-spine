# v2.0.0 automation proof — operator signoff checklist

Operator attestation checklist for **gates-only** proof per [PRD §8](../PRD-v2.0.0-automation-proof-handoff.md#8-gates-only-exit-criteria-definition-of-done) (FR-STA-33). Check every box before `npm version minor` → v2.0.0 tag.

**Proof manifest:** [`manifest-v2.0.0-proof.md`](manifest-v2.0.0-proof.md) (SP-543)  
**Prerequisite gate:** [`../../scripts/release-proof-gate.sh`](../../scripts/release-proof-gate.sh) (SP-545) — run before proof sequence; exits non-zero on blocking failures.  
**Recovery (should not be needed):** [Operator runbook §4](../adoption/operator-runbook.md) — manual `pause`, `retry`, or `resume --force` during waves **voids** gates-only proof.

---

## Session metadata

| Field | Value |
|-------|-------|
| Operator | |
| Proof start (UTC) | |
| Proof end (UTC) | |
| Batch ID | |
| Sequence command | `spine run sequence <manifest-scope> --auto-approve-gate --detached` |
| Manifest scope ID | |

---

## M-AUTO-01 — Gates-only execution (operator attestation)

Human actions during proof waves must be limited to **`spine gate approve`** (per wave) and **explicit publish approval** at Phase 6. No manual batch recovery.

- [ ] **One session:** Operator started a **single** autonomous or sequence-driven release session (no restart mid-proof)
- [ ] **Zero manual recovery:** No `spine batch pause`, `spine batch retry`, or `spine batch resume --force` during waves
- [ ] **Gate-only human touch:** Human actions limited to `spine gate approve` + explicit publish approval
- [ ] **Journal clean:** Exported journal shows no manual recovery events (see verification below)

### Verification commands

Record batch ID from `spine status --diagnose` or sequence start output.

```bash
# Before starting proof — regression gate (doctor, preflight, gitnexus, manifest)
./scripts/release-proof-gate.sh

# Before starting proof — record baseline issue count (M-AUTO-02)
gh issue list --state open --json number | jq 'length'

# After waves complete — confirm no manual recovery in journal
spine journal export --batch <batchId> --format markdown --output /tmp/proof-journal.md
grep -E 'batch\.(pause|retry)|resume.*--force' /tmp/proof-journal.md && echo "FAIL: manual recovery detected" || echo "OK: no manual recovery"
```

**Operator attestation (sign):**

> I confirm the proof ran gates-only: one sequence session, zero manual pause/retry/resume --force, and human actions were limited to gate approve + publish approval.

| Operator | Date (UTC) |
|----------|------------|
| | |

---

## M-AUTO-02 — Open-issue delta (negative)

Open GitHub issues must **decrease** vs proof start count.

### Issue delta table

Fill before proof start and after sign-off. Commit this table (or equivalent) in the post-mortem artifact.

| When | Open issue count | Command output |
|------|------------------|----------------|
| Proof start | | `gh issue list --state open --json number \| jq length` |
| Proof end (pre-tag) | | same |
| **Delta** | | end − start (must be **negative**) |

- [ ] Delta is negative (fewer open issues than at proof start)

```bash
gh issue list --state open --json number,title --limit 500
```

---

## M-AUTO-03 — `release:check` green (Phase 5 gate)

Blocking pre-publish gate per [release-operator Phase 5](../../skills/spine-release-operator/SKILL.md#phase-5--pre-publish-verification-stop). Must exit **0** on current `main` before tag.

- [ ] `npm run release:check` exited **0** (typecheck → lint → tests → coverage)
- [ ] CI workflow green on current `HEAD` (parity with `ci.yml`)

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-release-check.log
echo "exit: $?"

COMMIT=$(git rev-parse HEAD)
gh run list --workflow ci.yml --commit "$COMMIT" --json databaseId,conclusion,status --limit 5
```

| Check | Exit code / conclusion | Log path |
|-------|------------------------|----------|
| `release:check` | | `/tmp/pi-spine-release-check.log` |
| CI on `HEAD` | | `gh run watch --exit-status <run-id>` if in progress |

---

## M-AUTO-04 — Manifest scope complete

All manifest-scoped tasks `.DONE` on `main`; plan shows zero pending for scope.

- [ ] All manifest-scoped tasks have `.DONE` on `main`
- [ ] `spine plan <manifest-scope>` shows **0** pending

```bash
# Replace <manifest-scope> with scope from manifest-v2.0.0-proof.md
spine plan <manifest-scope>
spine preflight
git status   # clean tree before tag
```

| Task ID | `.DONE` on main | Notes |
|---------|-----------------|-------|
| | | |
| | | |

---

## Post-mortem committed

Per PRD §8 and FR-STA-32: journal export + issue delta table committed to repo (path recorded in manifest or release notes).

- [ ] Journal export committed (markdown or jsonl)
- [ ] Issue delta table committed (section above or manifest publish checklist)
- [ ] Batch post-mortem / evidence summary path recorded

```bash
spine journal export --batch <batchId> --format markdown --output docs/release/proof-v2.0.0-journal.md
# Or jsonl for machine replay:
spine journal export --batch <batchId> --format jsonl --output docs/release/proof-v2.0.0-journal.jsonl
```

---

## CONTEXT Phase 62 complete

- [ ] `spine-tasks/CONTEXT.md` Phase 62 table updated (SP-551)
- [ ] PRD §8 exit criteria reflected in CONTEXT per operator attestation

---

## Publish approval (Phase 6 — after all boxes above)

Per [release-operator Phase 6](../../skills/spine-release-operator/SKILL.md#phase-6--publish-after-approval-only). **Do not** bump until M-AUTO-01 through M-AUTO-04 and post-mortem are satisfied.

- [ ] Operator explicitly approved publish (`minor` → v2.0.0)
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded; post-publish smoke per [`npm-publish.md`](npm-publish.md)

---

## Signoff summary

| Metric | ID | Status |
|--------|-----|--------|
| Gates-only execution | M-AUTO-01 | ☐ |
| Issue delta negative | M-AUTO-02 | ☐ |
| `release:check` green | M-AUTO-03 | ☐ |
| Manifest scope complete | M-AUTO-04 | ☐ |
| Post-mortem committed | FR-STA-32 | ☐ |
| CONTEXT Phase 62 | SP-551 | ☐ |
| **All PRD §8 criteria** | | ☐ |

**Final operator sign-off:**

| Operator | Date (UTC) | v2.0.0 tag SHA |
|----------|------------|----------------|
| | | |
