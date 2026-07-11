# Release manifest — v2.3.1

**Created:** 2026-07-10
**Current version:** 2.3.0
**Target version:** v2.3.1
**Bump type:** patch
**Profile:** patch (reliability — 5 tasks)
**Operator approved scope:** yes (2026-07-10)

**Source PRD:** [`docs/PRD-v2.3.1-reliability-handoff.md`](../../../docs/PRD-v2.3.1-reliability-handoff.md) (Phase 66 — SP-REL231)

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 | 1–2 | PASS |
| Bug fixes | 4 | 3–5 | PASS |
| Enhancements | 0 | 0 | PASS |
| **Total tasks** | 5 | 5–8 | PASS |

**Profile audit:** PASS

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-608 | #195 | bug | S | diagnose gate-ready headline | Closes |
| SP-609 | #194 | bug | S | worker tree terminate | Closes |
| SP-610 | #191 | bug | S | lane orch sync before start | Closes (sync only) |
| SP-611 | #192 | bug | S | loc-capstone readiness gate | Closes |
| SP-612 | — | doc | S | CONTEXT Phase 66 capstone | — |

**Release scope ID:** `SP-608,SP-609,SP-610,SP-611,SP-612`

---

## GitHub issue intake (2026-07-10)

### In release scope

| Issue | Priority | Action | Task |
|-------|----------|--------|------|
| #195 | bug | Implement | SP-608 |
| #194 | bug P2 | Implement | SP-609 |
| #191 | bug | Implement | SP-610 |
| #192 | bug | Implement | SP-611 |

### Deferred (not added to v2.3.1)

| Issue | Type | Rationale |
|-------|------|-----------|
| #193 | enh | Operator deferred to next minor |
| #160, #135, #127–#120, #124–#126, #43 | enh/epic | Patch profile = 0 enhancements |
| SP-602, SP-605 | pending split | Leftover v2.3.0 LOC work; out of reliability scope |

---

## Wave plan snapshot

```text
Spine plan — ids
5 task(s) · 2 wave(s) · maxParallel 4

Wave 0 · 4 tasks · 4 lanes in parallel
  Lane 1: SP-608 — Diagnose gate-ready headline
  Lane 2: SP-609 — Worker tree terminate
  Lane 3: SP-610 — Lane orch sync before start
  Lane 4: SP-611 — LOC capstone readiness gate

Wave 1 · 1 task
  Lane 1: SP-612 — CONTEXT Phase 66 capstone
```

**Validate:** `Validated 5 task(s): 5 passed, 0 failed` (2026-07-10)  
**Analyze:** 0 blocking; 1 unrelated warning (missing historical `_explore/engine-lanes-split/findings.md` CONTEXT ref)
---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-608 SP-609 SP-610 SP-611 SP-612
spine plan SP-608,SP-609,SP-610,SP-611,SP-612
spine run sequence SP-608,SP-609,SP-610,SP-611,SP-612 --dry-run
spine run sequence SP-608,SP-609,SP-610,SP-611,SP-612
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

**Operator gates:**

1. Approve this manifest — **done** (2026-07-10)
2. `spine gate approve` per integrate wave
3. Publish approval before `npm version patch`

---

## Gaps requiring new packets

| Issue | Bucket | SP-ID | Author with |
|-------|--------|-------|-------------|
| #195 | bug | SP-608 | create-spine-tasks (lean) |
| #194 | bug | SP-609 | create-spine-tasks (lean) |
| #191 | bug | SP-610 | create-spine-tasks (lean) |
| #192 | bug | SP-611 | create-spine-tasks (lean) |
| CONTEXT | doc | SP-612 | create-spine-tasks (lean) |

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #193 | enh | Next minor — create-spine-tasks DoR |
| #160 | enh P3 | stet gate evidence |
| #135 | enh | Dashboard DAG |
| #120–#127 | enh | Gate maturity / mailbox |
| #43 | epic | Monitoring toolkit |
| SP-602, SP-605 | split | Finish outside release scope if still pending |

---

## Risks and blockers

- SP-610 touches lane start path — keep File Scope off diagnosis/worker-host to preserve Wave 0 parallelism
- SP-611 must not re-open grandfather list or edit SP-593
- Dirty tree may include GitNexus `AGENTS.md` / `CLAUDE.md` / rules-manifest — do not include in task File Scope (#149)

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave**
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] CI workflow green on `HEAD` before tag
- [ ] `git status` clean
- [ ] Operator approved publish bump type: **patch**
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Close #191, #192, #194, #195 with landed SHAs
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
