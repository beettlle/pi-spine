# npm publish (tag-triggered)

Release flow: `npm version <patch|minor|major>` → `git push --tags` → [`.github/workflows/release.yml`](../../.github/workflows/release.yml) runs tests, **stages** the package on npm via Trusted Publishing (OIDC), and creates a GitHub Release. A maintainer must then **approve** the staged package with 2FA before it is installable. Manual `npm publish` is an emergency fallback only (see [Emergency manual publish](#emergency-manual-publish)).

## Tag-triggered release flow

1. **Pre-release checks** — run locally (same order as `ci.yml` / `release.yml`):
   ```bash
   npm run release:check
   ```
   Equivalent to: `typecheck` → `lint` → `SPINE_WORKER_STUB=1 npm test` → `coverage:check`.
   See [test-layout-coverage-notes.md](test-layout-coverage-notes.md) for coverage-safe test layout guidance that affects the coverage gate.
2. **Bump version and tag** — uses npm's built-in versioning:
   ```bash
   npm version patch   # or minor / major
   ```
   This updates `package.json`, commits the change, and creates a `v<version>` git tag.

   **`preversion` hook (package.json):** `npm version` runs `npm run release:check` via the `preversion` lifecycle script **before** bumping the version. If `release:check` fails, `npm version` exits non-zero and the version is not changed ([#175](https://github.com/beettlle/pi-spine/issues/175) §B). This blocks tag creation earlier than `prepublishOnly`, which only runs at publish time.

   **Dry-run escape hatch:** `npm version --no-git-tag-version` skips the git commit and tag but **does not** skip `preversion` — `release:check` still runs. Use `--no-git-tag-version` only to bump `package.json` locally without git side effects (for example inspecting the next version string). To bypass lifecycle scripts entirely (emergency only), use `npm version --ignore-scripts` and run `npm run release:check` manually before any real release.
3. **Push commit and tag**:
   ```bash
   git push && git push --tags
   ```
4. **Automatic release** — pushing the `v*` tag triggers `release.yml`:
   - Checks out code at the tag ref.
   - If **CI already succeeded** on that commit (typical when `main` and tag are pushed together), skips duplicate validation and publishes immediately.
   - If **no green CI run** exists for that commit (tag-only release), runs the full gate: typecheck, lint, tests, coverage, and CLI smoke checks (parity with `ci.yml`).
   - Fails if CI failed on that commit — release does not bypass a red main build.
   - Runs `npm stage publish --access public --ignore-scripts --provenance` via **npm Trusted Publishing (OIDC)** — `permissions.id-token: write`; no `NPMSECRET` / `NODE_AUTH_TOKEN` on the happy path. Trusted Publisher must allow **npm stage publish** (stage-only is fine / preferred).
   - Creates a GitHub Release with auto-generated notes via `gh release create --generate-notes`.
5. **Approve staged package (human + 2FA — required)** — a green `release.yml` only **stages** the tarball; it is **not** installable until approved:
   - **npmjs.com:** package → **Staged Packages** → review → **Approve** (2FA), or
   - **CLI** (local, logged-in maintainer): `npm stage list` → `npm stage view <id>` → `npm stage approve <id>` (2FA).
   - OIDC cannot approve — `npm stage approve` requires interactive proof-of-presence.
6. **Post-publish smoke** — only after approve. Prefer the bounded retry wrapper (handles registry lag, see below):
   ```bash
   scripts/post-publish-smoke.sh <version>
   ```
   Manual equivalent:
   ```bash
   npm install -g pi-spine@<version>
   spine version
   spine doctor
   pi install npm:pi-spine
   ```

   **Not yet approved:** `npm view` / install missing the version is expected until step 5 — do not treat that as registry lag.

   **Registry lag (`ETARGET` / "No matching version found"):** after approve, a green stage+approve still may not mean the version is immediately installable — the first global install can fail with `ETARGET` / E404 while the registry propagates, even when `npm view` already lists the version (post-mortem F9, [#247](https://github.com/beettlle/pi-spine/issues/247)). Retry with **bounded** exponential backoff (e.g. 5s → 10s → 20s, capped at 60s, max 6 attempts; `scripts/post-publish-smoke.sh <version>` does this for you). Only `ETARGET`/404-class errors count as lag — any other install error is a real failure; do not retry it as lag. If the version is still not installable after the retries exhaust, **fail closed**: treat it as a real missing-version failure and investigate the publish instead of waiting longer.

## Manual re-publish (workflow_dispatch)

If the tag-triggered workflow fails, re-run it on the **existing** tag (do not `npm version` / retag for auth or transient registry failures):

1. Go to **Actions → Release → Run workflow**, or:

   ```bash
   gh workflow run release.yml -f tag=v1.2.3
   gh run list --workflow release.yml --limit 3
   gh run watch --exit-status <run-id>
   ```

2. Enter the tag name (e.g. `v1.2.3`) — the tag must already exist in the repo.
3. The workflow checks out at that tag and re-runs the full pipeline (validation when needed → `npm stage publish` via OIDC → GitHub Release). You must still **approve** the staged package with 2FA before it is installable.

### Trusted Publisher (OIDC) one-time setup

On npmjs.com → `pi-spine` → **Trusted Publisher**:

| Field | Value |
|-------|--------|
| Provider | GitHub Actions |
| Organization or user | `beettlle` |
| Repository | `pi-spine` |
| Workflow filename | `release.yml` |
| Environment name | *(leave blank — job has no `environment:`)* |
| Allowed actions | **npm stage publish** (stage-only is preferred) |

Workflow requirements: `permissions.id-token: write`, Node ≥ 22.14, npm ≥ 11.15, and `npm stage publish` (not token-based `npm publish`).

### Diagnose Stage-to-npm failures

`ci.yml` never publishes. Only `release.yml` step **Stage publish to npm (OIDC)** talks to the registry (OIDC short-lived token — not `NPMSECRET`).

```bash
gh run view <run-id> --log-failed
```

| Log symptom | Cause | Fix |
|-------------|-------|-----|
| OIDC / trusted publisher / `ENEEDAUTH` / publish denied | Trusted Publisher missing, wrong workflow filename, non-blank Environment name mismatch, or Allowed actions exclude `npm stage publish` | Fix Trusted Publisher fields (Environment blank; workflow `release.yml`); re-dispatch same tag |
| `npm error code E404` on **PUT** while still using `NODE_AUTH_TOKEN` / `NPMSECRET` | Legacy token path — invalid/expired secret | Prefer OIDC migration; if emergency token path, rotate `NPMSECRET` |
| `npm stage` unknown / needs newer npm | Runner npm &lt; 11.15 | Workflow must install `npm@^11.15.0` before stage |
| Stage succeeded but `npm view` / install missing version | **Not approved yet** (expected) | Approve on npmjs.com Staged Packages or `npm stage approve <id>` with 2FA |
| `ETARGET` / install E404 **after** approve | Registry lag (F9) | Bounded smoke retries — not an auth problem |
| Typecheck/lint/coverage/CLI smoke red in `release.yml` | Tagged tree not release-safe | Fix on `main`; ship a **new** version/tag |

**Do not** treat tag push + green `ci.yml` or green stage-only as “published.” Confirm with `npm view pi-spine version` **after approve**, then `gh release view vX.Y.Z`.

## Version floors (engines / minPiVersion / peer)

`package.json` declares the Wave A floors ([#285](https://github.com/beettlle/pi-spine/issues/285)). Release operators bumping dependencies must keep these consistent within the same release:

| Floor | Value | Enforced by |
|-------|-------|-------------|
| `engines.node` | `>=22.19.0` | npm `engines` check at install; CI runs Node 22 |
| `pi.minPiVersion` | `0.80.0` | `spine doctor` "pi version supported" warning when the installed pi is older |
| `@earendil-works/pi-coding-agent` (tested peer) | `^0.87.0` dev pin | `npm audit` highs cleared via 0.85.1 (maintained through 0.87.0); extension tool schemas tested against it |

The `peerDependencies` entries for `@earendil-works/pi-coding-agent` and `typebox` stay `*` (optional) — the tested pin lives in `devDependencies`. When bumping the peer, also raise `pi.minPiVersion` if the new pi requires it, and update the workflow pi stubs that emulate `pi --version` (`ci.yml`, `release.yml`) so they report a version at or above the new minimum.

### Wave B toolchain (dev, [#285](https://github.com/beettlle/pi-spine/issues/285))

Dev toolchain majors shipped in Wave B: TypeScript `6.0.3` (TS7 intentionally deferred), ESLint `^10.10.0`, `globals` `^17.12.0`, with `@types/node` held on the `^22.x` line. These are dev-only pins — they do not change `engines.node` or the runtime floors above.

## Pre-publish checklist

- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — parity with CI)
- [ ] **CI workflow green on release commit** — before `npm version` / tag push:
  ```bash
  COMMIT=$(git rev-parse HEAD)
  gh run list --workflow ci.yml --commit "$COMMIT" --json databaseId,conclusion,status --limit 5
  # If in progress: gh run watch --exit-status <run-id>
  ```
  Fail closed if no successful CI run (release-safe profile: typecheck → lint → tests → coverage → CLI smoke — same as `ci.yml`). Do not tag commits that failed CI on `main`.

  **Cancelled or absent CI is no signal** — neither green nor red (post-mortem v2.12.3 F-C). Recovery by run state:
  - **`in_progress` / `queued`:** wait — `gh run watch --exit-status <run-id>`.
  - **`cancelled` or no run exists for `HEAD`:** re-run **CI** via `workflow_dispatch` — `gh workflow run ci.yml` (dispatch trigger added in `edb7919d`) — then `gh run list` again and wait for `conclusion: success` on current `HEAD`.
  - Do **not** treat a cancelled run as green or as red, and do **not** `npm version` or `git push --tags` until a green run exists on `HEAD`.
- [ ] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`, `scripts/coverage-parse.mjs`
- [ ] Version floors consistent: `engines.node` `>=22.19.0`, `pi.minPiVersion` `0.80.0`, pi-coding-agent dev pin `^0.87.0` (see [Version floors](#version-floors-engines--minpiversion--peer))
- [ ] Version bump committed (via `npm version`)
- [ ] Tag pushed (`git push --tags`)
- [ ] `release.yml` succeeded (**stage** complete)
- [ ] Staged package **approved** with 2FA (`npm stage approve` or npmjs.com Staged Packages)
- [ ] Post-publish smoke: global install + `spine doctor` — retry on `ETARGET`/404 registry lag (bounded, see step 6 / `scripts/post-publish-smoke.sh`); fail closed after retries exhaust
- [ ] Real-pi adoption E2E report filed (optional but recommended)

## Dry-run pack (local inspection)

Preview tarball contents before bumping:

```bash
npm pack --dry-run
npm pack
tar -tzf pi-spine-*.tgz | head -50
rm pi-spine-*.tgz
```

Recorded dry-run (SP-242, 2026-06-14): 154 files, 223.5 kB package size.

## Publish history

| Version | Method | Notes |
|---------|--------|-------|
| `1.0.0` | Manual (browser 2FA) | Initial publish; missing `scripts/coverage-parse.mjs` in tarball |
| `1.0.1` | GitHub Actions (`publish.yml`) | Hotfix for tarball `files` whitelist |
| `1.0.2+` | CI-first (`publish.yml` after green CI on `main`) | Default path |
| `1.2.0` | CI-first (`publish.yml` after green CI on `main`) | Tag retagged to `36cb251` after initial tag pointed at failed CI commit |

## Emergency manual publish

Use only when CI publish is broken and operators need an urgent patch **after** explicit approval:

```bash
npm login
npm publish --access public
```

Prefer fixing `release.yml` / secrets and re-running via workflow_dispatch. Do not bypass CI gates for routine releases.

## pi.dev

- Package page: https://pi.dev/packages/pi-spine
- Install: `pi install npm:pi-spine` (auto-synced from npm registry)
