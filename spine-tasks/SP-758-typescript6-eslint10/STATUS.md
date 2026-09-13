# SP-758: TypeScript 6 + ESLint 10 — Status

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

- [ ] Confirm SP-755 pins on `main` (pi-coding-agent ^0.85.1)
- [ ] Record current typescript/eslint/globals versions in STATUS.md
- [ ] Dependencies satisfied

---

### Step 1: Toolchain bump
**Status:** ⬜ Not Started

- [ ] Bump `typescript` to 6.0.x; `eslint` to 10.x; `globals` to 17.x; refresh lockfile
- [ ] Keep `@types/node` on 22.x
- [ ] Adjust flat ESLint config for v10 as needed
- [ ] Fix typecheck errors in package + extension/batch projects
- [ ] `npm run lint` clean with `--max-warnings 0`

---

### Step 2: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (`release:check`)
- [ ] Fix all failures

---

### Step 3: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Brief Wave B version note in `docs/release/npm-publish.md`
- [ ] Discoveries logged (any deferred TS7 items)
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
