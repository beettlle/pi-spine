# SP-758: TypeScript 6 + ESLint 10 — Status

**Current Step:** 2 (Testing & Verification)
**Status:** 🟣 Step 2 In Progress
**Last Updated:** 2026-09-13
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm SP-755 pins on `main` (pi-coding-agent ^0.85.1) — verified `"@earendil-works/pi-coding-agent": "^0.85.1"` in package.json at HEAD e057f79f
- [x] Record current typescript/eslint/globals versions in STATUS.md — typescript `5.6.3` (pinned), eslint `^9.28.0`, globals `^16.2.0`, `@types/node ^22.19.18`
- [x] Dependencies satisfied — SP-755/SP-757 merged (SP-757 commits in lane history; engines floors documented eb9afa87)

---

### Step 1: Toolchain bump
**Status:** ✅ Complete

- [x] Bump `typescript` to 6.0.x; `eslint` to 10.x; `globals` to 17.x; refresh lockfile — typescript `6.0.3` (exact pin, style preserved; `latest` dist-tag is 7.0.2 — not used), eslint `^10.10.0`, globals `^17.12.0`; lockfile refreshed via `npm install`
- [x] Keep `@types/node` on 22.x — pin unchanged `^22.19.18`, resolves `22.19.19`
- [x] Adjust flat ESLint config for v10 as needed — config already flat-native (no eslintrc residue); added `name` properties (v10 core-config convention) and moved `ecmaVersion` from pinned `2022` to `"latest"` per ESLint 10 recommendation; v10 lookup-from-file resolves root config for `src/bin/tests/scripts` — verified by clean lint
- [x] Fix typecheck errors in package + extension/batch projects — none required: `tsc --project tsconfig.json` and `tsc --project tsconfig.batch.json` green on TS 6.0.3 with zero output (tsconfigs unchanged)
- [x] `npm run lint` clean with `--max-warnings 0` — zero findings on ESLint 10.10.0

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
| 2026-09-13 | Step 0 preflight | SP-755 pin verified; versions recorded; registry targets identified: TS 6.0.3 (latest 6.0.x; `latest` dist-tag is 7.0.2 — forbidden), ESLint 10.10.0, globals 17.12.0 |
| 2026-09-13 | Step 1 toolchain bump | TS 6.0.3 + ESLint 10.10.0 + globals 17.12.0 installed; typecheck and lint both green with zero fixes needed in src/bin/extension/tests; lockfile churn limited to toolchain ecosystem deps |

---

## Blockers

*None*

---

## Notes

*Reserved for execution notes*
