# Release manifest — v2.26.0

**Created:** 2026-09-27
**Current version:** 2.25.0
**Target version:** v2.26.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-09-27 — scope enumerated in the operator invocation: "State and lock work: #301 together with #293, then #302. Rest of P1: #304, #305, #307, #299 as well as #293"; same precedent as v2.25.0)
**Composition choice:** Batch-state lock / write-path correctness from epic [#324](https://github.com/beettlle/pi-spine/issues/324) first (#301 with #293 in waves 1–2, #302 in wave 3), remaining P1s in parallel lanes. #293 is fixed in wave 1 because it recurred throughout the v2.25.0 land loops.
**Worker model pin:** `zai/glm-5.3` via `agents.activeProfile=hard` (config commit `d138142c`, pinned in `fc8558f9`) — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none
**GitNexus:** refreshed 2026-09-27 — status up-to-date with HEAD (`258f2a7`)

---

## Pre-authoring notes

Seeded before Phase 1 intake so the worker pin is decided before any v2.26 batch starts.

- **Why GLM-5.3 for this release:** the planned v2.26 work is the batch-state lock, compare-and-swap and journal fixes from epic [#324](https://github.com/beettlle/pi-spine/issues/324) (#301 with #293, #302, then the remaining P1s). The escalation profile `hard` now uses `zai/glm-5.3`, reviewed by `google/gemini-3.1-pro-preview` for plan, code and final review.
- **Escalation during this release:** none available — `escalatePolicy.toProfile` is `hard`, which is already active. Escalate only on content or contract failure, and record any override above before applying it.
- **v2.27 authoring:** switch back with `spine settings set agents.activeProfile default` before the first v2.27 batch, and record the default-profile worker pin (`zai/glm-5.3-flash`) in the v2.27 manifest.

---

## Context

- Current `main`: `2.25.0` @ `258f2a7` (v2.25.0 on npm)
- Pending SP-*: **0** before authoring (Next Task ID was **SP-790**; now **SP-804**)
- Open issues: **38** — 0 `documentation`; P1 bugs #299, #301, #302, #304, #305, #307; unprioritized bugs #293, #294; P2/P3 backlog; epic #324
- `spine status --diagnose`: idle

### Authoring constraints

- `BATCH_MODULE_LOC_LIMIT = 500` on top-level `src/batch/*.mjs` (empty grandfather list). Near-cap files touched this release: `contract-exec.mjs` 498 (SP-799 moves a helper out; SP-800 must stay ≤ 500), `resume.mjs` 498 (SP-798 adds one argument), `lifecycle.mjs` 469 (SP-792, SP-796). `src/batch/engine-lanes/*` is not counted.
- `withBatchStateLock` is re-entrant per process via a `globalThis` map; SP-797's async variant keeps the locked section synchronous so re-entrancy stays correct.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 (minor) | WARN — 0 doc issues open; SP-803 documents the operator-visible changes |
| Bug fixes | 7 issues / 13 packets | 3–5 | **PASS with operator override** (operator enumerated 7 bugs) |
| Enhancements | 0 | 1–2 (minor) | PASS with operator override (bug-only release by operator choice) |
| **Total tasks** | 14 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 7 > 5; 0 enhancements; docs under floor)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `typescript` 6.0.3 → 7.0.2 (major); `@types/node` 22.20.4 → 26.6.3 (major). No same-major drift. |
| `npm audit` highs/criticals | **0** |
| Action | **deferred** — toolchain majors fire the minor threshold, but the operator scoped this release to the enumerated bugs; TS 7 migration deserves its own release (same call as v2.25.0) |

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| typescript | 6.0.3 | 7.0.2 | **defer** (major; bug-only scope) |
| @types/node | 22.20.4 | 26.6.3 | **defer** (major) |

---

## Intake → selection

| Issue | Labels | Mapped SP-* | Bucket | Decision |
|-------|--------|-------------|--------|----------|
| #293 | bug | SP-790 | bug | **Select** — wave 1 (recurring land-loop blocker) |
| #301 | bug P1 | SP-790 (Partial), SP-791 (Partial), SP-792 (Partial), SP-793 (Closes) | bug | **Select** — split: guard / RMW helper / archive snapshot / bypass audit |
| #302 | bug P1 | SP-794, SP-795, SP-796 (Partial), SP-797 (Closes) | bug | **Select** — split: steal race / fsync / critical sections / async wait |
| #304 | bug P1 | SP-798 | bug | **Select** |
| #305 | bug P1 | SP-799 (Partial), SP-800 (Closes) | bug | **Select** — split: async runner / async verify + callers |
| #307 | bug P1 | SP-802 | bug | **Select** |
| #299 | bug P1 | SP-801 | bug | **Select** |
| — | doc | SP-803 | doc | **Select** — runbook for v2.26.0 behavior changes |
| #294 | bug | — | bug | **Defer** — outside operator scope |
| #309–#323 | P2 | — | bug/enh | **Defer** |
| #324 | epic P1 | — | epic | **Defer** (tracking epic; this release advances it) |
| #225, #231, #212, #211, #209, #135, #127, #124, #43 | P3 | — | enh/epic | **Defer** |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-790 | #293, #301 | bug | M | Refuse post-archive batch-state resurrection | Closes #293; Partial #301 |
| SP-791 | #301 | bug | M | Atomic batch-state update helper; engine/pause merge in lock | Partial #301; deps SP-790 |
| SP-792 | #301 | bug | M | Abort/complete/dismiss archive in-lock state | Partial #301 |
| SP-793 | #301 | bug | M | `bypassOwnerCheck` rename + bypass-site audit | Closes #301; deps SP-790, SP-791 |
| SP-794 | #302 | bug | M | Lock steal-by-rename with token re-check | Partial #302 |
| SP-795 | #302 | bug | S | Durable `writeJsonAtomic` | Partial #302 |
| SP-796 | #302 | bug | M | Shrink terminal lock sections to state I/O | Partial #302; deps SP-792 |
| SP-797 | #302 | bug | M | Async engine lock wait | Closes #302; deps SP-791, SP-793, SP-794 |
| SP-798 | #304 | bug | M | Lane merge out-of-scope fail-closed | Closes #304 |
| SP-799 | #305 | bug | M | Async contract shell runner | Partial #305 |
| SP-800 | #305 | bug | M | Async contract verification | Closes #305; deps SP-799 |
| SP-801 | #299 | bug | S | Worker fails closed when pi is missing | Closes #299 |
| SP-802 | #307 | bug | M | Sequence wait deadline + stall exit | Closes #307; deps SP-798 (shared `defaults.mjs`) |
| SP-803 | — | doc | S | Runbook: v2.26.0 state and lock hardening | deps SP-790, 793, 796, 797, 798, 800, 801, 802 |

**Release scope ID:** `SP-790,SP-791,SP-792,SP-793,SP-794,SP-795,SP-796,SP-797,SP-798,SP-799,SP-800,SP-801,SP-802,SP-803`

### Operator wave plan (explicit scope per wave)

The planner would put every no-dependency task (including #302's SP-794/795) in wave 0. Waves run as explicit scope lists instead, to honor the operator order (#301 + #293 → #302) and keep ≤ 4 M tasks per wave:

| Wave | Scope | Rationale |
|------|-------|-----------|
| 1 | `SP-790,SP-798,SP-799,SP-801` | #293 guard (#301 part 1) + #304, #305 runner, #299 |
| 2 | `SP-791,SP-792,SP-793,SP-800` | Finish #301 (SP-793 runs after SP-791 inside the batch) + #305 async verify |
| 3 | `SP-794,SP-795,SP-796,SP-797` | #302 (SP-797 runs after SP-794 inside the batch) |
| 4 | `SP-802,SP-803` | #307 + docs (SP-803 last) |

---

## Gaps requiring new packets

All 14 packets are new (lean authoring). See Selected tasks.

---

## Wave plan snapshot

`spine tasks validate` (14): 14 passed, 0 failed. `spine tasks analyze` (14): 0 blocking, 2 warnings (whole-scope wave 0 has 5 M tasks — handled by per-wave scopes; pre-existing missing `_explore/engine-lanes-split/findings.md`). Two blocking overlaps found on first analyze (SP-798/SP-802 on `src/config/defaults.mjs`, SP-793/SP-797 on `src/batch/pause.mjs`) were fixed with serialization edges.

```text
spine plan SP-790,SP-798,SP-799,SP-801
Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-790 — Refuse post-archive batch-state resurrection
  Lane 2: SP-798 — Lane merge: never silently discard lane-committed out-of-scope changes
  Lane 3: SP-799 — Async shell runner for contract commands (process-group timeout kill, output cap)
  Lane 4: SP-801 — Worker fails closed when pi is missing from PATH (no implicit stub)
```

Waves 2–4 are planned after the previous wave lands (deps must be `.DONE`).

Baseline `npm run release:check` on `258f2a7` (pre-authoring): tests 2709 pass / 0 fail, line coverage 90.03%, exit 0 — log `/tmp/pi-spine-v2.26-baseline.log`.

---

## Execution log

### Wave 1 — batch `20260928T010710-9c1b` (`SP-790,SP-798,SP-799,SP-801`)

- 2026-09-28 01:16–01:18 UTC: all four workers failed with z.ai 429 (5-hour usage limit, reset 10:37:44 UTC+8). Operator chose **wait for reset, then retry** (no pin change, #248). Lane 2 had stray untracked `index.ts` / `parallel.ts` (worker scratch, outside File Scope) — removed before retry.
- 15:26 UTC: `spine batch retry` ×4 + `spine batch resume`. SP-790, SP-799 completed with plan/code/final review and `contract.verified`. SP-798 hit the 429 limit again at 15:58 (reset 2026-09-29 04:26:47 UTC+8 = 20:26 UTC); partial work kept in lane 2.
- **SP-801 completed through a leaked stub verdict**: its contract test run (`review.test.mjs`, direct `node --test`) wrote a stub final `PASS` into the live journal; the engine honored it (`honorSource: "journal"`) and skipped contract verification. Filed [#328](https://github.com/beettlle/pi-spine/issues/328). Operator re-ran the SP-801 contract in the lane-4 worktree: lint + typecheck exit 0, 43/43 tests pass; diff reviewed against the packet.
- Mitigation: SP-791–SP-797, SP-800, SP-802 Contract `testCommand` now set `SPINE_SUPPRESS_JOURNAL_ATTACH=1` (Amendments recorded in each PROMPT).
- 21:35 UTC: SP-798 retried after quota reset; completed with plan/code/final review and `contract.verified`. Wave merged 21:57.
- 22:03 UTC: waited for `gate.evidence_completed` before approving (avoids #293 on the pre-fix engine). Gate evidence test count (2709) matched the pre-release baseline, so it likely ran against `main`, not orch — verified independently post-integrate.
- Integrated as `92a53711`; `spine batch complete` archived the batch and `.spine/batch-state.json` was not recreated.
- Post-integrate `npm run release:check` on `main`: 2727 pass / 0 fail, line coverage 90.07%, exit 0 — log `/tmp/pi-spine-v2.26-wave1.log`.
- Paused after wave 1 at operator request (peak model pricing). Next: wave 2 `SP-791,SP-792,SP-793,SP-800`.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #294 | bug | Outside operator-enumerated scope |
| #309–#323 | P2 | Defer |
| #305 step 5 (matrix `contract.test_retry` parity) | follow-up | Not in #305 acceptance criteria |
| #299 optional `.DONE` `mode: "stub"` | follow-up | Optional in #299 |
| TypeScript 7 / `@types/node` 26 | dep major | Own release |
| #225 / #231 matrix epic | epic | P3 |

---

## Risks and blockers

- 14 packets with 11 M tasks — above a normal minor; operator override recorded. Planner advises `lanes.stallTimeoutMinutes ≥ 120` for real workers.
- SP-790 tightens the write guard for every phase; batch-meta recovery (#126) must pass `allowArchivedResurrection` — called out in the packet.
- SP-798 makes out-of-scope merge conflicts fail closed; batches that silently relied on the discard will now fail with an actionable message.
- SP-797 converts ~19 engine save sites to `await`; a sync enclosing function is recorded as a blocker rather than widened.
- SP-793 / SP-797 touch many `src/batch` files; each wave's post-integrate `release:check` is the cross-file safety net.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded; staged package approved (2FA)
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
