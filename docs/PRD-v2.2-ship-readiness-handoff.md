# pi-spine v2.2 — Ship Readiness & Exceed-Inspirations Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.2 Ship Readiness  
**Last updated:** 2026-06-12  
**Status:** Ready for `create-spine-tasks` decomposition  

**Epic alias:** Phase 23–26 — SP-SHIP (SP-205–SP-226)

**Prerequisite:** Phase 22b complete (SP-204 on `main`).

**Publish policy:** npm execution is deferred to **Phase 26** only. Phases 23–25 improve quality and proof; publish is a consequence of passing exit gates, not a shortcut to adoption.

---

## 1. Executive summary

pi-spine v2.1 (Phase 22) delivered journal-derived reconciliation, real-pi CI scaffolding, agentSession doctor checks, and npm publish **prep**. A consolidated brutal audit (2026-06-12) graded the project **B–B+**: architecturally on-target for batch orchestration + audit journal + human gates + Taskplane packets, but **not yet the default choice** over Taskplane, Babysitter, or pi-conductor.

Remaining gaps fall into three buckets before distribution:

| Bucket | Problem | Phase |
|--------|---------|-------|
| **Trust & maintainability** | God-module concentration (`engine-lanes.mjs` 1,875 LOC), soft real-pi CI, operator doc drift | 23 (P0) |
| **Prove & parity** | No filled Tier-3 consumer pilot, thin extension test coverage, dashboard UX gap vs Taskplane | 24 (P1) |
| **Differentiation** | Journal structural rebuild deferred from v2.1; supervisor/worker-gate stories unresolved | 25 (P2) |
| **Distribution** | npm publish prep exists; execution blocked until above gates pass | 26 (publish) |

**Tagline:** *Green CI, split the engine, prove on a real repo, then publish.*

Base PRD v1.2 ([docs/PRD.md](PRD.md)) remains authoritative for unlisted behavior.

---

## 2. Scope lock

### In scope

| FR | Phase | Requirement |
|----|-------|-------------|
| FR-SHIP-01 | 23 | CI trust — full stub suite green including SAT-020 stall replay contract |
| FR-SHIP-02 | 23 | Strangler Fig split of `engine-lanes.mjs` into focused modules (≤500 LOC each) |
| FR-SHIP-03 | 23 | Real-pi CI blocking when `pi` is on runner; documented skip when absent |
| FR-SHIP-04 | 23 | Operator docs single source of truth — fix CONTEXT and readiness drift |
| FR-SHIP-05 | 24 | Filled Tier-3 consumer pilot sign-off on external repo |
| FR-SHIP-06 | 24 | Extension integration tests; slash-command line coverage ≥70% |
| FR-SHIP-07 | 24 | Dashboard parity — gate status, diagnosis headline, journal tail on default view |
| FR-SHIP-08 | 24 | Operator audit export — `spine journal export` (see §2.1) |
| FR-SHIP-09 | 24 | Promote or explicitly defer `agentSession` worker backend after dogfood |
| FR-SHIP-10 | 25 | Journal structural rebuild without cache seed (PRD §11.4 v2.2) |
| FR-SHIP-11 | 25 | Supervisor story — runbook + dashboard defer or minimal v1.1 monitor |
| FR-SHIP-12 | 25 | Merger/conflict UX spike or documented Taskplane-parity defer |
| FR-SHIP-13 | 25 | Worker manual gate — implement or document permanent `not_supported` |
| FR-SHIP-14 | 26 | npm publish + pi.dev listing after Phase 23–25 exit criteria and human sign-off |

### FR-SHIP-08 design decision

**Chosen:** Extend existing journal CLI with export for operators and post-mortems.

```bash
spine journal export --batch <batchId> [--format markdown|jsonl] [--output path]
```

**Acceptance criteria:**

- Reads `.spine/runtime/<batchId>/journal/events.jsonl` (or discovers active batch when omitted)
- Markdown format produces human-readable timeline suitable for incident reports and consumer pilot evidence
- Exit non-zero when batch journal missing
- Regression test covers markdown output shape

