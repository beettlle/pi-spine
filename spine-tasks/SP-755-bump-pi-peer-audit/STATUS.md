# SP-755: Wave A peer bump + audit clear — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-09-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Capture `npm audit` high/critical counts and `npm outdated` for pi-coding-agent
- [ ] Record current pins in STATUS.md
- [ ] Dependencies satisfied

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

---

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-09-13 | Task staged | PROMPT.md and STATUS.md created for v2.21.0 |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
