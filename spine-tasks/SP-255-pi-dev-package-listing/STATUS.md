# SP-255: pi.dev package listing + post-publish doc sync — Status

**Current Step:** Complete
**Status:** ✅ Complete
**Last Updated:** 2026-06-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] SP-226 complete; npm package live (`pi-spine@1.0.1`)
- [x] pi.dev listing fields reviewed in `docs/release/v1.0-checklist.md`
- [x] Human operator approval for pi.dev submission — N/A (package auto-listed from npm registry)

---

### Step 1: pi.dev package listing
**Status:** ✅ Complete

- [x] Package listed on pi.dev — https://pi.dev/packages/pi-spine
- [x] pi.dev URL recorded in `docs/release/v1.0-checklist.md`
- [x] Post-listing smoke — `npm install -g pi-spine@1.0.1`, `spine version`, `spine doctor` pass

---

### Step 2: Adoption and README doc sync
**Status:** ✅ Complete

- [x] `README.md` — published install paths, slash-command table, project status, test baseline
- [x] `docs/adoption/local-install.md` — npm/pi.dev primary, local path secondary
- [x] `docs/release/npm-publish.md` — post-publish checkboxes
- [x] `docs/release/v1.0-checklist.md` — post-publish section
- [x] `skills/create-spine-tasks/SKILL.md` — npm install path updated
- [x] `spine-tasks/CONTEXT.md` — Phase 26 closed

---

### Step 3: Testing & Verification
**Status:** ✅ Complete

- [x] FULL test suite — 880/880 pass (`SPINE_WORKER_STUB=1 npm test`, 2026-06-17)

---

### Step 4: Documentation & Delivery
**Status:** ✅ Complete

- [x] Operator can install from npm and pi.dev
- [x] `.DONE` created
