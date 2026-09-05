# SP-748: Optional Google quota probe for metrics quota — Status

**Current Step:** 3
**Status:** 🔵 Step 3 in progress (documentation & delivery)
**Last Updated:** 2026-09-05
**Review Level:** 2
**Review Counter:** 0
**Iteration:** 0
**Size:** M

---

### Step 0: Preflight
**Status:** ✅ Complete

- [x] Confirm public Google usage/quota API for the auth.json key class (or document none)
- [x] Map `PROBE_POOLS` / `runQuotaProbes` wiring and google prefix in snapshot

#### Step 0 research conclusion (verified 2026-09-05)

**Credential class pi stores for Google:** `~/.pi/agent/auth.json` → `{ "google": { "type": "api_key", "key": "AIza…" } }` — a Google AI Studio standard API key (project-linked for billing/quota; ai.google.dev/gemini-api/docs/api-key). Shape verified against pi's auth-storage; key content never read or printed.

**Public usage/quota API for that key class: NONE.** Evidence:

1. Generative Language API REST reference (ai.google.dev/api) documents only inference + platform endpoints (interactions, generateContent, streamGenerateContent, BidiGenerateContent, batchGenerateContent, embedContent, files/caches/countTokens, Gen Media). There is no usage-report or quota resource.
2. Official docs direct users to AI Studio HTML dashboards for both rate limits (aistudio.google.com/rate-limit) and usage (Dashboard > Usage; ai.google.dev/gemini-api/docs/billing). Dashboards are not scraped — forbidden by PROMPT and #277.
3. google-gemini/gemini-cli discussion #3096 ("How can I check my requests per day remaining?") confirms no public endpoint exists; the programmatic path is Cloud Monitoring (`serviceruntime.googleapis.com/api/request_count`) which requires GCP OAuth service-account credentials — a different credential class than the AI Studio key pi stores.
4. Service Usage / Cloud Quotas `consumerQuotaMetrics` (serviceusage.googleapis.com) reads quota *limits*, not current usage, and requires GCP OAuth with cloud-platform scope. Using it would mean storing a new credential class (out of scope) or sending the consumer key where it does not authenticate.

**Decision:** PROMPT Mission branch 2 — permanent fail-closed `absent` path with documented rationale; no dashboard scraper. Contract `fileScopeMustChange: src/metrics/quota-probes.mjs` is still satisfied: google gets an explicit `PROBE_POOLS` registration and a documented `probeGoogle` that returns `absent` without network I/O or credential access.

**Wiring map:** `PROBE_POOLS` (quota-probes.mjs:40) feeds the default `providers` array of `runQuotaProbes` (quota-probes.mjs:444) and tests. `runQuotaProbes` is called only by `runQuotaReport` (quota-cli.mjs:114, GitNexus impact: LOW, 1 direct caller); results are merged into `buildQuotaSnapshot(probeResults)` where `source: "live"` requires `probe.source === "live"` and absent probes are inert. `google` is already in `POOL_PREFIXES` (quota-snapshot.mjs:33) → pool id `google`.

**Impact analysis (GitNexus):** `runQuotaProbes` upstream — LOW risk, 1 direct caller (`runQuotaReport`); `PROBE_POOLS` upstream — LOW risk, 0 direct dependents. Adding a google entry + always-absent adapter is additive; absent probes do not affect pool sources.

---

### Step 1: Implement fail-closed probeGoogle
**Status:** ✅ Complete

- [x] Add Google probe wired into `PROBE_POOLS` / `runQuotaProbes`
- [x] Wrong/missing credentials → `absent` (probe is permanently absent: never reads the credential, never calls fetch)
- [x] Map explicit usage/limit fields only when present (no live endpoint exists; result carries no usage/limit keys)
- [x] Redact secrets from all probe outputs

---

### Step 2: Testing & Verification
**Status:** ✅ Complete

- [x] Run lint: `npm run lint`
- [x] Run Contract `testCommand`
- [x] Fix all failures (none required)
- [x] Tests: live / 401 / missing key / no-limit → adapted per Amendments: no live/401 paths exist (no endpoint); tests prove never-dials-out with key present, missing auth in default set, no usage/limit keys, no secrets, and estimate preservation end-to-end

**Evidence:** Contract `testCommand` run in foreground 2026-09-05 — `npm run lint` (eslint --max-warnings 0, clean) → `npm run typecheck` (both tsconfig projects, clean) → `node --test` on quota-probes/snapshot/cli: **47 pass, 0 fail**.

---

### Step 3: Documentation & Delivery
**Status:** ⚪ Not Started

- [ ] Document Google credential class + degrade row in `docs/QUICK-REFERENCE.md`
- [ ] If no public API: STATUS records research conclusion
- [ ] Create `.DONE`

## Amendments

- 2026-09-05: Pre-landed contract redirect — docs/QUICK-REFERENCE.md already touched by SP-747; mustChange is quota-probes only.
- 2026-09-05: Step 0 research concluded **no public Google usage/quota API exists for the AI Studio key class** pi stores → Mission branch 2: permanent fail-closed `absent` probe, no scraper. Consequence for Step 2: the "live success (mocked)" and "401/403" test paths have no endpoint to exercise for Google; tests instead prove the probe never dials out (wrong-class key present, missing auth, default provider set) and that the google pool keeps its offline estimate with no invented usage/limit. Completion criterion "…or documented permanent `absent` with no scrape" is the branch being delivered.

## Step 1 plan (Review Level 2, self-review before coding)

1. `PROBE_POOLS.google = "google"` — explicit pool registration.
2. `probeGoogle(_auth, _fetch)` — returns `{ poolId: "google", source: "absent" }` unconditionally; never reads the credential, never calls `fetch` (args underscore-prefixed for `--max-warnings 0` lint). In-code doc block records the research conclusion and the standing rule for the future live adapter (zai/kimi pattern, explicit fields only).
3. Wire google into `runQuotaProbes` default providers + dispatch branch; extend module docstring.
4. Tests (tests/metrics/quota-probes.test.mjs): PROBE_POOLS.google mapping; google api_key present → absent + fetch never called + no usage/limit keys + secret not in output; google in default set → absent with missing auth; end-to-end `buildQuotaSnapshot` keeps google pool `estimate` with observed metrics when probe absent.
5. QUICK-REFERENCE.md: google row in "Probe credential classes" + google row in "Probe degrade matrix".

## Discoveries

| Finding | Handling |
|---------|----------|
| pi stores `auth.google = { type: "api_key", key: "AIza…" }` (shape only; verified via pi auth-storage, local auth.json shape) | Documented as the credential class; probe deliberately never reads it |
| No live-path tests possible (no endpoint) | Recorded in Amendments; absent-path coverage substitutes per Mission branch 2 |
