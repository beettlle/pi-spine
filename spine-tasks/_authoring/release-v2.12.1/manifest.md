# Release manifest — v2.12.1

**Created:** 2026-07-25
**Current version:** 2.12.0
**Target version:** v2.12.1
**Bump type:** patch
**Profile:** patch
**Operator approved scope:** yes (2026-07-25)

---

## Stabilization context

Abandoned unpublished `v3.0.0` attempt (34 local commits) preserved on:

`backup/v3.0.0-abandoned-20260725` @ `c9a799dd`

Local `main` reset to CI-green `origin/main` (`489b615f` + hygiene `d3143dfe`).

**Root causes of the failed major attempt (do not reintroduce):**

1. Started Phase 4 without explicit "approve release scope"
2. Labeled incomplete helpers as shipped (wave strategies / checksum verify unused by production)
3. Journal rewrite-append increased runtime risk without integrity wiring
4. Out-of-scope model-config thrash + flake chase commits mixed into release branch
5. Critical blast radius (54 files) before publish gates

This release is **patch / bugs-only** to restore operator trust.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 1 (QUICK-REFERENCE live wording inside #237) | 1–2 small | PASS |
| Bug fixes | 3 shipped (#237, #224, #227); #226 deferred after regression | 3–5 | PASS |
| Enhancements | **0** | 0 | PASS |
| **Total tasks** | 4 executed; 3 fixes shipped | 5–8 | Operator-approved stabilization exception |

**Profile audit:** PASS

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-687 | #237 | bug | S | Wire `runQuotaProbes` into `spine metrics quota` | Closes #237; includes QUICK-REFERENCE fix |
| SP-688 | #224 | bug | S | Run `worktreeSetupHook` for matrix sub-lanes | Closes #224 |
| SP-689 | #226 | bug | S | Propagate matrix fields through `buildPlan` | Executed in Wave 0, then rolled back during SP-690 recovery because virtual row IDs caused production `task_not_found`; #226 deferred |
| SP-690 | #227 | bug | S | Cap nested matrix concurrency to remaining slots | Closes #227; also restores parent-task planning after SP-689 regression |

**Release scope ID:** `SP-687,SP-688,SP-689,SP-690`

---

## Sequence runner (Phase 4)

```bash
spine tasks validate SP-687 SP-688 SP-689 SP-690
spine plan SP-687,SP-688,SP-689,SP-690
spine run sequence SP-687,SP-688,SP-689,SP-690 --dry-run
spine batch start SP-687,SP-688,SP-689,SP-690 --wave N   # detached
```

**Regression gate** (after each integrate):

```bash
npm run release:check 2>&1 | tee /tmp/pi-spine-post-integrate-wave-${WAVE:-main}.log
test "${PIPESTATUS[0]}" -eq 0
```

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| #237 | bug | SP-687 | create-spine-tasks (lean) |
| #224 | bug | SP-688 | create-spine-tasks (lean) |
| #226 | bug | SP-689 | Deferred to #228-compatible planner/engine design after Wave 1 regression |
| #227 | bug | SP-690 | create-spine-tasks (lean); dep SP-688 |

---

## Wave plan snapshot (expected)

```text
Wave 0 · 3 tasks · 3 lanes in parallel
  Lane 1: SP-687 — Wire runQuotaProbes into spine metrics quota
  Lane 2: SP-688 — Run worktreeSetupHook for matrix sub-lanes
  Lane 3: SP-689 — Propagate matrix fields through buildPlan

Wave 1 · 1 task
  Lane 1: SP-690 — Cap nested matrix concurrency to remaining slots
```

Confirmed via `spine plan SP-687,SP-688,SP-689,SP-690` after packet authoring.

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| Abandoned SP-687–691 on backup branch | enh | Incomplete / unwired; salvage later only with production wiring + approval |
| #226 | bug | SP-689 plan-time virtual row IDs were incompatible with the current parent-task engine; retry with #228 first-class scheduling |
| #120 / #124 / #135 / #213 | enh | P3 enhancements; not patch profile |
| #212 / #211 / #209 / #127 / #43 | enh/epic | Deferred |
| #225 / #228–#232 / #238 | matrix epic / features | After #224/#226/#227 stabilize matrix baseline |
| #120 journal checksums | enh | Prior attempt left verify unused — redesign before shipping |

---

## Risks and blockers

- SP-688 and SP-690 share `src/batch/engine-lanes/matrix*.mjs` — **must serialize** (dependency edge).
- #227 interim throttle may be superseded by #228 first-class row scheduling — document as interim in runbook.
- Do **not** change `.spine/spine-config.json` model pins in this release.
- Do **not** ship helpers without production call sites (lesson from abandoned v3).

---

## Publish checklist (Phase 5–6)

- [x] All release-scoped tasks `.DONE` on `main` (SP-687–690; SP-689 product change rolled back — #226 deferred)
- [x] Post-integrate `release:check` green after **each wave**
- [x] `spine preflight` green (idle; 2026-08-02)
- [x] `npm run release:check` green on final pre-push `HEAD` — log `/tmp/pi-spine-release-check-v2.12.1-final.log` (`release_check_exit=0`; coverage ~89.25%; includes coverage-gate fix `a6d763d1`)
- [ ] CI workflow green on `HEAD` (`gh run list --workflow ci.yml`) — pending after push
- [ ] `git status` clean — pending after push (local was ahead of origin)
- [ ] Operator approved publish bump type: **patch** (2.12.0 → 2.12.1) — reconfirm after coverage-gate commit
- [ ] `npm version patch` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] Close #237, #224, #227 when shipped; keep #226 open/deferred

**Phase 5 note (2026-08-02):** Publish was blocked by V8 under-reporting `extensions/spine/slash-commands.ts` (~19.9% full-suite / ~90% narrow-include). Fixed via isolation re-verify + `tests/metrics` glob wiring (`a6d763d1`).
