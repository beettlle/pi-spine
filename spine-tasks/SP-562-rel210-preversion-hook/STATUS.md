# SP-562: preversion hook — Status

**Current Step:** Step 3
**Status:** 🔄 In Progress
**Last Updated:** 2026-07-09
**Review Level:** 1
**Size:** S

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read issue #175 and SP-530 skill gate

### Step 1: preversion hook
**Status:** ✅ Complete

- [x] Add `"preversion": "npm run release:check"` to package.json scripts
- [x] Ensure hook does not run on `npm version --no-git-tag-version` (npm behavior — document)

### Step 2: Docs + tests
**Status:** ✅ Complete

- [x] Update npm-publish.md with hook behavior and dry-run escape
- [x] Test documents expected package.json script presence

### Step 3: Testing & Verification
**Status:** 🔄 In Progress

- [ ] Run contract `testCommand`

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Comment on #175
- [ ] Create `.DONE`
