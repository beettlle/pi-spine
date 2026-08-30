# SP-742: LLM matrix rows get per-row PROMPT substitution — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-08-30
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Confirm SP-740 `.DONE` on main (runbook ownership)
- [ ] Read LLM branch in `matrix-run.mjs` and SP-670 helpers

---

### Step 1: Wire substitution into LLM rows
**Status:** ⬜ Not Started

- [ ] Before `runWorker`, write/serve row-substituted steps + contract (+ file-scope) into the row worktree PROMPT
- [ ] Fail loud on unknown `{matrix.*}` refs (existing helper behavior)
- [ ] Keep execute+matrix path unchanged / recommended for pure compute

---

### Step 2: Tests + runbook §2.4
**Status:** ⬜ Not Started

- [ ] Stub/integration: two rows → worker sees distinct substituted content
- [ ] Remove or narrow §2.4 LLM substitution caveat

---

### Step 3: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint
- [ ] Run Contract testCommand

---

### Step 4: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Docs updates
- [ ] Create `.DONE`