**Rejected alternative:** `spine pr ready` — overlaps pi-conductor PR tooling scope; pi-spine v2.2 targets audit export and integrate evidence, not GitHub PR automation. Revisit post-v2.2 if operators request PR-centric flows.

### FR-SHIP-11 design decision

**Default (lower scope):** Document explicit defer — supervisor mail and autonomous monitor agent remain out of v2.2; operators use `spine status --diagnose`, dashboard diagnosis banner, and runbook recovery paths.

**Stretch (optional SP-SHIP task):** Minimal supervisor session that polls batch health and journals `supervisor.nudge` events — only if FR-SHIP-07 dashboard parity is insufficient in consumer pilot feedback.

### Deferred (v2.3+ unless product pivot)

- Cross-harness routing (Cursor, Codex, Gemini) — base PRD §4.2 non-goal
- Polyrepo segment DAG, supervisor mail, merger LLM agent
- `pi-subagents` in-lane fanout (base PRD §3.4)
- `spine settings suggest-models` (v1.4 tracked item)
- `spine pr ready` / GitHub PR automation

### Non-goals

- Rewriting [docs/PRD.md](PRD.md) body
- Running `npm publish` before Phase 26 human sign-off
- Replacing Taskplane runtime or Babysitter SDK
- Forking three inspiration products into a monolith

---

## 3. Baseline — already landed (do not re-implement)

Verified on `main` at PRD authoring time (2026-06-12):

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `SPINE_WORKER_STUB=1 npm test` | **765 pass / 0 fail** (includes SAT-020 integration test) |
| `npm run coverage:check` | Pass (~84% line, threshold 77%) |

Phase 22 delivered prep and partial implementations. Phase 23–26 tasks **close gaps**, not redo closed work:

| Already done | Reference | Remaining gap |
|--------------|-----------|---------------|
| npm publish **prep** checklist | SP-187, [docs/release/v1.0-checklist.md](release/v1.0-checklist.md) | Execution deferred to FR-SHIP-14 |
| Consumer pilot **template** | SP-180, FR-REL-07 | No filled instance on external repo (FR-SHIP-05) |
| Journal rebuild (task status) | SP-174, `src/batch/journal-rebuild.mjs` | Structural rebuild without cache seed (FR-SHIP-10) |
| Real-pi workflow (soft gate) | SP-178, [`.github/workflows/real-pi.yml`](../.github/workflows/real-pi.yml) | `continue-on-error: true` (FR-SHIP-03) |
| agentSession doctor/preflight | SP-181 | Dogfood land-loop sign-off incomplete (FR-SHIP-09) |
| SAT-020 fixture + integration test | SP-060 | Maintain green on `main`; guard in CI (FR-SHIP-01) |
| `engine-lanes.mjs` | Phase 3–22 feature accretion | **1,875 LOC** — split required (FR-SHIP-02) |

**Audit note:** One best-of-n audit run reported SAT-020 failure on a stale worktree; `main` at authoring time is green. FR-SHIP-01 requires CI to stay green and SAT-020 contract documented in runbook.

---

## 4. Functional requirements (acceptance detail)

### Phase 23 — P0: Trust & maintainability

#### FR-SHIP-01 — CI trust

- `npm run typecheck && SPINE_WORKER_STUB=1 npm test` exits 0 on `main`
- `tests/batch/stall-sat020-integration.test.mjs` asserts sequence: `lane.checkpoint_warning` → stall kill → salvage → `task.failed`
- No new empty catch blocks or TODO/FIXME in `src/` from ship-epic changes

#### FR-SHIP-02 — Engine lanes strangler split

- Extract from `src/batch/engine-lanes.mjs` into `src/batch/engine-lanes/` (or equivalent) with modules such as:
  - Wave/tick scheduling
  - Lane queue and provisioning
  - Review-phase wiring
  - Merge-phase wiring
