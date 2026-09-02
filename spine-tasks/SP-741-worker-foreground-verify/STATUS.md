# SP-741: Worker prompt: foreground long verifications — Status

**Current Step:** Step 1 — Prompt guardrail
**Status:** 🔄 In Progress
**Last Updated:** 2026-09-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

---

### Plan Notes (Review Level 1)

Preflight findings:
- `.spine/agents/worker.md` has checkpoint/review guidance but **no** foreground-verification or Monitor guidance — background-and-exit is silently available to real-pi workers.
- `worker_done_missing` narration lives in `src/batch/diagnosis-worker-done-missing.mjs` (`buildWorkerDoneMissingHeadline`); the worker output tail is already loaded into ctx (`workerOutputTail`/`workerOutputSnippet`) by `enrichWorkerDoneMissingContext` in `src/batch/reconcile-diagnosis.mjs`, so a cheap marker-based hint can be appended to the headline without new I/O.
- Impact: `buildWorkerDoneMissingHeadline` upstream = LOW (1 caller). `finalizeWorkerOutput` upstream = HIGH → **not modified**; `worker-output.mjs` changes are additive new exports only.

Step 1 plan: add a "Foreground verification" section to worker.md (long verifications foreground, no background-and-exit, no completion wakes, `.DONE` only after verifications finish).
Step 2 plan (hint is cheap → implement): add `detectBackgroundedVerification()` + `BACKGROUND_VERIFICATION_HINT` to `src/batch/worker-output.mjs` with unit tests; wire into `buildWorkerDoneMissingHeadline` (one import + hint append) — diagnosis file is outside declared File Scope but is the narration site the PROMPT points at in Step 0 and is logically required to complete the scoped hint; recorded in Discoveries.

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Read worker.md verification / Monitor guidance — none exists today; no foreground rule
- [x] Locate worker_done_missing diagnosis narration — `src/batch/diagnosis-worker-done-missing.mjs` `buildWorkerDoneMissingHeadline`; tail loaded by `enrichWorkerDoneMissingContext` (`reconcile-diagnosis.mjs`)

---

### Step 1: Prompt guardrail
**Status:** ✅ Complete

- [x] Add explicit: long verifications must be foreground; no background-and-exit — new "Foreground verification" section in `.spine/agents/worker.md`
- [x] Clarify incompatibility of completion wakes with worker lifecycle — same section: session ends when turn ends; wakes cannot resume it; orphaned verification → `worker_done_missing`

---

### Step 2: Optional harness hint + tests
**Status:** ⬜ Not Started

- [ ] If cheap: detect live background children at exit-without-.DONE and add targeted hint
- [ ] Otherwise document-only is acceptable if prompt change is clear — note in STATUS

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
