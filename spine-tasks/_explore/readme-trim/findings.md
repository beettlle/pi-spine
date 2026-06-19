# Explore: readme-trim

**Date:** 2026-06-18  
**Status:** complete

## Summary

Root `README.md` is **618 lines** — 3.4× the Phase 33 target (≤180). Roughly **70%** is operator manual under `## Quick start` (lines 208–524) plus positioning comparisons (lines 11–97). SP-301 should extract comparisons to `docs/adoption/why-pi-spine.md`; SP-302 should slim README to Taskplane-style onboarding; SP-303 should gap-fill canonical docs where README detail is not already covered.

## Baseline metrics

| Metric | Value |
|--------|-------|
| `wc -l README.md` | **618** |
| Target budget (SP-305 exit) | **≤180** lines |
| Lines to remove (approx.) | **~440** |
| `##` sections | 16 |
| `###` sections | 19 (11 under Quick start) |
| PRD ID / spec refs (`FR-`, `GAP-`, `NFR-`, `§`) | **32** line hits (see inventory) |

## Version drift

| Location | Label | Notes |
|----------|-------|-------|
| `README.md` L118 | **Honest limits (v2.2)** | Product capability framing |
| `README.md` L581 | **Project status v1.0.2** | npm/pi.dev release version |
| `package.json` | **`"version": "1.0.2"`** | Canonical semver — aligns with Project status |
| `README.md` L595 | PRD link says **v1.2** | Doc index drift (SP-304) |

**Recommendation:** README should cite **package.json semver only** (v1.0.2 today). Drop v2.2 from README body or replace with a single “capabilities as of …” link to `docs/PRD-v2.2-ship-readiness-handoff.md` in docs, not the onboarding page.

## PRD ID grep inventory

Command: `rg 'FR-|GAP-|NFR-|§' README.md`

| Line | Match context |
|------|----------------|
| 135 | `FR-SHIP-11` (Honest limits stretch) |
| 202 | `FR-WORK-05` (Cursor rules auto-select) |
| 204 | `FR-REV-08` (rules select reviewer) |
| 222 | `FR-BATCH-11` (preflight required) |
| 237 | `FR-CFG-03` (Settings heading) |
| 252 | `FR-BATCH-12–14` (reconciliation) |
| 258 | `NFR-OBS-05` (status --verbose) |
| 261 | `§18.3`, `FR-BATCH-13` (diagnosis taxonomy) |
| 267 | `FR-BATCH-15–16`, `§18.6` (dismiss/complete) |
| 272 | `FR-BATCH-16` |
| 273 | `FR-INT-01` |
| 297 | `NFR-OBS-03` (evidence summary) |
| 312 | `FR-SCHED-01–06` (wave planning) |
| 331 | `FR-BATCH-11` |
| 337 | `PRD §15.2` |
| 345 | `FR-SCHED-03/04`, `FR-BATCH-08`, `§17.4`, `GAP-MERGE-01` |
| 353 | `FR-REV`, `TP-020` (step review heading) |
| 365 | `FR-REV-06` |
| 369 | `PRD §14.5` (worker tools heading) |
| 375 | runbook `§5.1` anchor (operator doc, OK to keep in docs) |
| 393 | `§18.6` (abort heading) |
| 395 | `GAP-ABORT-01` |
| 412 | `GAP-RETRY-01` |
| 416 | `FR-BATCH-10` |
| 417 | `§17.4` |
| 458 | `TP-013`, `§18.4` (heartbeat) |
| 478 | `FR-BATCH-14` (slash table) |
| 497 | `FR-BATCH-11` |
| 522 | `NFR-OBS-02`, `NFR-OBS-04`, `GAP-UX-03` (dashboard SSE) |

**SP-305 exit:** zero `FR-` / `GAP-` / `NFR-` / bare `§` in README.

## Heading map (line ranges)

### Top-level (`##`)

