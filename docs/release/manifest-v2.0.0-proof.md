# Release manifest — v2.0.0 (automation proof)

**Created:** 2026-07-08
**Current version:** 1.10.1
**Target version:** v2.0.0
**Bump type:** minor
**Profile:** minor (proof)
**Operator approved scope:** yes (2026-07-08)

**Source PRD:** [`docs/PRD-v2.0.0-automation-proof-handoff.md`](../PRD-v2.0.0-automation-proof-handoff.md)

**Open-issue baseline (proof start):** 30 (`gh issue list --repo beettlle/pi-spine --state open`)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 2–4 | PASS |
| Bug fixes | 3 | 3–5 | PASS |
| Enhancements | 1 | 1–2 | PASS |
| Infrastructure | 2 | — | PASS |
| Sign-off | 2 | — | PASS |
| **Total tasks** | 9 | 5–8 (proof hard limit) | PASS with operator override |

**Profile audit:** PASS with operator override — proof capstone tasks (SP-550, SP-551) and manifest authoring (SP-543) extend the FR-STA-30 product bucket (5 tasks) to 9 total; operator approved 2026-07-08.

**Product buckets (FR-STA-30):** 3 bugs + 1 doc + 1 enhancement = 5 tasks (SP-544, SP-546–549).

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-543 | — | infra | S | v2.0.0 proof release manifest | This task |
| SP-544 | — | doc | S | Automation signoff checklist | FR-STA-33 |
| SP-545 | — | infra | S | Release proof regression gate script | FR-STA-35; dep SP-544 |
| SP-546 | #119 | bug | S | best-of-n external project-root fix | Closes |
| SP-547 | #161 | bug | S | Dashboard retry-then-succeed display fix | Closes |
| SP-548 | #134 | bug | S | Subprocess heartbeat observability | Closes |
| SP-549 | #144, #145 | enh | S | create-spine-tasks skill template hygiene | Partial |
| SP-550 | — | sign-off | S | Proof post-mortem runbook section | FR-STA-32; deps SP-544–549 |
| SP-551 | — | sign-off | S | CONTEXT Phase 62 capstone | deps SP-550 |

**Release scope ID:**

```text
SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551
```

---

## Sequence runner (Phase 4)

The manifest is the operator contract; the CLI takes the **scope ID string**, not the manifest file path.

```bash
spine tasks validate SP-543 SP-544 SP-545 SP-546 SP-547 SP-548 SP-549 SP-550 SP-551
spine plan SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551
spine run sequence SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551 --dry-run
spine run sequence SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551    # detached — omit --attached (#163)
```

**Proof batch (after waves 0–2 land):**

```bash
./scripts/release-proof-gate.sh
spine run sequence SP-546,SP-547,SP-548,SP-549 --auto-approve-gate --detached
# Operator: spine gate approve only (+ publish at end)
```

Per-wave manual loop (alternative to full sequence):

```bash
spine batch start SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551 --wave N
spine status --diagnose
spine gate approve && spine integrate && npm install && spine batch complete
```

**Regression gate** (run after each integrate, before next wave):

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

**Operator gates** (human only — sequence does not auto-approve without explicit flags):

1. Approve this manifest (operator sign-off on scope) — **done 2026-07-08**
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version minor`

**Proof gate:** Pre-publish dry-run — operator touches only `spine gate approve` and publish approval. No `npm publish` during proof. `./scripts/release-proof-gate.sh` must pass before proof sequence.

---

## Wave plan

### Logical phases (PRD §10)

| Phase | Tasks | Notes |
|-------|-------|-------|
| 0 — Manifest + gates | SP-543, SP-544, SP-545 | Operator approval required |
| 1 — Bugs | SP-546, SP-547, SP-548 | Parallel if disjoint |
| 2 — Enhancement | SP-549 | After bugs |
| 3 — Proof sequence | — | Operator session; no new tasks |
| 4 — Sign-off | SP-550, SP-551 | Post-mortem + CONTEXT capstone |

### Authoritative planner output

```text
Spine plan — ids
9 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-543 — v2.0.0 proof release manifest
  Lane 2: SP-544 — Automation signoff checklist

Wave 1 · 5 tasks · 2 rounds (queued by maxParallel)
  Round 1 (4 parallel):
    Lane 1: SP-545 — Release proof regression gate script
    Lane 2: SP-546 — best-of-n external project-root fix
    Lane 3: SP-547 — Dashboard retry-then-succeed display fix
    Lane 4: SP-548 — Subprocess heartbeat observability
  Round 2:
    Lane 1: SP-549 — create-spine-tasks skill template hygiene

Wave 2 · 1 task
  Lane 1: SP-550 — Proof post-mortem runbook section

Wave 3 · 1 task
  Lane 1: SP-551 — CONTEXT Phase 62 capstone
```

Re-run `spine plan SP-543,SP-544,SP-545,SP-546,SP-547,SP-548,SP-549,SP-550,SP-551` after packet changes for authoritative waves.

---

## Gaps requiring new packets

None — all proof-scope work has staged packets (SP-543–551).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #117 | epic | v2.3 module split — out of proof scope per PRD §2 |
| #120–#129 | epic | Gate maturity roadmap — post-proof |
| #99 | enh | Plan pending empty backlog UX — not operator pick |
| #106 | enh | Batch size guidance wording — not operator pick |
| #130 | bug | post-merge sync git restore — not operator pick |
| #146–#150 | enh | skill:create-spine-tasks polish — defer; partial via SP-549 (#144, #145) |
| #141 | enh | scoped testCommand warning — defer |
| #135 | enh | Dashboard visual task DAG — out of proof scope |
| #156, #175 | enh | Release CI gates — landed or separate from proof |
| Phase 54 perf (SP-451–456) | perf | Unless blocking proof monitoring |
| #43 full monitoring epic | epic | SP-360–363 subset only; not proof scope |
| stet-feedback-loop-brief | enh | Only if stet findings exist during proof |

---

## Risks and blockers

- 9 tasks exceed proof hard limit of 8 — mitigated by operator override and S-sized packets only
- SP-545 depends on SP-544; planner queues SP-545 in wave 1 after SP-544 lands
- SP-550 depends on all product tasks (SP-544–549); runs wave 2 after wave 1 completes
- Proof sequence (phase 3) requires real-pi or documented skip per `.github/workflows/real-pi.yml`
- Open-issue delta metric (M-AUTO-02) requires post-proof recount vs baseline 30

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor → v2.0.0
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per [`npm-publish.md`](npm-publish.md)
- [ ] Open GitHub issues decreased vs proof start (30)
- [ ] Post-mortem committed: journal export + issue delta table
- [ ] `docs/release/automation-signoff-checklist.md` all boxes checked
- [ ] CONTEXT Phase 62 complete (SP-551)
