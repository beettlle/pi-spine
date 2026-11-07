# Release manifest — v2.30.0

**Created:** 2026-11-01
**Current version:** 2.29.0 (published 2026-10-24, `4a83edc8`; global install 2.29.0)
**Target version:** v2.30.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-01, approved with #357 and #371 added as S packets SP-855 / SP-856)
**Worker model pin:** `zai/glm-5.3-flash` (thinking high), quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

**Theme:** adopt stet v1.4.0 (released 2026-11-01, installed locally). v2.29.0 stripped stet from both `testCommand`s after false "missing/unused symbol" findings on JSDoc hunks. stet v1.4.0 adds file imports to JS/TS hunks (stet #36, #19), drops existence claims the file disproves (#33), gives the critic the reviewer's context (#18), keeps dismissals across line shifts (#38), and adds `stet list --min-severity/--min-confidence` (#37). This release ports the threshold gate into our contract script and runs this release's code packets with stet as a **blocking** `reviewCommand` (SP-845).

---

## Release guardrails (carried from v2.29.0)

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets per release | Composition audit fails above 2 |
| **Scope freeze** | End of Phase 3 (packets authored + `spine plan` clean) | Later work goes to a patch release or the next manifest |
| **Binary policy** | Published global only (`spine` 2.29.0 from npm; includes SP-845 `reviewCommand` and SP-844 keep paths) | **Exceptions:** none |
| **Dependency chain depth** | ≤ 2 waves per batch | Batch A and Batch B land and pass `release:check` separately |
| **Structural guards** | Every code `testCommand` includes `tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` | `spine-task-authoring.mdc` Definition of ready |
| **Host capacity** | `spine doctor` "stet review capacity" has no warning before each `batch start` | 2026-11-01: the stet repo's own batch (pid 84834, SP-077..SP-083) is running and swap is 1.2 GiB free — wait for it before Batch A |
| **Stet gate (Batch B)** | `contract.reviewPolicy blocking`, `contract.reviewTimeoutMs 1800000`, set before Batch B starts, never mid-batch | Findings are triaged, never bypassed by removing `reviewCommand` |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (SP-847, SP-848) | 2–4 | PASS |
| Bug fixes | 7 (SP-850..SP-856: #356, #370, #337, #345, audit high, #357, #371) | 3–5 | WARN — over budget by operator override (all S) |
| Enhancements | 2 (SP-846, SP-849) | 1–2 | PASS |
| **M packets** | 0 | ≤ 2 | PASS |
| **Total tasks** | 11 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 7 > 5, approved 2026-11-01)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 1.1.0 → 1.4.0 (wanted 1.4.0); `eslint` 10.11.0 → 10.14.0; `globals` 17.12.0 → 17.14.0; `@types/node` 22.20.4 → 26.6.6 (latest); `typebox` 1.3.34 → 1.4.3; `typescript` 6.0.3 → 7.0.2 |
| `npm audit` highs/criticals | 1 high (`undici`, transitive via `pi-coding-agent`), 0 critical, 5 moderate |
| Action | **include SP-854** (security high + peer ≥1-minor drift): lockfile to `pi-coding-agent` 1.4.0 (ships `undici` 8.10.2), `eslint` / `globals` minors. **Deferred:** TypeScript 7 (toolchain major), `@types/node` 26, `typebox` 1.4 — separate hygiene packet in a later minor |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-846 | — | enh | S | Stet contract script: severity/confidence threshold gate (stet v1.4.0 port) | Keeps `[task-id]` scoping; old-stet fallback |
| SP-847 | — | doc | S | Runbook §8.1 + stet overview: threshold gate, v1.4.0 floor, review timeout | Docs-only |
| SP-848 | — | doc | S | Authoring guidance: stet in `reviewCommand`, strictness by size | Docs-only |
| SP-849 | — | enh | S | `spine doctor`: advisory warning when stet < v1.4.0 | Never fails preflight |
| SP-850 | #356 | bug | S | `--diagnose`: task in code review is not `state_drift`; no `resume --force` while engine alive | Closes #356 |
| SP-851 | #370 | bug | S | Detached resume ignores pre-resume `failed` state | Closes #370 |
| SP-852 | #337 | bug | S | Worker rules loader: skip oversize rule and continue | Closes #337 |
| SP-853 | #345 | bug | S | `worker.rules_selected` journaled after load with byte-cap fields | Closes #345; depends on SP-852 |
| SP-854 | — | bug | S | Dependency security: `pi-coding-agent` 1.4.0 lockfile, `npm audit` 0 high | Dep hygiene |
| SP-855 | #357 | bug | S | Code/final reviewer rule selection scoped to task File Scope | Closes #357 |
| SP-856 | #371 | bug | S | `spine integrate` / `batch complete`: live-engine land loop suggests `spine wait`, no lifecycle-failure headline | Closes #371 |

**Release scope ID:** `SP-846,SP-847,SP-848,SP-849,SP-850,SP-851,SP-852,SP-853,SP-854,SP-855,SP-856`

**Batch A scope:** `SP-846,SP-847,SP-848,SP-854` — no stet `reviewCommand` (the threshold script is not on `main` yet).
**Batch B scope:** `SP-849,SP-850,SP-851,SP-852,SP-853,SP-855,SP-856` — every code packet runs `scripts/spine-stet-contract-run.sh <level> <task-id>` as a blocking `reviewCommand`. With `maxParallel` 2, wave 0 queues three rounds per lane (lane 1: SP-849 → SP-851 → SP-855), which is the live acceptance case for [#349](https://github.com/beettlle/pi-spine/issues/349): `.review/` and the stet session must survive into the second and third tasks on a lane, and each stet review must be scoped to its own task's commits. SP-853 (wave 1) runs after SP-852 lands.

**No packet:** close #349 after Batch B with the live evidence above.

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| — (stet v1.4.0 port) | enh | SP-846 | create-spine-tasks (lean) |
| — (stet docs) | doc | SP-847 | create-spine-tasks (lean) |
| — (authoring docs) | doc | SP-848 | create-spine-tasks (lean) |
| — (doctor stet floor) | enh | SP-849 | create-spine-tasks (lean) |
| #356 | bug | SP-850 | create-spine-tasks (lean) |
| #357 | bug | SP-855 | create-spine-tasks (lean) |
| #371 | bug | SP-856 | create-spine-tasks (lean) |
| #370 | bug | SP-851 | create-spine-tasks (lean) |
| #337 | bug | SP-852 | create-spine-tasks (lean) |
| #345 | bug | SP-853 | create-spine-tasks (lean) |
| audit high | bug | SP-854 | create-spine-tasks (lean) |

---

## Wave plan snapshot

Phase 3 checks (2026-11-01, global spine 2.29.0): `spine tasks validate` 11/11 passed; `spine tasks analyze` 0 blocking. The analyzer flagged SP-847 and SP-849 for overlapping on the runbook, so SP-849 now depends on SP-847. The remaining warning (a missing `_explore/engine-lanes-split/findings.md`) predates this release.

```text
Batch A — spine plan SP-846,SP-847,SP-848,SP-854
4 task(s) · 1 wave(s) · maxParallel 2
Wave 0 · Round 1: SP-846 | SP-847 · Round 2: SP-848 | SP-854

Batch B — spine plan SP-849,SP-850,SP-851,SP-852,SP-853,SP-855,SP-856
7 task(s) · 2 wave(s) · maxParallel 2
Wave 0 · Round 1: SP-849 | SP-850 · Round 2: SP-851 | SP-852 · Round 3: SP-855 | SP-856
Wave 1 · SP-853 (after SP-852)
```

---

## Execution log (Phase 4)

**Batch A** (`20261102T211511-62e0`, 58 min): 4/4 succeeded. Operator decisions: the leftover v2.29.0 batch `20261023T030941-33c5` was archived before start, and the swap-capacity warning was accepted (Batch A runs no stet). Integrated `655973a5`. Follow-up `49b4adcf` deleted a stray `coverage-err.log` that the SP-846 worker had committed, and added it to `.gitignore`. `release:check` initially failed 3192/3193 because the host git-ai daemon added `refs/notes/ai` to a test temp repo ([#372](https://github.com/beettlle/pi-spine/issues/372)). With git-ai paused it exited 0 (3193/3193). `npm audit --audit-level=high` exits 0.

**Batch B wave 0** (`20261104T002520-ddb2`): blocking stet review policy and a 30-minute review timeout (`18cb39ff`). The swap warning was accepted by the operator. First pass: SP-852 succeeded; the other five failed only on the stet `reviewCommand`, and every `testCommand` passed.

- Stet triage: 23 findings at `warning`/`0.8` or above. 2 were real, both test-hygiene issues in SP-856: `spawnLiveEngine()` called before `try`, and the `fs` patch not restored in `finally`. They were fixed in the lane in `93e6bf67`. 21 were false positives or already correct; they were dismissed and filed as [beettlle/stet#39](https://github.com/beettlle/stet/issues/39).
- With the batch stopped, the operator switched to the advisory policy (`5f02b29f`) and retried all five, which escalated them to the `allegretto` profile. All 6 succeeded. The advisory re-reviews surfaced one more real case of the same pattern in `tests/batch/integrate.test.mjs`, fixed on main in `3aadfbb3`.
- Integrated `45fd75c4`. `release:check` exit 0 (3233/3233, git-ai paused). Closed #356, #370, #337, #357, #371.
- #349: keep-paths verified live, closed. The run also exposed two problems in the contract script's task scoping: retried tasks were reviewed on later lane tasks' commits, and dismissals were lost across baseline switches ([#373](https://github.com/beettlle/pi-spine/issues/373)).

**Batch B wave 1** (`20261105T004549-a7e9`, SP-853, 20 min): advisory stet policy. Succeeded on the first pass; its 3 advisory findings were dismissed (none real). Integrated `901e003f`. `release:check` exit 0 (3234/3234). Closed #345.

**Publish** (2026-11-06): `ci.yml` green on `901e003f`. `npm version minor` (its `preversion` hook re-ran `release:check`, exit 0) created `aad31d39` and tag `v2.30.0`. [release.yml](https://github.com/beettlle/pi-spine/actions/runs/42257052784) staged the package; the operator approved it with 2FA. `npm view pi-spine version` 2.30.0; `scripts/post-publish-smoke.sh 2.30.0` OK; global `spine --version` 2.30.0. `contract.reviewPolicy` stays `advisory` until #373 and beettlle/stet#39 are fixed.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #359 | bug | Same output block as #371; next release (SP-856 must keep integrate output consistent with it) |
| #331, #294, #338, #327, #319, #316, #314, #313, #311, #310, #309 | bug | Bug budget full (5) |
| #361, #363, #362, #360, #358, #348, #347, #344, #341, #339, #326, #323, #322, #321, #320, #318, #317, #312 | enh | Enhancement budget used by the stet adoption pair |
| #366, #324, #225, #43 | epic | Out of minor scope |
| TypeScript 7, `@types/node` 26, `typebox` 1.4 | deps | Toolchain major / no threshold; later hygiene packet |
| `.spine/rules-manifest.json` stale (doctor: 31 on disk vs 11 rescan) | hygiene | Run `spine rules sync` outside batch windows; not release-scoped |

---

## Risks and blockers

| Risk | Mitigation |
|------|------------|
| stet repo batch (pid 84834) shares LM Studio; swap 1.2 GiB free | Host-capacity guardrail: wait for it before each `batch start` |
| Larger critic context in stet v1.4.0 slows reviews | `contract.reviewTimeoutMs 1800000`, `maxParallel` 2 |
| Blocking stet stalls a lane on a v1.4.0 false positive | Dismiss with reason, record in STATUS Discoveries, file at beettlle/stet; switch to `advisory` only between batches |
| `pi-coding-agent` 1.4.0 changes runtime behavior | Post-integrate `release:check`; on breakage defer the bump and record the audit high as deferred |
| Doctor quota-risk advisory (zai / kimi-coding pools without headroom evidence) | Advisory only; quota fallback to `allegretto` is failover, not escalation |

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each batch** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] `ci.yml` green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded (stage) and staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