| Lines | Section | Action | Destination / notes |
|-------|---------|--------|---------------------|
| 1–9 | Title, badge, one-liner | **keep** | Trim to ≤3 sentences after SP-302 |
| 11–25 | Why this exists | **move** | `docs/adoption/why-pi-spine.md` (SP-301) — problem statement |
| 27–37 | What pi-spine is (and is not) | **keep** | Compact table; SP-302 target ~12 lines |
| 41–97 | Advantages over using the others directly | **move** | `docs/adoption/why-pi-spine.md` (SP-301) — replace with “Inspired by” link (SP-302) |
| 101–115 | Feature summary | **keep** | Short bullets + PRD link → doc table in SP-302 |
| 118–136 | Honest limits (v2.2) | **trim** | 2–3 lines + link `docs/adoption/operator-runbook.md`; drop `FR-SHIP-11` from README |
| 139–146 | Prerequisites | **keep** | Table stays |
| 149–206 | Adoption | **trim** | Keep install snippet + adoption doc table; drop subsections to docs |
| 208–524 | Quick start | **trim** | Numbered 5-step quickstart only (~35 lines); move all `###` children |
| 526–564 | Best-of-N (dev script) | **trim** | **SP-276 / SP-302:** link-only (~5 lines) → `docs/QUICK-REFERENCE.md` dev-scripts + `scripts/best-of-n.mjs` |
| 566–576 | Migrating from Taskplane | **keep** | Short numbered list; optional link to `bootstrap-checklist.md` |
| 579–581 | Project status | **keep** | Single version line from `package.json` |
| 583–588 | Continuous integration | **trim** | One line + link `.github/workflows/ci.yml` / `docs/release/npm-publish.md` |
| 591–602 | Documentation | **keep** | SP-304 expands index |
| 605–607 | License | **keep** | |
| 611–618 | Related projects | **trim** | Merge into “Inspired by” or 4-link footer |

### Under `## Adoption` (`###`)

| Lines | Section | Action | Destination |
|-------|---------|--------|-------------|
| 168–179 | Task authoring (`create-spine-tasks` skill) | **move** | `docs/adoption/bootstrap-checklist.md` (already references skill; absorb example prompt) |
| 181–205 | Cursor rules (contributors) | **move** | `docs/design/cursor-rules-discovery.md` (+ optional `CONTRIBUTING` pointer in SP-304) |

### Under `## Quick start` (`###`)

| Lines | Section | Action | Destination |
|-------|---------|--------|-------------|
| 237–248 | Settings (FR-CFG-03) | **move** | `docs/QUICK-REFERENCE.md` § settings (exists L114–124) |
| 250–263 | Batch status and reconciliation | **move** | `docs/QUICK-REFERENCE.md` + `docs/adoption/operator-runbook.md` § diagnose |
| 265–308 | Batch dismiss, complete, next action | **move** | `docs/adoption/operator-runbook.md` land loop (verify completeness SP-303) |
| 310–324 | Wave planning | **move** | `docs/QUICK-REFERENCE.md` plan + `docs/EXECUTION-FLOW.md` waves/lanes/ticks |
| 326–351 | Running a batch (Phase 2–5) | **trim** | README: `preflight` → `batch start` → `status`; detail → `EXECUTION-FLOW.md` |
| 353–367 | Step review (FR-REV, TP-020) | **move** | `docs/QUICK-REFERENCE.md` review section |
| 369–375 | Worker Pi tools (PRD §14.5) | **move** | `docs/design/worker-gate-inventory.md` + runbook §5.1 |
| 377–391 | Pause and resume | **move** | `docs/QUICK-REFERENCE.md` batch control |
| 393–408 | Abort | **move** | `docs/QUICK-REFERENCE.md` + `EXECUTION-FLOW.md` error recovery |
| 410–438 | Retry and skip + runtime layout | **move** | `docs/QUICK-REFERENCE.md` + runbook recovery tree |
| 440–522 | Journal replay, CI stub, heartbeat, slash table, dashboard | **move** | Journal/state → QUICK-REFERENCE; slash table → QUICK-REFERENCE § slash; dashboard SSE → runbook or EXECUTION-FLOW (SP-303 gap-fill) |

### Under `## Advantages` (`###`)