- No file under `src/batch/` exceeds **500 lines** after split (except generated/vendor if any)
- All existing batch integration tests pass without behavior change
- Explore artifact: `spine-tasks/_explore/engine-lanes-split/findings.md` before first split PR

#### FR-SHIP-03 — Real-pi CI hardening

- When `pi` is on CI runner and `./scripts/real-pi-adoption-e2e.sh --batch` fails, workflow **fails** (remove advisory-only posture)
- When `pi` is absent, workflow documents skip with explicit message (current behavior acceptable)
- Operator runbook section updated with CI expectations

#### FR-SHIP-04 — Doc sync

- [spine-tasks/CONTEXT.md](../spine-tasks/CONTEXT.md): header reflects Phases 0–22b Done; priority backlog marks completed items Done (not Staged)
- [docs/adoption/real-project-readiness.md](adoption/real-project-readiness.md): test counts and phase status match reality (~765 tests)
- Technical debt section removes entries for tasks already on `main`

### Phase 24 — P1: Prove & parity

#### FR-SHIP-05 — Tier-3 consumer pilot

- Filled report committed as named instance (e.g. `docs/adoption/consumer-pilot-report-YYYY-MM-DD.md`), not template placeholders
- External consumer repo (not pi-spine dogfood only)
- Includes: stub batch, real-pi batch, land loop, at least one recovery path, journal excerpt
- Closes FR-REL-07 operationally (template was SP-180)

#### FR-SHIP-06 — Extension tests

- Integration tests for `/spine-*` slash command handlers in `extensions/spine/slash-commands.ts`
- Line coverage for `extensions/spine/slash-commands.ts` ≥ **70%** (enforced in coverage config or documented gate)

#### FR-SHIP-07 — Dashboard parity

- Default dashboard view shows: integrate gate status (when applicable), reconciliation `headline` / `suggestedCommand`, journal tail or link
- Matches operator runbook land-loop visibility without requiring `--diagnose`

#### FR-SHIP-08 — Journal export

- See §2.1 design decision
- Wired from `bin/spine-journal.mjs` or sibling subcommand
- Documented in operator runbook and README feature summary

#### FR-SHIP-09 — agentSession promotion

- Complete [docs/compatibility/agent-session-dogfood-report.md](compatibility/agent-session-dogfood-report.md) with land-loop sign-off **or**
- Record explicit decision: subprocess `pi -p` remains default with rationale in dogfood report and runbook
- Doctor/preflight reflects chosen default

### Phase 25 — P2: Differentiation

#### FR-SHIP-10 — Journal structural rebuild

- Extend `rebuildBatchStateFromJournal()` to derive structural batch fields without cache seed where PRD §11.4 v2.2 specifies
- Regression tests on incident fixtures; document limitations vs Babysitter full replay
- If scope exceeds one M-task, split with explicit v2.3 deferral recorded in CONTEXT

#### FR-SHIP-11 — Supervisor story

- Per §2.1: runbook + README state supervisor is deferred; dashboard + diagnose are primary monitor surfaces
- Optional stretch: minimal monitor — separate task, not blocking publish

#### FR-SHIP-12 — Merger/conflict UX

- Spike or runbook section: manual conflict resolution during `spine integrate` when merge conflicts occur
- Document Taskplane merger-agent as explicit non-goal unless spike proves minimal UX is insufficient

#### FR-SHIP-13 — Worker manual gate

- Either wire `spine_request_gate` for supported manual gate kinds **or**
- Document permanent `not_supported` in worker tool, runbook, and README with operator workaround (`spine gate approve` from host)

### Phase 26 — Publish (final step only)

#### FR-SHIP-14 — npm publish

- All Phase 23–25 exit criteria (§6) checked
- [docs/release/v1.0-checklist.md](release/v1.0-checklist.md) complete including dry-run `npm pack`
- **Human operator approval** recorded before `npm publish --access public`
- Version bump decision documented (`0.1.0` vs `1.0.0`)
- Post-publish smoke per checklist §Post-publish smoke
- pi.dev listing fields prepared

