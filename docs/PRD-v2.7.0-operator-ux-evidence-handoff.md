# pi-spine v2.7.0 — Operator UX + Evidence Phase B Implementation Handoff

**Document type:** Implementation decomposition spec (spine-ready epic brief)  
**Product:** pi-spine  
**Version:** 2.7.0 Operator UX + Evidence Phase B  
**Last updated:** 2026-07-13  
**Status:** Ready for spine batch execution  

**Epic alias:** Phase 71 — SP-REL270 (SP-649+)

**Prerequisite:** v2.6.0 on `main` and npm (`package.json` `2.6.0`); Phase 70 consumer reliability landed ([`PRD-v2.6.0-consumer-resume-handoff.md`](PRD-v2.6.0-consumer-resume-handoff.md)).

**Release profile:** minor — 7 S-sized tasks; 4 bug tracks (#202 + template/evidence drift + `.gitignore` hygiene); 1 enhancement (#160 Phase B narrow); runbook + CONTEXT docs; detached batches only.

---

## 1. Executive summary

v2.6.0 shipped consumer resume reliability and #160 Phase A (`scripts/` evidence executor). Operators still hit misleading “run `spine init`” when the cwd is wrong (#202), template `testing.*` values use `&&` that evidence rejects, doctor warns about missing `.pi/` in `.gitignore`, and #160 Phase B (allowlisted package-manager chains) remains open.

**v2.7.0** closes those hygiene/UX gaps with a narrow evidence Phase B slice — not the monitoring epic or dashboard DAG.

**Tagline:** *Honest wrong-cwd errors — template/evidence parity — allowlisted `&&` chains — doctor `.gitignore` clean.*

---

## 2. Scope lock

### In scope (Phase 71 — SP-REL270)

| FR | Description |
|----|-------------|
| FR-REL270-01 | Missing-config errors include `$PWD` and suggest cd-to-root **or** `spine init` (#202 partial) |
| FR-REL270-02 | Shared hint + CLI/preflight surfaces that hardcode `spine init` for missing config (#202 close) |
| FR-REL270-03 | Template `testing.*` passes evidence validator (no silent drift vs `evidence-command.mjs`) |
| FR-REL270-04 | Repo `.gitignore` includes `.pi/` so doctor “spine runtime entries” is green |
| FR-REL270-05 | Evidence Phase B narrow: allowlisted `npm`/`node`/`npx`/`pnpm`/`yarn` chains joined by `&&` only (#160 Partial) |
| FR-REL270-06 | Operator runbook for wrong-cwd, Phase B evidence, PATH/`npm link` |
| FR-REL270-07 | CONTEXT Phase 71 capstone + release note; mark v2.6.0 published |

### Deferred (later)

| Item | Rationale |
|------|-----------|
| [#160](https://github.com/beettlle/pi-spine/issues/160) Phase C | `testing.review` slot |
| [#135](https://github.com/beettlle/pi-spine/issues/135) | Dashboard DAG — M UX |
| [#127](https://github.com/beettlle/pi-spine/issues/127) | Mailbox steering |
| [#124](https://github.com/beettlle/pi-spine/issues/124) | Parallel wave strategies |
| [#120](https://github.com/beettlle/pi-spine/issues/120) | Journal SHA-256 integrity |
| [#43](https://github.com/beettlle/pi-spine/issues/43) | Monitoring epic |

### Non-goals

- Full arbitrary shell / unrestricted metacharacters for evidence  
- npm publish without operator approval  
- Attached/`--attached` dogfood (#163)  

---

## 3. Baseline

| Check | Value |
|-------|-------|
| Current version | `2.6.0` (npm + tag) |
| Target | `2.7.0` (minor) |
| Next Task ID (pre-author) | SP-649 |
| Open bugs in scope | #202 (+ template drift, `.gitignore` hygiene) |
| Open enh in scope | #160 Phase B (narrow) |
| Pending SP-* (pre-author) | **0** |

---

## 4. Code anchors

| Concern | Primary files |
|---------|---------------|
| #202 load path | `src/config/spine-config-load.mjs` |
| #202 CLI / discovery | `bin/spine-plan.mjs`, `bin/spine-tasks.mjs`, `src/config/preflight/discovery.mjs` |
| Template / evidence | `templates/spine-config.json`, `src/batch/evidence-command.mjs` |
| `.gitignore` | `.gitignore`, `src/config/spine-init-constants.mjs` (`SPINE_GITIGNORE_ENTRIES`) |
| Docs | `docs/adoption/operator-runbook.md`, `spine-tasks/CONTEXT.md` |

---

## 5. GitHub issue intake

| Issue | Priority | On `main` | v2.7.0 action | Task |
|-------|----------|-----------|---------------|------|
| [#202](https://github.com/beettlle/pi-spine/issues/202) | bug | Open | **Implement** (2×S) | SP-649–650 |
| Template/`&&` drift | bug | — | **Implement** | SP-651 |
| Doctor missing `.pi/` | bug | — | **Implement** | SP-652 |
| [#160](https://github.com/beettlle/pi-spine/issues/160) | enh P3 | Open | **Partial Phase B** | SP-653 |
| #135, #127, #124, #120, #43 | enh/epic | Open | **Defer** | — |

---

## 6. Functional requirements

### FR-REL270-01 — Honest missing-config message (SP-649)

When `.spine/spine-config.json` is missing under the resolved project root, the error must include the current directory (e.g. `$PWD` / resolved root) and suggest changing to the project root **or** running `spine init` here — not bare `spine init` alone.

### FR-REL270-02 — CLI surface parity (SP-650)

`spine plan`, `spine tasks`, and preflight discovery paths that hardcode `suggestedCommand: 'spine init'` for missing config must use the same honest hint. Prefer a small shared helper. **Closes #202** with SP-649.

### FR-REL270-03 — Template evidence parity (SP-651)

`templates/spine-config.json` `testing.build` / `testing.test` must either (a) use Phase-A-safe values (single allowlisted argv or `scripts/…`) that pass today’s evidence validator, or (b) be covered by a regression test that fails if template drifts into rejected metacharacters before Phase B. Prefer (a) so greenfield init works before SP-653 lands.

### FR-REL270-04 — `.pi/` gitignore (SP-652)

Add `.pi/` to the repo `.gitignore` so it matches `SPINE_GITIGNORE_ENTRIES` and `spine doctor` no longer reports “missing 1 entry”.

### FR-REL270-05 — Allowlisted `&&` evidence chains (SP-653)

Extend evidence command parsing/execution so allowlisted package-manager / node executables may be chained with `&&` only (no `;`, `|`, redirects, or `$` expansion). Keep Phase A `scripts/` path. Reject other metacharacters fail-closed. **Partial #160** (Phase C deferred).

### FR-REL270-06 — Runbook (SP-654)

Document wrong-cwd recovery, evidence Phase B chain examples, and PATH/`npm link` / `node bin/spine.mjs` reminders.

### FR-REL270-07 — CONTEXT capstone (SP-655)

Phase 71 table, Next Task ID → SP-656, PRD + manifest links, mark v2.6.0 published in CONTEXT, release note placeholder, deferred backlog.

---

## 7. Task decomposition (SP-REL270 ↔ SP-ID)

| SP-ID | Slug | Mission | Size | Deps | Closes |
|-------|------|---------|------|------|--------|
| SP-649 | wrong-cwd-config-missing-message | FR-REL270-01 | S | — | Partial #202 |
| SP-650 | wrong-cwd-cli-surfaces | FR-REL270-02 | S | SP-649 | **Closes #202** |
| SP-651 | template-evidence-command-drift | FR-REL270-03 | S | — | — |
| SP-652 | gitignore-pi-entry | FR-REL270-04 | S | — | — |
| SP-653 | evidence-allowlisted-npm-chains | FR-REL270-05 | S | — | Partial #160 |
| SP-654 | runbook-v270-operator-ux | FR-REL270-06 | S | SP-649, SP-650, SP-651, SP-653 | — |
| SP-655 | context-phase71-capstone | FR-REL270-07 | S | SP-649–654 | — |

---

## 8. Wave run order

```text
Wave 0 (parallel): SP-649, SP-651, SP-652
Wave 1: SP-650 (deps SP-649), SP-653
Wave 2: SP-654
Cap: SP-655
```

**Regression gate (per integrate):** `npm run release:check` with exit-code verification.

**Release execution:** spine-release-operator **minor** profile — detached batches only.

---

## 9. Exit criteria

- [ ] #202 closed — wrong-cwd message honest across load + CLI surfaces  
- [ ] Template `testing.*` passes evidence validator (regression covered)  
- [ ] Doctor `.gitignore` check green for `.pi/`  
- [ ] #160 Phase B narrow shipped (Phase C remains open)  
- [ ] Runbook + CONTEXT Phase 71 complete; Next Task ID → SP-656  
- [ ] `npm run release:check` green on publish HEAD  
- [ ] **v2.7.0 published** — `npm version minor` (operator-gated)  

---

## 10. Operator gates

1. Approve this PRD + [`spine-tasks/_authoring/release-v2.7.0/manifest.md`](../spine-tasks/_authoring/release-v2.7.0/manifest.md)  
2. Detached batches only (#163 / #185)  
3. Publish only after Phase 5 `release:check` exit 0 + explicit `npm version minor` approval  
