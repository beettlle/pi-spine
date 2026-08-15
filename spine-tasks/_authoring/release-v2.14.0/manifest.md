# Release manifest — v2.14.0

**Created:** 2026-08-15
**Current version:** 2.13.0
**Target version:** v2.14.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-08-15)
**Composition choice:** A — Painless ops (2026-08-15)
**Worker model pin:** `kimi-coding/k3` (thinking: high) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-08-14 — status up-to-date with HEAD `205af837`

---

## Context

Operator request: next release after v2.13.0; keep it clean/painless (same constraints as v2.12.x–v2.13.0).

- Current `main`: `2.13.0` @ `205af837`
- Pending SP-*: **0** (679 `.DONE`) — all selected work is **gaps**
- Open bugs: **0**; open docs: **0**; open enhancements: 14
- Next Task ID: **SP-703**
- Dirty hygiene (not in scope): `.spine/rules-manifest.json` `generatedAt` timestamp; GitNexus `AGENTS.md` / `CLAUDE.md`
- Doctor: advisory quota-risk (#251, pin on kimi-coding / hard→google); stale leftover worktree `spine-20260802T231234`; `--attached` orphan warn (non-TTY)

**Do not reintroduce (v2.12.1–v2.12.3, still binding):**

1. Start Phase 4 without recorded scope approval (F1/#249)
2. Mid-release edit `.spine/spine-config.json` agent pins (F7/#248) — v2.12.3 violated this after Kimi 429; v2.13.0 held the pin
3. Re-land planner virtual matrix row IDs / SP-689/SP-696 shape (F2/#226 superseded by #228)
4. Judge `release:check` from log tails alone — verify exit codes (`PIPESTATUS[0]`)
5. Let `main` drift far ahead of `origin` between waves (F8)
6. Use `--attached` from agent/non-TTY shells (#163)
7. Treat cancelled / missing CI as green or red — it is **no signal** (v2.12.3 F-C); recovery is `workflow_dispatch` re-run, then wait for `conclusion: success`

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (v2.13.0 post-mortem + CI no-signal recovery) | 2–4 | PASS |
| Bug fixes | 0 | 3–5 | WARN — no open bugs; operator override |
| Enhancements | 2 (#120, #213) | 1–2 | PASS |
| **Total tasks** | 4 | 10–15 | PASS (under target; same shape as v2.13.0) |

**Profile audit:** PASS with operator override (0 bugs)

---

## GitNexus blast-radius warnings (Phase 2)

| Symbol | Direction | Risk | Implication for this release |
|--------|-----------|------|------------------------------|
| `appendJournalEvent` | upstream | **CRITICAL** (134 symbols, 31 processes) | #120 / SP-705 is additive only: checksum + serialize + retry. **Do not** replace jsonl append with whole-file rewrite. Existing journals must remain readable. |
| `parseReviewVerdict` | upstream | **HIGH** (17 symbols, 4 processes: `markTaskCompleteFromDisk`, `runNonMatrixTaskOnLane`, `runPlanReviewPhase`, `runFinalReviewPhase`) | #213 / SP-706 is audit-first: fixtures first; share a helper only if 2+ parsers fail the same case; fail-closed (no invented verdicts). |

Operator may drop SP-705 and/or SP-706 at the scope gate if the blast radius is too high for a painless cycle.

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-703 | — | doc | S | Post-mortem v2.13.0 (painless ops cycle) | Folder `SP-703-post-mortem-v2-13-0`; writes `docs/release/post-mortem-v2.13.0.md` |
| SP-704 | (F-C leftover) | doc | S | CI cancelled / no-signal publish recovery | Documents `ci.yml` `workflow_dispatch` when HEAD has cancelled/missing CI; `docs/release/npm-publish.md` + release-operator Phase 5 gate |
| SP-705 | #120 | enh | S | Journal checksum + append serialize + EBUSY retry | **Partial or Closes #120**; CRITICAL blast — see scoped AC below |
| SP-706 | #213 | enh | S | Audit review/plan JSON parsers vs fences | Closes #213; HIGH blast — audit + fixtures first |

**Release scope ID:** `SP-703,SP-704,SP-705,SP-706`

**Dependencies:**

```text
SP-703 — none
SP-704 — none
SP-705 — none
SP-706 — none
```

**Suggested waves:**

```text
Wave 0: SP-703, SP-704, SP-705, SP-706   # disjoint file scopes; 1 wave
```

### Packet AC notes (authoring contract)

**SP-703 (docs):** Mirror `docs/release/post-mortem-v2.12.3.md`. Capture v2.13.0 what shipped (SP-699–SP-702, #251, #238), pin held (contrast F-A), publish path (`aa56622a`, tag `v2.13.0`, Release `31759391384`), leftover F-C docs gap pointing at SP-704.

**SP-704 (docs):** Pre-tag CI is **no signal** when runs are `cancelled`, absent, or `in_progress`. Recovery: wait (`gh run watch`) if queued; if cancelled/absent, re-run **CI** via `workflow_dispatch` (`edb7919d`) and wait for `conclusion: success`. Do not `npm version` / `git push --tags` until green. File Scope: `docs/release/npm-publish.md` and `skills/spine-release-operator/SKILL.md` (Phase 5 / pre-tag CI gate) only.

**SP-705 (#120, S, CRITICAL):** Keep `appendFileSync` + existing fsync. Add SHA-256 checksum **field on new events**; skip/warn on missing checksum (legacy lines). In-process append serialization + bounded EBUSY/ENOENT retry. **Do not** rewrite the whole jsonl via `writeTextAtomic` per event (O(n) + lost concurrent appends). Reuse `src/fs/atomic-write.mjs` only if extracting a small fsync/retry helper — PID-stamped temps already exist there for **non-append** artifacts. Tests in `tests/batch/journal.test.mjs`. Backward compatible `JOURNAL_SCHEMA_VERSION`.

**SP-706 (#213, S, HIGH):** Inventory `parseReviewVerdict` (`src/batch/review-shared.mjs` — already handles ` ```json ` fences) and sibling structured parsers. Add regression fixtures: fence-wrapped, preamble+JSON, embedded objects. Extract shared brace/fence helper **only** if 2+ call sites fail the same case. Failures stay explicit (`verdict: null`); do not invent PASS/REVISE/APPROVE from garbage.

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-703 SP-704 SP-705 SP-706
spine plan SP-703,SP-704,SP-705,SP-706
spine run sequence SP-703,SP-704,SP-705,SP-706 --dry-run
spine batch start SP-703,SP-704,SP-705,SP-706 --wave 0   # detached — omit --attached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

Then `git push origin main` when remote publish is the goal (F8).

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| (process docs) | doc | SP-703 | create-spine-tasks (lean) |
| (F-C leftover) | doc | SP-704 | create-spine-tasks (lean) |
| #120 | enh | SP-705 | create-spine-tasks (lean) |
| #213 | enh | SP-706 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
4 task(s) · 1 wave(s) · maxParallel 4

Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-703 — Post-mortem v2-13-0 release process
  Lane 2: SP-704 — CI cancelled no-signal publish recovery
  Lane 3: SP-705 — Journal checksum + append serialize
  Lane 4: SP-706 — Review parser fence audit
```

**Validate:** 4 passed, 0 failed (`spine tasks validate SP-703 SP-704 SP-705 SP-706`).
**Analyze:** 0 blocking, 1 warning (pre-existing CONTEXT `_explore/engine-lanes-split/findings.md` missing).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #225 | epic | Matrix job arrays — out of painless minor |
| #229–#232 | enh | Matrix epic children — defer (recent matrix churn) |
| #209–#212 | enh | P3 backlog — exceed 1–2 enh budget (#213 taken) |
| #124, #127, #135, #43 | enh | Large / epic-adjacent |
| #245 V8 attribution root-cause | bug (closed strategy) | Isolation re-verify remains publish gate |

---

## Risks and blockers

- **CRITICAL** GitNexus blast on `appendJournalEvent` — SP-705 must stay additive; contract fail or journal-format churn aborts the painless goal
- **HIGH** GitNexus blast on `parseReviewVerdict` — SP-706 must not change fail-closed semantics
- Worker pin remains `kimi-coding/k3` — doctor quota-risk advisory (#251); **do not** thrash pins on 429/403; pause/retry or abort wave instead
- Same-wave four lanes: file scopes **must** stay disjoint (docs vs journal vs parsers)
- Stale leftover worktree `spine-20260802T231234` — cleanup optional before batch (`spine cleanup worktrees --dry-run`)
- Dirty hygiene before packet commit: `.spine/rules-manifest.json`, `AGENTS.md`, `CLAUDE.md`
- Zero open bugs: profile WARN; operator override required (this composition)

---

## Stabilization / do not reintroduce

- No Phase 4 without this manifest’s `Operator approved scope: yes`
- No mid-release `.spine/spine-config.json` agent pin edits
- No planner virtual matrix row IDs
- Detached batches only from agent shells
- Post-integrate `release:check` exit 0 before next wave / push (`PIPESTATUS[0]`, not `tail`)
- Pre-tag: `ci.yml` green on HEAD; cancelled/absent CI → `workflow_dispatch`, then wait — do not tag
- Post-publish smoke via `scripts/post-publish-smoke.sh` (F9 registry lag)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity) — **verified exit 0**
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`) — fail closed if cancelled/absent
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **minor**
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: `scripts/post-publish-smoke.sh 2.14.0`