**Do not run `npm publish` without explicit human approval.**

---

## 5. Code anchors

| Concern | Primary files |
|---------|---------------|
| Engine lanes (split target) | `src/batch/engine-lanes.mjs` → `src/batch/engine-lanes/` |
| Review phase | `src/batch/review.mjs` (906 LOC — split candidate after engine-lanes) |
| Heartbeat / SAT-020 | `src/batch/heartbeat.mjs`, `tests/batch/stall-sat020-integration.test.mjs` |
| Journal | `src/batch/journal.mjs`, `src/batch/journal-rebuild.mjs`, `bin/spine-journal.mjs` |
| Reconcile / diagnose | `src/batch/reconcile.mjs`, `src/batch/diagnosis.mjs` |
| Gates / evidence | `src/batch/gate.mjs`, `src/batch/evidence.mjs` |
| Dashboard | `src/dashboard/snapshot.mjs`, `src/dashboard/public/` |
| Extension | `extensions/spine/slash-commands.ts`, `extensions/spine-orchestrator.ts` |
| agentSession | `src/batch/agent-session-worker.mjs`, `src/config/worker-backend.mjs` |
| Worker tools | `src/worker-tools/request-gate.mjs` |
| Real-pi CI | `.github/workflows/real-pi.yml`, `scripts/real-pi-adoption-e2e.sh` |
| Adoption | `docs/adoption/consumer-pilot-report-template.md`, `docs/adoption/operator-runbook.md` |
| Publish | `docs/release/v1.0-checklist.md`, `docs/release/npm-publish.md`, `package.json` |
| Incidents | `tests/fixtures/incidents/`, `docs/incidents/` |

---

## 6. Task decomposition (SP-SHIP ↔ SP-205+)

Provisional table for `create-spine-tasks` — PROMPT.md bodies are created in a follow-on step.

| SP-SHIP | SP-ID | Slug | Phase | Mission | Deps |
|---------|-------|------|-------|---------|------|
| 001 | SP-205 | ship-handoff-doc | 23 | Land this PRD; cross-links | SP-204 |
| 002 | SP-206 | ship-ci-trust-guard | 23 | SAT-020 + CI regression guard | SP-205 |
| 003 | SP-207 | ship-engine-lanes-explore | 23 | `_explore/engine-lanes-split/findings.md` | SP-205 |
| 004 | SP-208 | ship-engine-lanes-schedule | 23 | Extract wave/tick scheduling module | SP-207 |
| 005 | SP-209 | ship-engine-lanes-queue | 23 | Extract lane queue / provisioning | SP-208 |
| 006 | SP-210 | ship-engine-lanes-review | 23 | Extract review-phase wiring | SP-209 |
| 007 | SP-211 | ship-engine-lanes-merge | 23 | Extract merge-phase wiring; delete god file | SP-210 |
| 008 | SP-212 | ship-real-pi-ci-hard | 23 | Blocking real-pi CI | SP-206 |
| 009 | SP-213 | ship-doc-sync | 23 | CONTEXT + readiness refresh | SP-205 |
| 010 | SP-214 | ship-phase23-exit | 23 | Verify §6 Phase 23 exit criteria | SP-211, SP-212, SP-213 |
| 011 | SP-215 | ship-consumer-pilot | 24 | Filled Tier-3 pilot report | SP-214 |
| 012 | SP-216 | ship-extension-tests | 24 | Slash-command integration tests ≥70% | SP-214 |
| 013 | SP-217 | ship-dashboard-parity | 24 | Gate + diagnosis + journal on default view | SP-214 |
| 014 | SP-218 | ship-journal-export | 24 | `spine journal export` CLI | SP-214 |
| 015 | SP-219 | ship-agentsession-decision | 24 | Dogfood sign-off or defer decision | SP-214 |
| 016 | SP-220 | ship-phase24-exit | 24 | Verify §6 Phase 24 exit criteria | SP-215–219 |
| 017 | SP-221 | ship-journal-structural | 25 | FR-SHIP-10 structural rebuild | SP-220 |
| 018 | SP-222 | ship-supervisor-defer | 25 | Runbook + README supervisor story | SP-220 |
| 019 | SP-223 | ship-merger-spike | 25 | Integrate conflict UX or defer doc | SP-220 |
| 020 | SP-224 | ship-worker-gate-story | 25 | Implement or document request-gate limit | SP-220 |
| 021 | SP-225 | ship-phase25-exit | 25 | Verify §6 Phase 25 exit criteria | SP-221–224 |
| 022 | SP-226 | ship-npm-publish | 26 | Execute publish after human gate | SP-225 |