| Lines | Section | Action | Destination |
|-------|---------|--------|-------------|
| 43–54 | vs Taskplane alone | **move** | `docs/adoption/why-pi-spine.md` |
| 56–67 | vs Babysitter alone | **move** | `docs/adoption/why-pi-spine.md` |
| 69–80 | vs pi-conductor alone | **move** | `docs/adoption/why-pi-spine.md` |
| 82–97 | The combined picture | **move** | `docs/adoption/why-pi-spine.md` (ASCII diagram) |

## Canonical doc coverage (pre-absorption)

| README topic | Already in docs? | Gap for SP-303 |
|--------------|------------------|----------------|
| Preflight check table | QUICK-REFERENCE partial | Verify table parity |
| Diagnosis taxonomy | QUICK-REFERENCE + runbook | Strip IDs from README only |
| Gate / integrate / limbo | runbook land loop | Confirm limbo playbook |
| Waves / lanes / ticks | EXECUTION-FLOW | README prose is richer — ensure EXECUTION-FLOW has scheduling paragraph |
| Dashboard SSE panels | runbook light | Add dashboard subsection if missing |
| `SPINE_WORKER_STUB` | QUICK-REFERENCE troubleshooting | Verify |
| Best-of-N CLI detail | **missing** | Add QUICK-REFERENCE dev-scripts (SP-303) |
| Cursor rules table | cursor-rules-discovery | Move table there or link only |

## SP-302 slim README sketch (≤180 lines)

Proposed outline (~170 lines):

1. Title + badge + 2-sentence pitch (10)
2. What it is / is not table (12)
3. “Inspired by” paragraph → `why-pi-spine.md` (5)
4. Feature bullets (12)
5. Prerequisites table (8)
6. Install + `spine init` + adoption links (15)
7. **Numbered quickstart** (init → doctor → plan → preflight → batch start → status → gate → integrate) (25)
8. Commands-at-a-glance tables (status / batch / gate) (25)
9. One execution diagram (link EXECUTION-FLOW) (15)
10. Honest limits one-liner + runbook link (5)
11. Best-of-N one-liner + QUICK-REFERENCE link (5) — **SP-276 trim**
12. Migrate from Taskplane (8)
13. Version + CI one-liner (5)
14. Documentation table (15)
15. License + related links (10)

## Codebase areas

- `README.md` — inventory source only (no edits in SP-300)
- `docs/adoption/why-pi-spine.md` — SP-301 positioning extract (not yet created)
- `docs/QUICK-REFERENCE.md` — primary operator command home
- `docs/EXECUTION-FLOW.md` — lifecycle and scheduling depth
- `docs/adoption/operator-runbook.md` — daily operator procedures
- `docs/adoption/bootstrap-checklist.md` — greenfield + skill authoring
- `docs/design/cursor-rules-discovery.md` — contributor Cursor rules
- `package.json` — version source of truth

## Risks

- **Link rot:** Moving 300+ lines requires SP-304 doc index sync so README links stay valid.
- **Duplicate content:** QUICK-REFERENCE and runbook overlap; SP-303 should extend, not duplicate paragraphs.
- **Version confusion:** v2.2 vs v1.0.2 labels confuse new readers — align on package semver in README only.
- **Best-of-N discoverability:** Aggressive trim risks hiding dev script; mitigate with QUICK-REFERENCE subsection + one README link (SP-276).

## Suggested file scopes

| Task | Paths |
|------|-------|
| SP-301 | `docs/adoption/why-pi-spine.md` |
| SP-302 | `README.md` |
| SP-303 | `docs/QUICK-REFERENCE.md`, `docs/EXECUTION-FLOW.md`, `docs/adoption/operator-runbook.md`, `docs/adoption/bootstrap-checklist.md` |
| SP-304 | `docs/README.md`, adoption index rows |
| SP-305 | `README.md` (verify `wc -l`, grep clean) |

## Open questions

- **pi-conductor archived?** SP-301 PROMPT notes “conductor archived” — verify upstream status before why-pi-spine.md ships.
- **CONTRIBUTING.md:** Cursor rules table could live there instead of design doc — SP-304 decides.
- None blocking decomposition.
