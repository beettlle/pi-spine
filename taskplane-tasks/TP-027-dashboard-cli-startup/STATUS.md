# TP-027: Dashboard CLI startup operator messaging — Status

**Current Step:** Not Started
**Status:** 🔵 Ready for Execution
**Last Updated:** 2026-06-02
**Review Level:** 1
**Review Counter:** 0
**Iteration:** 0
**Size:** S

> **Hydration:** Outcome-level checkboxes only; worker expands if implementation details differ.

---

### Step 0: Preflight
**Status:** ⬜ Not Started

- [ ] Reproduced deferred stdout bug on `spine dashboard`
- [ ] Dependencies satisfied (dashboard on main)

---

### Step 1: Startup banner + immediate stdout
**Status:** ⬜ Not Started

- [ ] `formatDashboardStartupMessage` exported and used at listen time
- [ ] Stdout shows URL, port, operator hints before block
- [ ] Shutdown line does not duplicate full banner

---

### Step 2: Tests + slash notify alignment
**Status:** ⬜ Not Started

- [ ] `tests/dashboard/cli-startup.test.mjs` added and passing
- [ ] Regression covers pre-shutdown emit
- [ ] `/spine-dashboard` notify consistent with formatter (if touched)

---

### Step 3: Testing & verification
**Status:** ⬜ Not Started

- [ ] Targeted dashboard CLI tests pass
- [ ] Full `npm test` pass
- [ ] `npm run typecheck` pass
- [ ] Manual smoke: URL visible without Ctrl+C

---

### Step 4: Documentation & delivery
**Status:** ⬜ Not Started

- [ ] README updated
- [ ] CONTEXT.md updated

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
| 2026-06-02 | Task staged | PROMPT.md and STATUS.md created |

---

## Blockers

*None*

---

## Notes

Root cause: `runSpineDashboard` returns `output: lines.join` only after `server.close` on SIGINT; `spine.mjs` writes output once at function return.
