# Release manifest — v1.10.0

**Created:** 2026-07-07
**Current version:** 1.9.0
**Target version:** v1.10.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** no

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 3 | 2–4 | PASS |
| Bug fixes | 4 | 3–5 | PASS |
| Enhancements | 2 | 1–2 | PASS |
| **Total tasks** | 9 | 10–15 | WARN (operator override — harness-focused) |

**Profile audit:** PASS with operator override (9 tasks, harness epic scope)

**Prerequisites (landed, not in release scope):** SP-350, SP-351, SP-360, SP-362, SP-388, SP-389, SP-391, SP-392

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-530 | #175 | doc | S | release:check skill gate | Closes |
| SP-531 | #156 | doc | S | tag CI gate | Closes |
| SP-532 | #173 | bug | S | complete waits engine | Closes |
| SP-533 | #167 | bug | S | concurrent resume failfast | Closes |
| SP-534 | #185 | doc | S | detached policy docs | Closes |
| SP-535 | #54 | doc | S | release manifest format | Partial |
| SP-536 | #54 | enh | S | sequence release profile | Partial |
| SP-538 | #188 | bug | S | review retry crash_recovered | Closes |
| SP-537 | — | doc | S | CONTEXT Phase 61 capstone | — |

**Release scope ID:** `SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537`

---

## Wave plan snapshot

```text
Wave H0 parallel: SP-530, SP-532, SP-533, SP-538
Wave H1: SP-531
Wave H2: SP-535
Wave H3: SP-536
Wave H4: SP-534
Wave H5: SP-537
```

Run `spine plan SP-530,SP-531,SP-532,SP-533,SP-534,SP-535,SP-536,SP-538,SP-537` after validate for authoritative waves.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #145–#150 | doc | skill template polish — defer |
| #163 | bug | attached orphan — partial via SP-534 |
| #120–#123, #117 | epic | v2.0.0 |

---

## Risks and blockers

- SP-531 and SP-534 both touch release-operator skill — may serialize after SP-530
- SP-536 depends on landed SP-388 sequence chain
- Proof dry-run required before publish (no npm publish in proof)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
