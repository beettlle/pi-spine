# Release manifest — v1.10.1

**Created:** 2026-07-08
**Current version:** 1.10.0
**Target version:** v1.10.1
**Bump type:** patch
**Profile:** patch (stabilization — 4 tasks)
**Operator approved scope:** yes (2026-07-08 — per PRD scope lock)

**Source PRD:** [`docs/PRD-v1.10.1-stabilization-handoff.md`](../../../docs/PRD-v1.10.1-stabilization-handoff.md) (Phase 61b — SP-STAB)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 1–2 | PASS |
| Bug fixes | 3 | 3–5 | PASS |
| Enhancements | 0 | 0 | PASS |
| **Total tasks** | 4 | 4–6 | PASS |

**Profile audit:** PASS with operator override (SP-539 is Size M — PRD-locked stabilization work)

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-539 | #163 | bug | M | attached parent-died guard | Closes |
| SP-540 | #187 | bug | S | validate npm test hardfail | Closes |
| SP-541 | #187 | bug | S | contract-verify npm guard | Hardening |
| SP-542 | — | doc | S | CONTEXT Phase 61b capstone | — |

**Release scope ID:** `SP-539,SP-540,SP-541,SP-542`

---

## GitHub issue intake (2026-07-08)

### In release scope

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| #163 | P1 | Implement | SP-539 |
| #187 | P1 | Strengthen | SP-540, SP-541 |
| #174 | P1 | Close at publish (fixed SP-528) | hygiene |
| #173 | P2 | Close at publish (fixed SP-532) | hygiene |
| #167 | P2 | Close at publish (fixed SP-533) | hygiene |
| #188 | P2 | Close at publish (fixed SP-538) | hygiene |

### Deferred (not added to v1.10.1)

| Issue | Priority | Rationale |
|-------|----------|-----------|
| #185 | doc | Partially addressed SP-534; detached policy landed v1.10.0 |
| #175 | P1 enh | Addressed SP-530 v1.10.0; patch profile = 0 enhancements |
| #156 | P1 enh | Addressed SP-531 v1.10.0 |
| #171 | bug | fileScopeMustChange edge case — defer to v1.11.0+ |
| #169 | enh | Addressed SP-350/351 |
| #117, #120–123 | epic | v2.0+ roadmap per PRD §2 |

**Open P1 after v1.10.1:** 0 (target exit criterion)

---

## Wave plan

| Wave | Tasks | Parallel |
|------|-------|----------|
| S0 | SP-539, SP-540 | Yes |
| S1 | SP-541 | No (dep SP-540) |
| Cap | SP-542 | No (deps SP-539, SP-540) |

```text
Wave S0 parallel: SP-539, SP-540
Wave S1: SP-541
Cap: SP-542
```

---

## Regression gate (per wave integrate)

```bash
npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run release:check
```

---

## Operator gates (human only)

1. Approve release scope manifest
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version patch`
4. GitHub issue cleanup per PRD §11

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #171 | bug | fileScopeMustChange sinceCommit — defer v1.11.0+ |
| v1.11.0 minor | release | PRD §2 non-goal — already-landed P2 fixes |
| v2.0.0 automation proof | epic | Blocked until v1.10.1 exit criteria |

---

## Risks

- SP-539 is Size M — parent PID monitor touches attached engine hot path
- `.pi-smart-router/state.db-{shm,wal}` may block preflight git-clean
- Detached batches only — do not use `--attached` from agent shells (#163)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] `spine preflight` green
- [ ] `npm run release:check` green
- [ ] CI workflow green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: patch
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] GitHub issues #174, #173, #167, #188, #163, #187 closed
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
