# Release manifest — v2.28.0

**Created:** 2026-10-17
**Current version:** 2.27.1
**Target version:** v2.28.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-10-17, with amendments: pull in #340, #325 and #350; reviewer must never share the worker's model family)
**Worker model pin:** `anthropic/claude-sonnet-5-5` (high) via `activeProfile: sonnet`; quota fallback `gemini4` (`google/gemini-4-argon`). GLM and Kimi pools are out of tokens, so no `zai/*` or `kimi-coding/*` pins this release.
**Agent pin override:** planned (2026-10-17, operator request) — after SP-832..SP-834 land #355, add reviewer profiles and set `agents.reviewerProfile` plus `profiles.gemini4.reviewerProfile` so no worker is reviewed by its own family. Reviewer change only; worker pin unchanged. Record the exact config diff here before applying.

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 0 (runbook/template docs folded into SP-834, SP-836, SP-843) | 2–4 | WARN — no open documentation issues |
| Bug fixes | 5 issues / 6 tasks | 3–5 | PASS |
| Enhancements | 3 issues / 6 tasks (#355, #340, #325) | 1–2 | WARN — operator override (amendments 2026-10-17) |
| **Total tasks** | 12 | 10–15 | PASS |

**Profile audit:** PASS with operator override (enh bucket over budget by operator request; docs bucket empty)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@earendil-works/pi-coding-agent` 1.1.0 → 1.3.0 (wanted, in range); eslint 10.11 → 10.13; globals 17.12 → 17.13; `@types/node` 22.20.4 → 22.20.5; typebox 1.3.34 → 1.4.2 (pinned); typescript 6.0.3 → 7.0.2 (major) |
| `npm audit` highs/criticals | 0 |
| Action | deferred: no security findings; TypeScript 7 is a toolchain major; pi-coding-agent drift is within the semver range |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Depends on |
|-------|-------|--------|------|-------|------------|
| SP-832 | #355 | enh | M | Reviewer profile resolution and model-family guard (resolver, schema, doctor, preflight) | — |
| SP-833 | #340, #355 | enh | M | PROMPT `**Profile:**`, `**Thinking:**`, `**Reviewer Profile:**` parse + validate | SP-832 |
| SP-834 | #355 | enh | M | Engine reviews use the effective reviewer profile; runtime family guard; journal reviewer model. Closes #355 | SP-832, SP-833 |
| SP-835 | #340 | enh | M | Worker spawn honors per-task profile/thinking; journal + metrics | SP-833, SP-834 |
| SP-836 | #340 | enh | M | `spine batch retry --profile` and `escalatePolicy`. Closes #340 | SP-835 |
| SP-837 | #325 | enh | M | Reviewer rows in run-metrics. Closes #325 | SP-834, SP-835 |
| SP-838 | #351 | bug | S | Classify Google and Anthropic quota/overload errors | — |
| SP-839 | #351 | bug | S | Z.ai / Kimi Coding quota probes parse real responses. Closes #351 | — |
| SP-840 | #343 | bug | S | Engine code review baseline commit. Closes #343 (P1) | — |
| SP-841 | #354 | bug | S | Drop per-step plan review instruction from worker prompt. Closes #354 | — |
| SP-842 | #353 | bug | S | Heartbeat reads live preflight state. Closes #353 | — |
| SP-843 | #350 | bug | M | Quota fallback hop expiry and `spine batch quota-fallback clear`. Closes #350 | SP-836, SP-838 |

**Release scope ID:** `SP-832,SP-833,SP-834,SP-835,SP-836,SP-837,SP-838,SP-839,SP-840,SP-841,SP-842,SP-843`

Already on `main` since v2.27.1 (ships in v2.28.0): SP-831 / #352 (numeric task ID sort). #352 is still OPEN — close in the Phase 6 sweep.

---

## Wave plan

1. **Batch A:** SP-832 (alone). **Landed** `49c6a719` (batch `20261018T021242-e161`). First contract run timed out (10 min) because a concurrent stet run was sharing LM Studio; second run failed with 12 stet findings, all triaged by the operator as false positives or wrong suggestions (tests 77/77 green) and dismissed. Post-integrate `release:check` passed on rerun (2999/2999); the first run had one timing flake in `tests/batch/sequence-detached-poll.test.mjs` (hard-cap test), which passed 3/3 in isolation.
2. **Batch B:** SP-833 (alone). **Landed** `cdfe5e7a` (batch `20261018T215227-2515`). Contract passed first try. 28 `batch.state_write_rejected` (`stale_engine_pid`) journal events during contract/merge: write guard refusing a non-engine writer; harmless. Post-integrate `release:check` passed on rerun (3014/3014); first run hit the same `sequence-detached-poll` hard-cap timing flake under load from the concurrent `../stet` batch.
3. **Batch C:** SP-834 (alone) — completes #355. **Landed** `8b5d9996` (batch `20261018T224834-2166`). First contract run failed on 3 stet findings (2 false positives verified against code, 1 out-of-scope nitpick); dismissed, retry passed. Post-integrate `release:check` failed twice on the `sequence-detached-poll` hard-cap timing test (load avg ~40), then once on a load-related `slash-commands.ts` per-file coverage under-report (#222; isolated 90.46%). Test bound loosened in a direct commit (operator-approved); `release:check` then green (3029/3029, 90.72%).
4. **Config switch** (operator-requested): add reviewer profiles (`review-gemini` = `google/gemini-2.5-pro`, `review-claude` = Anthropic), `agents.reviewerProfile: review-gemini`, `profiles.gemini4.reviewerProfile: review-claude`. Verify with `spine doctor` pairing line and `spine preflight`.
5. **Batch D:** SP-840, SP-838, SP-841, SP-842, SP-839 (independent; SP-840 first since it fixes engine code review).
6. **Batch E:** SP-835 → SP-836 / SP-837 → SP-843 (dependency waves).

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #349, #345, #337, #338, #331, #294 | bug | Over bug budget; next release |
| #348, #347, #344, #341, #339, #326 | enh | Over enh budget |
| #309–#324 | audit epic | Out of minor scope |

---

## Risks and blockers

- Review Level stays 1 on every packet until SP-840 fixes engine code review (#343).
- Until SP-838 lands, Gemini/Anthropic quota errors show as generic failures (no fallback hop; `*_review_spawn_failed` for reviewers).
- Authoring discovery: `parsePromptDependencies` ignores `- **Task:** SP-xxx` bullets (only `- SP-xxx`, `- **SP-xxx**`, `**Requires:** SP-xxx` parse). Packets here use `**Requires:**` plus `dependencies.json`. Candidate upstream issue.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
