# Release manifest — v2.1.0

**Created:** 2026-07-09
**Current version:** 2.0.0
**Target version:** v2.1.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-09)

**Source PRD:** [`docs/PRD-v2.1.0-backlog-drain-handoff.md`](../PRD-v2.1.0-backlog-drain-handoff.md)

**Open-issue baseline:** 29 (`gh issue list --repo beettlle/pi-spine --state open`)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 3 | 2–4 | PASS |
| Bug fixes | 2 | 3–5 | WARN |
| Enhancements | 4 | 1–2 | WARN |
| Infrastructure | 3 | — | PASS |
| Sign-off | 1 | — | PASS |
| **Total tasks** | 13 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 2; enhancement count 4 — approved backlog-drain scope per PRD §2)

**Operator buckets (release harness):**

| Bucket | Tasks |
|--------|-------|
| Infrastructure | SP-552, SP-553, SP-554 |
| Bug | SP-555, SP-560 |
| Enhancement | SP-556, SP-557, SP-559, SP-562 |
| Documentation | SP-558, SP-561, SP-563 |
| Sign-off | SP-564 |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-552 | — | infra | S | v2.1.0 backlog drain handoff PRD | Phase 63 spec |
| SP-553 | — | infra | S | v2.1.0 release manifest | Operator gate |
| SP-554 | FR-REL210-01 | infra | S | v2.1.0 regression gate script | Partial |
| SP-555 | #169 | bug | S | worktree cleanup completion | Closes |
| SP-556 | #157 | enh | S | CI guard reconcile cwd tests | Closes |
| SP-557 | #148 | enh | S | duplicate step number validator | Closes |
| SP-558 | #146–#150 | doc | S | create-spine-tasks skill authoring polish | Partial |
| SP-559 | #128 | enh | S | spine doctor duplicate install detection | Closes |
| SP-560 | #185 | bug | S | agent detached orchestration UX | Closes |
| SP-561 | #129 | doc | S | component maturity matrix | Closes |
| SP-562 | #175 | enh | S | preversion release:check hook | Partial |
| SP-563 | #130, #171, #156, #141, #125 | doc | S | GitHub backlog hygiene | Hygiene |
| SP-564 | — | sign-off | S | CONTEXT Phase 63 capstone | — |

**Release scope ID:**

```text
SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564
```

---

## Sequence runner (Phase 4)

The manifest is the operator contract; the CLI takes the **scope ID string**, not the manifest file path.

```bash
spine tasks validate SP-552 SP-553 SP-554 SP-555 SP-556 SP-557 SP-558 SP-559 SP-560 SP-561 SP-562 SP-563 SP-564
spine plan SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564
spine run sequence SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564 --dry-run
spine run sequence SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564
```

Per-wave manual loop (alternative to full sequence):

```bash
spine batch start SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564 --wave N
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
```

**Regression gate** (run after each integrate, before next wave):

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

**Operator gates** (human only — sequence does not auto-approve without explicit flags):

1. Approve this manifest (operator sign-off on scope)
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version minor`

**Proof gate:** v2.0.0 gates-only proof complete; v2.1.0 is first post-proof backlog drain — operator approves publish after SP-564 capstone.

Filled example: [`docs/release/manifest-v1.10.0-example.md`](manifest-v1.10.0-example.md)

---

## Gaps requiring new packets

None — all v2.1.0 scope items tasked as SP-552–564 per PRD §6.

---

## Wave plan snapshot

```text
Spine plan — ids
13 task(s) · 6 wave(s) · maxParallel 4

Wave 0 · 1 task
  Lane 1: SP-552 — v2.1.0 backlog drain handoff PRD

Wave 1 · 1 task
  Lane 1: SP-553 — v2.1.0 release manifest

Wave 2 · 8 tasks · 2 rounds (queued by maxParallel)
  Round 1 (4 parallel):
    Lane 1: SP-554 — v2.1.0 regression gate script
    Lane 2: SP-555 — v2.1.0 worktree cleanup completion
    Lane 3: SP-556 — CI guard reconcile cwd tests
    Lane 4 (serial):
    · SP-557 — duplicate step number validator
    · SP-558 — create-spine-tasks skill authoring polish
  Round 2 (3 parallel):
    Lane 1: SP-559 — spine doctor duplicate install detection
    Lane 2: SP-560 — agent detached orchestration UX
    Lane 3: SP-561 — component maturity matrix

Wave 3 · 1 task
  Lane 1: SP-562 — preversion release:check hook

Wave 4 · 1 task
  Lane 1: SP-563 — GitHub backlog hygiene

Wave 5 · 1 task
  Lane 1: SP-564 — CONTEXT Phase 63 capstone
```

Run `spine plan SP-552,SP-553,SP-554,SP-555,SP-556,SP-557,SP-558,SP-559,SP-560,SP-561,SP-562,SP-563,SP-564` after validate for authoritative waves.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) | epic | Monitoring epic — out of minor scope |
| [#117](https://github.com/beettlle/pi-spine/issues/117) | epic | v2.3 module split — FR-SHIP-02 |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | epic | Gate maturity / mailbox roadmap |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | enh | M-sized dashboard DAG — deferred in v2.0.0 |
| [#158](https://github.com/beettlle/pi-spine/issues/158) | enh | Operator salvage — new command surface (M) |
| [#160](https://github.com/beettlle/pi-spine/issues/160) | enh | Stet gate evidence — P3 |

---

## Risks and blockers

- Bug count (2) below minor profile target (3–5) — operator override; backlog drain prioritizes landed partial fixes
- Enhancement count (4) exceeds minor profile (1–2) — operator override per PRD §2 scope lock
- SP-562 depends on SP-554 regression gate — must land gate before preversion hook
- SP-563 hygiene depends on SP-555–562 implementation tasks completing first
- SP-558 and SP-560 both touch operator/skill surfaces — may serialize within wave 2 round 2

---

## GitHub backlog hygiene (SP-563)

**Executed:** 2026-07-09

| Issue | SP-ID | Land commit | Status |
|-------|-------|-------------|--------|
| [#130](https://github.com/beettlle/pi-spine/issues/130) | SP-483 | `ba9e914d` | Closed |
| [#171](https://github.com/beettlle/pi-spine/issues/171) | SP-526 | `cd313ec3` | Closed |
| [#156](https://github.com/beettlle/pi-spine/issues/156) | SP-531 | `0293e278` | Closed |
| [#141](https://github.com/beettlle/pi-spine/issues/141) | SP-522, SP-523, SP-540 | `09f780c3`, `1176e8b6`, `98ac8456` | Closed |
| [#125](https://github.com/beettlle/pi-spine/issues/125) | SP-352, SP-353 | `a2832364`, `8b33e089` | Closed |

**Open-issue delta:**

| When | Count | Notes |
|------|-------|-------|
| v2.1.0 baseline | 29 | Recorded at manifest creation |
| After SP-563 hygiene | 24 | −5 verify-only closures |

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (SP-552–564 — SP-564 capstone 2026-07-09)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [x] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per [`docs/release/npm-publish.md`](npm-publish.md)
- [x] Open GitHub issues decreased vs baseline 29 (24 open, Δ −5)