---

## 7. Wave run order

```text
SP-204 (done)
  └── SP-205 (handoff doc)
        ├── SP-206 (CI trust)
        ├── SP-207 (explore engine-lanes)
        │     └── SP-208 → SP-209 → SP-210 → SP-211 (serial split)
        ├── SP-212 (real-pi CI) — after SP-206
        └── SP-213 (doc sync)
              └── SP-214 (Phase 23 exit)
                    ├── SP-215 (consumer pilot)
                    ├── SP-216 (extension tests)
                    ├── SP-217 (dashboard)
                    ├── SP-218 (journal export)
                    └── SP-219 (agentSession)
                          └── SP-220 (Phase 24 exit)
                                ├── SP-221 (journal structural)
                                ├── SP-222 (supervisor defer)
                                ├── SP-223 (merger spike)
                                └── SP-224 (worker gate)
                                      └── SP-225 (Phase 25 exit)
                                            └── SP-226 (npm publish — human gate)
```

### Suggested batches (≤3 tasks)

| Batch | Tasks |
|-------|-------|
| 1 | SP-205 |
| 2 | SP-206, SP-213 |
| 3 | SP-207 |
| 4–7 | SP-208, SP-209, SP-210, SP-211 (serial — same file-scope overlap) |
| 8 | SP-212, SP-214 |
| 9 | SP-215 |
| 10 | SP-216, SP-217 |
| 11 | SP-218, SP-219 |
| 12 | SP-220 |
| 13–16 | SP-221, SP-222, SP-223, SP-224 |
| 17 | SP-225 |
| 18 | SP-226 (operator-attached; human approval required) |

**Regression gate (every batch):** `npm run typecheck && SPINE_WORKER_STUB=1 npm test && npm run coverage:check`

**Real-pi gate (Phase 23+ batches touching engine/worker):** `unset SPINE_WORKER_STUB && ./scripts/real-pi-adoption-e2e.sh --batch`

---

## 8. Phase exit criteria

### Phase 23 exit (blocks P1)

