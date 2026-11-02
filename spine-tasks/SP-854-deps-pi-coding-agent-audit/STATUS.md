# SP-854: Dependency security: pi-coding-agent 1.4.0, npm audit has no high findings — Status

**Current Step:** Complete
**Status:** ✅ Complete — awaiting engine plan review (RL 1)
**Last Updated:** 2026-11-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Record `npm audit` summary and `npm outdated` before changes in STATUS Discoveries
- [x] `npm view @earendil-works/pi-coding-agent@1.4.0 dependencies` — confirm the `undici` version

### Step 1: Bump
**Status:** ✅ Complete

- [x] `npm install --save-dev @earendil-works/pi-coding-agent@^1.4.0 eslint@^10.14.0 globals@^17.14.0`
- [x] `npm audit --audit-level=high` exits 0; if not, add an `undici` override and re-check

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run Contract `testCommand`
- [x] Fix all failures; if pi 1.4.0 breaks tests in a way that needs `src/` changes, stop and record a blocker (out of File Scope)

### Step 3: Documentation & Delivery
**Status:** ✅ Complete

- [x] Discoveries: before/after audit counts, remaining moderates and their fix availability
- [x] Create `spine-tasks/SP-854-deps-pi-coding-agent-audit/.DONE`

---

## Completion Criteria

- [x] `npm audit --audit-level=high` exits 0
- [x] Lockfile has `@earendil-works/pi-coding-agent` 1.4.0

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Before: `npm audit` = 6 vulnerabilities (5 moderate, 1 high), exit 1. High: `undici 8.0.0–8.12.1` at `node_modules/@earendil-works/pi-coding-agent/node_modules/undici` (8 advisories: DoS, SRI bypass, cache poisoning, TLS bypass, etc.). Moderates: `minimatch` via pi-coding-agent; `eslint`, `@eslint/config-array`, `@eslint-community/eslint-utils`. | Recorded | npm audit on lane pre-change |
| `npm outdated` on fresh lane (no node_modules): only `picomatch MISSING 4.0.7` (runtime dep not yet installed); no in-range minor updates surfaced via outdated — eslint/globals targets taken from PROMPT (eslint ^10.11.0→^10.14.0, globals ^17.12.0→^17.14.0). | Recorded | npm outdated on lane |
| `npm view @earendil-works/pi-coding-agent@1.4.0 dependencies` → `undici: 8.10.2` (exact pin). 8.10.2 is still inside vulnerable range `8.0.0–8.12.1`, so the high survives the pi bump alone → `overrides` entry required per PROMPT Step 1. | Recorded | npm view |
| `npm install …pi-coding-agent@^1.4.0` resolved to 1.5.0 (latest in-range, audit-clean). Re-pinned with `npm install …pi-coding-agent@1.4.0` because the PROMPT completion criterion requires lockfile = 1.4.0; package.json keeps the `^1.4.0` floor. | Recorded | package.json, package-lock.json |
| Added `overrides: { "undici": "^8.12.2" }` (resolves 8.12.3) because pi 1.4.0 exact-pins undici 8.10.2, inside the high-severity range `8.0.0–8.12.1` (8 advisories). With the override: 0 high, exit 0. | Recorded | package.json overrides |
| After: `npm audit` = 5 moderate, 0 high, exit 0 at `--audit-level=high`. Remaining moderates all chain to `minimatch <11.0.1` (GHSA-g3hv-75wg-m249, DoS via globparts amplification): `@eslint/config-array` and `@eslint-community/eslint-utils` → `eslint` (npm's only offered fix: eslint 4.0.0, semver-major breaking → no non-major fix on eslint 10.x); `@earendil-works/pi-coding-agent ≤1.4.0` (minimatch 10.2.6; non-major fix exists — bump to 1.5.0, audit-clean — but deferred: completion criterion pins lockfile at 1.4.0). | Recorded | npm audit --json |
| README.md line 52 still says the optional peer `@earendil-works/pi-coding-agent` is "developed and tested against `^1.0.1` (pinned in `devDependencies") — now stale after this bump. Per PROMPT ("record in Discoveries; do not edit") left unchanged. | Deferred to docs owner | README.md:52 |
| Full-suite `worker-verify.sh` (typecheck + `SPINE_WORKER_STUB=1 npm test`) shows 1 flaky failure in `tests/cli/mutating-help.test.mjs` (#368 loop): external **git-ai** tooling (authorship/3.0.0 notes, `refs/notes/ai`) asynchronously annotates the tmpdir fixture repo mid-loop, racing `snapshotProject`'s `git for-each-ref`. Evidence it is pre-existing and unrelated to this bump: (a) reproduced identically at baseline commit b80ca53e (pi 1.1.0, no overrides) — 3192 pass / 1 fail, label `spine scenarios materialize orphan-running-resume --help changed project state`; (b) same failure with a fresh note hash on every full-suite run, but the file passes 8/8 in isolation; (c) nothing in src/bin/tests writes notes refs (only `update-ref` is `refs/heads/` in integrate-worktree.mjs); (d) pi-coding-agent is never imported by the spine CLI — only `require.resolve`d for doctor diagnostics (src/config/worker-backend.mjs). Fix would touch tests/ (out of File Scope). | Pre-existing environmental flake; not caused by SP-854 | tests/cli/mutating-help.test.mjs, /tmp baseline run |
| `gitnexus_detect_changes` (compare vs b80ca53e): 0 changed symbols, 3 changed files, risk low, no affected processes — scope limited to package.json/package-lock.json/STATUS as required. | Verified | GitNexus |

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-11-01 | Task staged | PROMPT.md created |
| 2026-11-02 | Step 0 preflight | Audit 5 moderate + 1 high; pi 1.4.0 pins undici 8.10.2 (still vulnerable) |
| 2026-11-02 | Step 1 bump | pi 1.4.0 + eslint 10.14.0 + globals 17.14.0; undici ^8.12.2 override; audit exit 0 |
| 2026-11-02 | Step 2 verify | Contract testCommand all green; full-suite flake traced to git-ai notes, reproduced at baseline |
| 2026-11-02 | Step 3 delivery | STATUS complete, .DONE created |

## Blockers

*None*
