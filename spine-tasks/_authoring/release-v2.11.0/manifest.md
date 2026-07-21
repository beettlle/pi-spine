# Release manifest — v2.11.0

**Created:** 2026-07-20
**Current version:** 2.10.0
**Target version:** v2.11.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-07-20 — approve_plus_208)
**Execution status:** **RESUMING** (2026-07-21) — Kimi/Z.ai headroom restored; salvage-aware full scope

### Pause / resume log

| Item | Status |
|------|--------|
| Wave 0 (SP-674, SP-676) | Done on `main` (batch `20260720T211047`) |
| Post-integrate `release:check` | Green after local hygiene (`b691e64a`, `9b48f377`, `7dee5096`) |
| Wave 1 batch `20260720T235540` | **Aborted** (Kimi 403); salvage applied on resume |
| SP-677 salvage | **Done on `main`** (rollup short-circuit fix + scoped tests 18/18 + `.DONE`) |
| SP-675 / SP-678 salvage | WIP on `main` (script + `quota-snapshot.mjs`); finish via new batch |
| Mid-release bugs filed | [#221](https://github.com/beettlle/pi-spine/issues/221), [#222](https://github.com/beettlle/pi-spine/issues/222), [#223](https://github.com/beettlle/pi-spine/issues/223) |
| Resume path | Fresh detached batches for remaining pending (SP-675, SP-678–682); wait includes `gate_open,needs_approval,post_merge_limbo` (#221) |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 | 2–4 | PASS |
| Bug fixes | 0 | 3–5 | WARN — zero open `bug`-labeled issues; recent bugs already closed |
| Enhancements | 3 issues / 7 code tasks | 1–2 | WARN — operator requested #220 + stet/#160 + #208 |
| **Total tasks** | 9 | 10–15 | PASS |

**Profile audit:** PASS with operator override (bug count 0; enhancement count >2 justified by explicit operator choice `approve_plus_208`)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-674 | #160 | enh | M | Gate `testing.review` evidence slot | Closes #160 Phase C |
| SP-675 | #160 | doc | S | Stet review wrapper script + Approach 2 docs | Closes #160 with SP-674 |
| SP-676 | #208 | enh | M | Additive usage fields on run-metrics records | Partial #208 |
| SP-677 | #208 | enh | M | `spine metrics show` usage/cost rollups | Closes #208 with SP-676 |
| SP-678 | #220 | enh | M | Quota snapshot builder (config + metrics join) | Partial #220 |
| SP-679 | #220 | enh | M | `spine metrics quota` CLI + JSON | Partial #220 |
| SP-680 | #220 | enh | M | Quota HTML report renderer | Partial #220 |
| SP-681 | #220 | enh | S | Optional provider probes with degrade | Closes #220 with SP-678–680 |
| SP-682 | #160/#208/#220 | doc | S | QUICK-REFERENCE + runbook metrics/quota/stet | Docs capstone |

**Release scope ID:** `SP-674,SP-675,SP-676,SP-677,SP-678,SP-679,SP-680,SP-681,SP-682`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-674 SP-675 SP-676 SP-677 SP-678 SP-679 SP-680 SP-681 SP-682
spine plan SP-674,SP-675,SP-676,SP-677,SP-678,SP-679,SP-680,SP-681,SP-682
spine run sequence SP-674,SP-675,SP-676,SP-677,SP-678,SP-679,SP-680,SP-681,SP-682 --dry-run
```

Regression gate after each integrate:

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE}.log
test "${PIPESTATUS[0]}" -eq 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #160 Phase C | enh | SP-674, SP-675 | create-spine-tasks (lean) |
| #208 | enh | SP-676, SP-677 | create-spine-tasks (lean) |
| #220 | enh | SP-678–SP-681 | create-spine-tasks (lean) |
| docs | doc | SP-682 | create-spine-tasks (lean) |

---

## Wave plan snapshot

```text
Spine plan — ids
9 task(s) · 4 wave(s) · maxParallel 4

Wave 0 · 2 tasks · 2 lanes in parallel
  Lane 1: SP-674 — Gate testing.review evidence slot
  Lane 2: SP-676 — Run-metrics usage fields

Wave 1 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-675 — Stet review script and Approach 2 docs
  Lane 2: SP-677 — Metrics show usage rollups
  Lane 3: SP-678 — Quota snapshot builder

Wave 2 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-679 — spine metrics quota CLI
  Lane 2: SP-680 — Quota HTML report renderer
  Lane 3: SP-681 — Optional quota provider probes

Wave 3 · 1 task
  Lane 1: SP-682 — Metrics, quota, and stet docs capstone

Start: spine batch start ids --wave 0
Then (after each wave lands):
  Wave 1: spine batch start ids --wave 1
  Wave 2: spine batch start ids --wave 2
  Wave 3: spine batch start ids --wave 3
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #213 | enh | Parser hardening P3; not operator-requested |
| #212 | enh | Operator MCP land-loop — deferred |
| #211 | enh | Authoring outcome export — experimental |
| #209 | enh | Review Level light-path — P3 |
| #135 | enh | Dashboard task DAG — out of scope |
| #127 | enh | File mailbox steering — out of scope |
| #124 | enh | Parallel wave strategies — out of scope |
| #120 | enh | Journal SHA-256/atomic writes — out of scope |
| #43 | epic | Operator monitoring toolkit — epic |

---

## Risks and blockers

- Zero open bugs — profile override required (intake found no `label:bug` issues).
- Enhancement budget exceeded (3 issues) — operator explicitly chose include #208 with #220 + #160.
- `bin/spine.mjs` is a hot file for SP-677 and SP-679 — planner will serialize overlapping scopes.
- Redaction in `metrics.mjs` currently matches `/token/i` — SP-676 must allow usage count fields (`tokensIn`/`tokensOut`) without leaking API keys.
- #220 provider probes are optional and fail closed; MVP must work without Enterprise Cursor APIs.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
