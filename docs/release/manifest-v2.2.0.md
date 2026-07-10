# Release manifest — v2.2.0

**Created:** 2026-07-09
**Current version:** 2.1.0
**Target version:** v2.2.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-09)

**Published:** 2026-07-10 — tag `v2.2.0`, npm `pi-spine@2.2.0`

**Source PRD:** [`docs/PRD-v2.2.0-backlog-drain-handoff.md`](../PRD-v2.2.0-backlog-drain-handoff.md)

**Open-issue baseline:** 22 (`gh issue list --repo beettlle/pi-spine --state open`)

**Design decision (#190):** fail-closed — block promote/merge without committed `.DONE` on lane branch

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 1 | 3–5 | WARN |
| Enhancements | 2 | 1–2 | PASS |
| Infrastructure | 3 | — | PASS |
| Sign-off | 1 | — | PASS |
| **Total tasks** | 9 | 10–15 | WARN |

**Profile audit:** PASS with operator override (9 tasks; bug count 1 below minimum — #190 treated as engine correctness)

**Operator buckets (release harness):**

| Bucket | Tasks |
|--------|-------|
| Infrastructure | SP-565, SP-566, SP-567 |
| Bug | SP-568, SP-569 |
| Enhancement | SP-570, SP-571 |
| Documentation | SP-572 |
| Sign-off | SP-573 |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-565 | — | infra | S | v2.2.0 backlog drain handoff PRD | Phase 64 spec |
| SP-566 | — | infra | S | v2.2.0 release manifest | Operator gate |
| SP-567 | FR-REL220-01 | infra | S | v2.2.0 regression gate script | Partial |
| SP-568 | #190 | bug | S | done-marker fail-closed explore | Read-only |
| SP-569 | #190 | bug | M | done-marker fail-closed engine | Closes |
| SP-570 | #158 | enh | S | operator salvage list CLI | Partial |
| SP-571 | #158 | enh | M | operator salvage integrate | Closes |
| SP-572 | #128,#129,#146–150,#175,#185 | doc | S | GitHub backlog hygiene | Hygiene |
| SP-573 | — | sign-off | S | CONTEXT Phase 64 capstone | — |

**Release scope ID:**

```text
SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573
```

---

## Sequence runner (Phase 4)

The manifest is the operator contract; the CLI takes the **scope ID string**, not the manifest file path.

```bash
spine tasks validate SP-565 SP-566 SP-567 SP-568 SP-569 SP-570 SP-571 SP-572 SP-573
spine plan SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573
spine run sequence SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573 --dry-run
spine run sequence SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573 --detached
```

Per-wave manual loop (alternative to full sequence):

```bash
spine batch start SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573 --wave N
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

**Proof gate:** v2.1.0 backlog drain complete; v2.2.0 is post-v2.1 fail-closed + salvage minor — operator approves publish after SP-573 capstone.

Filled example: [`docs/release/manifest-v1.10.0-example.md`](manifest-v1.10.0-example.md)

---

## Gaps requiring new packets

None — all v2.2.0 scope items tasked as SP-565–573 per PRD §6.

---

## Wave plan snapshot

```text
Spine plan — ids
9 task(s) · 7 wave(s) · maxParallel 4

Wave 0 · 1 task
  Lane 1: SP-565 — v2.2.0 backlog drain handoff PRD

Wave 1 · 1 task
  Lane 1: SP-566 — v2.2.0 release manifest

Wave 2 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-567 — v2.2.0 regression gate script
  Lane 2: SP-568 — done-marker fail-closed explore

Wave 3 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-569 — done-marker fail-closed engine
  Lane 2: SP-570 — operator salvage list CLI

Wave 4 · 1 task
  Lane 1: SP-571 — operator salvage integrate

Wave 5 · 1 task
  Lane 1: SP-572 — v2.2.0 GitHub backlog hygiene

Wave 6 · 1 task
  Lane 1: SP-573 — CONTEXT Phase 64 capstone
```

Run `spine plan SP-565,SP-566,SP-567,SP-568,SP-569,SP-570,SP-571,SP-572,SP-573` after validate for authoritative waves.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| [#43](https://github.com/beettlle/pi-spine/issues/43) | epic | Monitoring epic — out of minor scope |
| [#117](https://github.com/beettlle/pi-spine/issues/117) | epic | v2.3 module split — FR-SHIP-02 |
| [#116](https://github.com/beettlle/pi-spine/issues/116) | epic | v2.3 module split — FR-SHIP-02 |
| [#120](https://github.com/beettlle/pi-spine/issues/120)–[#127](https://github.com/beettlle/pi-spine/issues/127) | epic | Gate maturity / mailbox roadmap |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | enh | M-sized dashboard DAG — deferred in v2.0.0 and v2.1.0 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) | enh | Stet gate evidence — P3 |

---

## Risks and blockers

- Bug count (1) below minor profile target (3–5) — operator override; #190 fail-closed treated as engine correctness
- Total task count (9) below minor profile (10–15) — operator override; focused backlog drain
- SP-569 serial on `src/batch/` — must not parallel with other batch engine edits
- SP-571 depends on SP-570 salvage list — integrate after list mode lands
- SP-572 hygiene depends on SP-569 and SP-571 closing #190 and #158 first
- SP-568 explore and SP-569 engine both touch done-marker paths — explore must land before engine

---

## GitHub backlog hygiene (SP-572)

| Issue | SP-ID | Land commit | Status |
|-------|-------|-------------|--------|
| [#128](https://github.com/beettlle/pi-spine/issues/128) | SP-559 | `dc50e58b` | closed |
| [#129](https://github.com/beettlle/pi-spine/issues/129) | SP-561 | `153b2696` | closed |
| [#146](https://github.com/beettlle/pi-spine/issues/146)–[#150](https://github.com/beettlle/pi-spine/issues/150) | SP-558 | `281748da` | closed (#148 was already closed by SP-557) |
| [#175](https://github.com/beettlle/pi-spine/issues/175) | SP-562 | `a3b6ab43` | closed |
| [#185](https://github.com/beettlle/pi-spine/issues/185) | SP-560 | `7a29e1bd` | closed |

**Implementation closures (SP-569, SP-571):**

| Issue | SP-ID | Status |
|-------|-------|--------|
| [#190](https://github.com/beettlle/pi-spine/issues/190) | SP-569 | `40533e2d` | closed |
| [#158](https://github.com/beettlle/pi-spine/issues/158) | SP-571 | `b11d7775` | closed |

**Open-issue delta:**

| When | Count | Notes |
|------|-------|-------|
| v2.2.0 baseline | 22 | Recorded at manifest creation |
| After SP-572 hygiene | 14 | Δ −8 |
| After publish + #158 close | 12 | Δ −10 vs baseline |

---

## Publish checklist (Phase 5–6)

- [x] Operator approved scope: yes (2026-07-09)
- [x] All release-scoped tasks `.DONE` on `main` (SP-565–573)
- [x] `spine preflight` green
- [x] `npm run release:check` green (`69a1d02c`, 88.99% coverage)
- [x] Operator approved publish bump type: minor
- [x] `npm version minor` + `git push && git push --tags` → `v2.2.0`
- [x] CI succeeded (`29069234480`)
- [x] Release workflow succeeded (`29069235335`)
- [x] npm published `pi-spine@2.2.0`
- [x] Open GitHub issues decreased vs baseline 22 (12 open, Δ −10)
