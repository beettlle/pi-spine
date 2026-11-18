# Release manifest — v2.32.0

**Created:** 2026-11-18
**Current version:** 2.31.0 (published; checkout HEAD `65c8417a` = `origin/main`)
**Target version:** v2.32.0
**Bump type:** minor
**Profile:** minor
**Operator approved scope:** yes (2026-11-18)
**Worker model pin:** `zai/glm-5.3-flash` (thinking high), quota fallback profile `allegretto` — do not change mid-release ([#248](https://github.com/beettlle/pi-spine/issues/248))
**Agent pin override:** none

**Theme:** Contract and gate fail-closed hygiene from the brutal-audit leftover cluster (#309–#316, #319), plus the deferred Taskplane default-rules drop (#344) and the cosmetic integrate gate line (#359). Companion operator docs for the safety fixes. No peer bump — `pi-coding-agent` already 1.5.2; audit clean.

---

## Release guardrails (carried from v2.31.0)

| Field | Value | Enforcement |
|-------|-------|-------------|
| **M-size budget** | ≤ 2 M packets per release | Composition audit fails above 2 |
| **Scope freeze** | End of Phase 3 (packets authored + `spine plan` clean) | Later work goes to a patch release or the next manifest |
| **Binary policy** | Checkout `node bin/spine.mjs` for all release batches (dogfood unreleased main) | Never `npm link`; global stays 2.31.0 until Phase 6 |
| **Dependency chain depth** | ≤ 2 waves per batch | Prefer one batch if plan fits; split only if hot-file serial forces it |
| **Structural guards** | Every code `testCommand` includes `tests/cli/phase23-exit-verify.test.mjs tests/arch/ts-nocheck-guard.test.mjs` and prefixes `npm run lint &&` | `spine-task-authoring.mdc` Definition of ready |
| **Host capacity** | `spine doctor` "stet review capacity" has no blocking swap exhaustion before each `batch start` | 2026-11-18 intake: swap nearly exhausted (1.3 GiB) — unload LM Studio / wait before batches |
| **Stet gate** | Default `contract.reviewPolicy` stays **advisory** unless operator opts into blocking | unchanged |

---

## Composition audit

| Bucket | Selected | Profile limit | Status |
|--------|----------|---------------|--------|
| Documentation | 2 (SP-865, SP-866) | 2–4 | PASS |
| Bug fixes | 5 (SP-867..SP-871: #309, #314, #313, #316, #359) | 3–5 | PASS |
| Enhancements | 1 (SP-872 / #344) | 1–2 | PASS |
| **M packets** | 0–1 (SP-870 may land as S; promote to M only if Host+SSE+crash need one packet) | ≤ 2 | PASS |
| **Total tasks** | 8 | 10–15 | PASS |

**Profile audit:** PASS (pending operator scope approval)

---

## Dependency drift

| Check | Result |
|-------|--------|
| `npm outdated` | `@types/node` 22.20.4 → 22.20.5 (wanted) / 26.6.6 (latest); `typebox` 1.3.34 → 1.4.7; `typescript` 6.0.3 → 7.0.2. **No** `pi-coding-agent` drift (installed 1.5.2). |
| `npm audit` highs/criticals | **0 high, 0 critical** (total 0) |
| Action | **deferred: deps OK** — no peer ≥1-minor, no audit high. Defer TypeScript 7 / `@types/node` 26 / typebox 1.4 (toolchain majors / enh slot already used by #344). |

---

## Selected tasks

| SP-ID | Issue | Bucket | Size | Title | Notes |
|-------|-------|--------|------|-------|-------|
| SP-865 | — | doc | S | Runbook: contract `artifactsMustExist` / `fileScopeMustNotChange` fail-closed | Docs for #309 |
| SP-866 | — | doc | S | Operator notes: gate streak reset fail-closed + integrate gate line after success | Docs for #314/#359 |
| SP-867 | #309 | bug | S | Contract: reject `..` in artifacts; fix `**` globs; fail-closed when git diff fails | Closes #309 |
| SP-868 | #314 | bug | S | Gate approval-streak reset: do not swallow I/O errors (fail closed / journal) | Closes #314 |
| SP-869 | #313 | bug | S | Validate `--batch` IDs at CLI entry points; sanitize review `baseline` | Closes #313 |
| SP-870 | #316 | bug | S | Dashboard server: Host allowlist, snapshot error handling, honor injected `buildSnapshot`, bound SSE | Closes #316 |
| SP-871 | #359 | bug | S | After successful approved integrate, do not print "Gate: approval required" | Closes #359 |
| SP-872 | #344 | enh | S | Drop Taskplane rules from default worker `alwaysInclude` / init profile | Closes #344 |

**Release scope ID:** `SP-865,SP-866,SP-867,SP-868,SP-869,SP-870,SP-871,SP-872`

**Proposed Batch A (docs + contract/gate safety):** `SP-865,SP-866,SP-867,SP-868`
**Proposed Batch B (CLI/dashboard + UX + rules profile):** `SP-869,SP-870,SP-871,SP-872`

Serialize SP-867 with any other `contract-exec.mjs` touchers (none in Batch B). SP-868 (`gate-posture-approve.mjs`) should stay disjoint from SP-871 (integrate messaging) unless analyze shows shared files.

---

## Gaps requiring new packets

| Issue | Bucket | Proposed SP-ID | Author with |
|-------|--------|----------------|-------------|
| — (contract fail-closed docs) | doc | SP-865 | create-spine-tasks (lean) |
| — (gate/integrate docs) | doc | SP-866 | create-spine-tasks (lean) |
| #309 | bug | SP-867 | create-spine-tasks (lean) |
| #314 | bug | SP-868 | create-spine-tasks (lean) |
| #313 | bug | SP-869 | create-spine-tasks (lean) |
| #316 | bug | SP-870 | create-spine-tasks (lean) |
| #359 | bug | SP-871 | create-spine-tasks (lean) |
| #344 | enh | SP-872 | create-spine-tasks (lean) |

**Next Task ID after authoring:** SP-873

---

## Wave plan snapshot

```text
Wave 0 · 6 tasks · 3 rounds (maxParallel 2): SP-865||SP-867 ; SP-868||SP-869 ; SP-870||SP-872
Wave 1 · 2 tasks · 2 lanes: SP-866 || SP-871 (after SP-865 / SP-869 deps)
Release scope: SP-865,SP-866,SP-867,SP-868,SP-869,SP-870,SP-871,SP-872
```

---

## Deferred backlog

| Item | Type | Rationale |
|------|------|-----------|
| #338 | bug P2 | run-metrics usage never populated — needs pi usage capture design |
| #331 | bug P2 | Post-hoc Step 0 plan review “premature completion” — M-sized prompt/engine work |
| #327 | bug P3 | Dashboard lanes all “running” at round barrier — UI polish |
| #319 | bug P2 | Audit leftovers (fileScope fallback, contract.errors, fake-async) — next patch/minor |
| #311 / #310 | bug P2 | Matrix slot leak / reconcile git fail-open — later train |
| #294 | bug | Step-0 plan review spawn ordering — related to #331 cluster |
| #361 | enh P1 | Tri-state check results — large; keep for later minor |
| #339 | enh P2 | Isolate worker pi sessions from user extensions — follow-up to #334 |
| #360 | enh P2 | Contract option for files outside File Scope — adjacent to #309; defer |
| #358 | enh P2 | Schedule queued wave tasks onto freed lanes — epic-ish |
| #366 / #324 / #225 | epic | Out of minor scope |
| TypeScript 7 / `@types/node` 26 / typebox 1.4 | hygiene | Toolchain majors — deferred (deps OK) |

---

## Risks and blockers

- **No pending SP-\*** at intake — entire scope is gap authoring (Phase 3).
- **Host swap** nearly exhausted (doctor warn 1.3 GiB) — unload LM Studio before batches if stet runs.
- **Quota-risk advisory** on zai / kimi escalate pins — advisory only; keep pin; rely on `quotaFallbackProfile: allegretto`.
- **6 stale worktree dirs** — optional `spine cleanup worktrees` before batches; not blocking.
- Doctor PATH / global spine mtime skew — use `node bin/spine.mjs` only for this release.
- SP-869 (#313) spans CLI + review baseline — keep S by scoping both to validation helpers; split only if File Scope collides with SP-870.

---

## Publish checklist (Phase 5–6)

- [ ] All release-scoped tasks `.DONE` on `main`
- [ ] Post-integrate `release:check` green after **each wave** (log paths recorded)
- [ ] `spine preflight` green
- [ ] `npm run release:check` green on final `HEAD` (typecheck, lint, tests, coverage — CI parity)
- [ ] CI workflow green on `HEAD`
- [ ] `git status` clean
- [ ] Operator approved publish bump type: minor
- [ ] `npm version minor` + `git push && git push --tags`
- [ ] `release.yml` succeeded
- [ ] Maintainer 2FA approve staged package; `npm view pi-spine version` = 2.32.0
- [ ] Post-publish smoke per `docs/release/npm-publish.md`
- [ ] Every release-scoped `Closes #NNN` CLOSED (#309, #314, #313, #316, #359, #344)
