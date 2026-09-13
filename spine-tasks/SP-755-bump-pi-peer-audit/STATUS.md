# SP-755: Wave A peer bump + audit clear — Status

**Current Step:** Step 1 — Peer, engines, minPiVersion
**Status:** 🟡 In Progress — Step 1
**Last Updated:** 2026-09-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Capture `npm audit` high/critical counts and `npm outdated` for pi-coding-agent
- [x] Record current pins in STATUS.md
- [x] Dependencies satisfied

---

### Step 1: Peer, engines, minPiVersion
**Status:** ⬜ Not Started

- [ ] Bump `@earendil-works/pi-coding-agent` to `^0.85.1` and refresh lockfile
- [ ] Align `typebox` to 1.3.x; fix extension schemas only if needed
- [ ] Set `engines.node` to `>=22.19.0` and `pi.minPiVersion` to `0.80.0`
- [ ] Update CI/release pi stubs below the new floor
- [ ] Re-run `npm audit` — 0 high

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (`release:check`)
- [ ] Fix all failures from the peer/typebox bump
- [ ] Confirm `npm audit` high=0

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged (before/after audit counts)
- [ ] Create `.DONE`

---

## Reviews

| # | Type | Step | Verdict | File |
|---|------|------|---------|------|

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|
| Before: npm audit = 3 high (brace-expansion, js-yaml, undici), 2 moderate, 0 critical | Baseline recorded | npm audit --json |
| Registry: pi-coding-agent 0.85.1 exists; typebox latest = 1.3.30 | Confirms PROMPT targets | npm view |
| CI stubs mock pi --version as 0.78.0 (< new 0.80.0 floor) — must bump in ci.yml + release.yml | Planned in Step 1 | .github/workflows/ci.yml:72, release.yml:115 |
| real-pi.yml has no pi version stub (uses real runner pi, skips if absent) | No change needed | .github/workflows/real-pi.yml |
| Doctor minPiVersion check emits warning (ok:true) below floor, does not fail | Read-only confirm | src/doctor/run-doctor-checks.mjs:311-335 |
| typebox imported only via `Type` in extensions/spine/worker-tools.ts | Align dep version; schemas only if typecheck fails | extensions/spine/worker-tools.ts |
| `0.60.0` also in docs/release/v1.0-checklist.md (historical doc; SP-757 owns docs) | Out of File Scope — left as-is | docs/release/v1.0-checklist.md:123 |
| node_modules not installed in fresh worktree (micromatch MISSING) | npm install as part of lockfile refresh | repo root |

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |
| 2026-09-13 | Step 0 preflight | audit=3H/2M/0C baseline; pins recorded; stub locations found |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
