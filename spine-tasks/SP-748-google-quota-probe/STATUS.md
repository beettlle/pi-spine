# SP-748: Optional Google quota probe for metrics quota — Status

**Current Step:** 0
**Status:** ⚪ Not Started
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ⚪ Not Started

- [ ] Confirm public Google usage/quota API for the auth.json key class (or document none)
- [ ] Map `PROBE_POOLS` / `runQuotaProbes` wiring and google prefix in snapshot

---

### Step 1: Implement fail-closed probeGoogle
**Status:** ⚪ Not Started

- [ ] Add Google probe wired into `PROBE_POOLS` / `runQuotaProbes`
- [ ] Wrong/missing credentials → `absent`
- [ ] Map explicit usage/limit fields only when present
- [ ] Redact secrets from all probe outputs

---

### Step 2: Testing & Verification
**Status:** ⚪ Not Started

- [ ] Run lint: `npm run lint`
- [ ] Run Contract `testCommand`
- [ ] Fix all failures
- [ ] Tests: live / 401 / missing key / no-limit

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Document Google credential class + degrade row in `docs/QUICK-REFERENCE.md`
- [ ] If no public API: STATUS records research conclusion
- [ ] Create `.DONE`

## Amendments

- 2026-09-05: Pre-landed contract redirect — docs/QUICK-REFERENCE.md already touched by SP-747; mustChange is quota-probes only.