- [x] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` — zero failures
- [x] No `src/batch/*.mjs` file >500 lines (grandfather list in `spine verify phase23-exit`; `engine-lanes.mjs` ≤500 LOC)
- [x] Real-pi workflow fails CI when `pi` present and E2E fails; skip documented when absent
- [x] CONTEXT.md header and priority backlog aligned with Phases 0–22b Done
- [x] `real-project-readiness.md` test counts accurate

### Phase 24 exit (blocks P2 and publish)

- [ ] Filled consumer pilot report committed under `docs/adoption/`
- [ ] `extensions/spine/slash-commands.ts` line coverage ≥70%
- [ ] Dashboard default view shows gate + diagnosis + journal affordance
- [ ] `spine journal export` documented and tested
- [ ] agentSession decision recorded in dogfood report + runbook

### Phase 25 exit (blocks publish)

- [ ] FR-SHIP-10 implemented or deferred to v2.3 with technical reason in CONTEXT
- [ ] Supervisor defer documented (or minimal monitor shipped)
- [ ] Merger/conflict path documented or spike complete
- [ ] Worker gate story resolved (implement or permanent limitation)

### Phase 26 publish gate (human-only)

- [ ] All Phase 23–25 checkboxes above green
- [ ] [docs/release/v1.0-checklist.md](release/v1.0-checklist.md) Pre-release + Dry-run pack complete
- [ ] Operator explicit approval recorded
- [ ] Version bump decision documented
- [ ] Post-publish smoke executed

---

## 9. Success metrics

| ID | Metric | Verification |
|----|--------|--------------|
| M-SHIP-01 | SAT-020 replay contract | `tests/batch/stall-sat020-integration.test.mjs` |
| M-SHIP-02 | Engine module size | No `src/batch/*.mjs` >500 LOC; optional CI script |
| M-SHIP-03 | Real-pi blocking CI | `.github/workflows/real-pi.yml` behavior + script exit codes |
| M-SHIP-04 | External consumer pilot | Named file under `docs/adoption/` with sign-off section |
| M-SHIP-05 | Extension coverage | Coverage report ≥70% on `slash-commands.ts` |
| M-SHIP-06 | Journal export | New test + runbook section |
| M-SHIP-07 | Publish smoke | v1.0 checklist §Post-publish smoke |

---

## 10. Exceed-inspirations acceptance narrative (Phase 26)

Publish is allowed when this narrative is **true with evidence**, not aspirational:

| vs Inspiration | pi-spine must demonstrate |
|----------------|---------------------------|
| **Taskplane** | Same packet format + waves/lanes + comparable daily batch reliability; **plus** formal integrate gates, journal replay/export, reconciliation UX |
| **Babysitter** | pi-native packets + worktree lanes + boundary journal export; **honest limit:** not full cross-harness deterministic replay |
| **pi-conductor** | In-repo task artifacts + evidence gates + credible `pi install npm:pi-spine` path; **honest limit:** not external tool-DB control plane |

---

## Appendix A — Brutal audit traceability

Maps consolidated best-of-n audit priorities to FR-SHIP IDs.

| Audit priority | FR-SHIP | Phase |
|----------------|---------|-------|
| npm publish (reordered to **last**) | FR-SHIP-14 | 26 |
| Split `engine-lanes.mjs` | FR-SHIP-02 | 23 |
| Harden real-pi CI | FR-SHIP-03 | 23 |
| SAT-020 / CI green | FR-SHIP-01 | 23 |
| Refresh CONTEXT + readiness docs | FR-SHIP-04 | 23 |
| Tier-3 consumer pilot | FR-SHIP-05 | 24 |
| Extension integration tests | FR-SHIP-06 | 24 |
| Dashboard parity pass | FR-SHIP-07 | 24 |
| Journal export / PR readiness | FR-SHIP-08 | 24 |
| Promote agentSession backend | FR-SHIP-09 | 24 |
| Journal structural rebuild v2.2 | FR-SHIP-10 | 25 |
| Supervisor-lite or defer doc | FR-SHIP-11 | 25 |
| Merger/conflict UX | FR-SHIP-12 | 25 |
| Worker manual gate story | FR-SHIP-13 | 25 |

---

## Appendix B — Related documents

| Doc | Role |
|-----|------|
| [docs/PRD.md](PRD.md) | Base spec v1.2 |
| [docs/PRD-v2.1-reliability-handoff.md](PRD-v2.1-reliability-handoff.md) | Phase 22 predecessor |
| [docs/release/v1.0-checklist.md](release/v1.0-checklist.md) | Publish execution checklist |
| [docs/adoption/operator-runbook.md](adoption/operator-runbook.md) | Daily operator procedures |
| [docs/features/stall-recovery-improvements-brief.md](features/stall-recovery-improvements-brief.md) | SAT-020 context |
| [skills/create-spine-tasks/SKILL.md](../skills/create-spine-tasks/SKILL.md) | Task decomposition workflow |

---

## Appendix C — Follow-on decomposition prompt

```text
Use the create-spine-tasks skill to break docs/PRD-v2.2-ship-readiness-handoff.md into M-sized SP-* tasks under spine-tasks/. Update CONTEXT.md and dependencies.json.
```
