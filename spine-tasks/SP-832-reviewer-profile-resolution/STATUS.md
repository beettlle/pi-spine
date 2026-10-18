# SP-832: Reviewer profile resolution and model-family guard — Status

**Current Step:** Not Started
**Status:** 🔵 Not Started
**Last Updated:** 2026-10-17
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] GitNexus impact on `resolveReviewerModelPin`, `resolveReviewerThinkingPin`, `validateAgentProfilesConfig`, `buildReviewerPerTypePinsDoctorCheck` — record callers in Discoveries
- [ ] Locate the preflight registration for the reviewer-pin check and record it

### Step 1: Model family + reviewer resolution
**Status:** ⬜ Not Started

- [ ] `src/config/model-family.mjs` with `resolveModelFamily` / `isSameModelFamily`
- [ ] `resolveEffectiveReviewer` with candidate order, missing-block warning, unknown-profile block, family guard

### Step 2: Schema + settings
**Status:** ⬜ Not Started

- [ ] `agents.reviewerProfile` and `profiles.<name>.reviewerProfile` validated (unknown name and self-reference rejected)
- [ ] `agents.reviewerProfile` settable via `spine settings set`

### Step 3: Doctor + preflight pairing report
**Status:** ⬜ Not Started

- [ ] Doctor detail lists every worker pairing (active, quota fallback, escalate target)
- [ ] Same-family pairing fails the doctor check and preflight

### Step 4: Tests
**Status:** ⬜ Not Started

- [ ] Family table: `google/gemini-2.5-pro`, `google/gemini-4-argon`, `anthropic/claude-sonnet-5-5`, `zai/glm-5.3-flash`, `kimi-coding/k3`, `cursor/auto`, `cursor/gemini-3.1-pro`, `llama.cpp/qwen3.8-flash-next-iq3_s`, `inherit`, `null`
- [ ] Precedence: PROMPT > worker profile `reviewerProfile` > `agents.reviewerProfile` > `agents.reviewer`, per review type
- [ ] Missing `reviewer` block warns and falls back; unknown profile is blocked
- [ ] Family guard skips a same-family candidate and blocks when none is cross-family
- [ ] Schema rejects unknown / self-referencing `reviewerProfile`
- [ ] Doctor detail and failure for a `gemini` worker paired with a `gemini` reviewer

### Step 5: Testing & Verification
**Status:** ⬜ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand` (ends with the stet review; triage per Mission note below)
- [ ] Fix all failures

### Step 6: Documentation & Delivery
**Status:** ⬜ Not Started

- [ ] Discoveries logged in STATUS.md
- [ ] Create `spine-tasks/SP-832-reviewer-profile-resolution/.DONE`

---

## Discoveries

| Discovery | Disposition | Location |
|-----------|-------------|----------|

## Execution Log

| Timestamp | Action | Outcome |
|-----------|--------|---------|
| 2026-10-17 | Task staged (release v2.28.0) | PROMPT.md + STATUS.md created |
