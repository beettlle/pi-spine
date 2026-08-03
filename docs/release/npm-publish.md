# npm publish (tag-triggered)

Release flow: `npm version <patch|minor|major>` → `git push --tags` → [`.github/workflows/release.yml`](../../.github/workflows/release.yml) runs tests, publishes to npm, and creates a GitHub Release. Manual `npm publish` is an emergency fallback only (see [Emergency manual publish](#emergency-manual-publish)).

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
   - Runs `npm publish --access public --ignore-scripts` using secret `NPMSECRET`.
   - Creates a GitHub Release with auto-generated notes via `gh release create --generate-notes`.
5. **Post-publish smoke** — verify install and CLI. Prefer the bounded retry wrapper (handles registry lag, see below):
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

   **Registry lag (`ETARGET` / "No matching version found"):** a green `release.yml` run does not mean the version is immediately installable — the first global install can fail with `ETARGET` / E404 while the registry propagates, even when `npm view` already lists the version (post-mortem F9, [#247](https://github.com/beettlle/pi-spine/issues/247)). Retry with **bounded** exponential backoff (e.g. 5s → 10s → 20s, capped at 60s, max 6 attempts; `scripts/post-publish-smoke.sh <version>` does this for you). Only `ETARGET`/404-class errors count as lag — any other install error is a real failure; do not retry it as lag. If the version is still not installable after the retries exhaust, **fail closed**: treat it as a real missing-version failure and investigate the publish instead of waiting longer.

## Manual re-publish (workflow_dispatch)

If the tag-triggered workflow fails (e.g. transient npm registry error), re-run it manually:

1. Go to **Actions → Release → Run workflow**.
2. Enter the tag name (e.g. `v1.2.3`) — the tag must already exist in the repo.
3. The workflow checks out at that tag and re-runs the full publish pipeline.

## Pre-publish checklist

- [ ] `npm run release:check` green (typecheck, lint, tests, coverage — parity with CI)
- [ ] **CI workflow green on release commit** — before `npm version` / tag push:
  ```bash
  COMMIT=$(git rev-parse HEAD)
  gh run list --workflow ci.yml --commit "$COMMIT" --json databaseId,conclusion,status --limit 5
  # If in progress: gh run watch --exit-status <run-id>
  ```
  Fail closed if no successful CI run (release-safe profile: typecheck → lint → tests → coverage → CLI smoke — same as `ci.yml`). Do not tag commits that failed CI on `main`.
- [ ] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`, `scripts/coverage-parse.mjs`
- [ ] Version bump committed (via `npm version`)
- [ ] Tag pushed (`git push --tags`)
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: global install + `spine doctor` — retry on `ETARGET`/404 registry lag (bounded, see step 5 / `scripts/post-publish-smoke.sh`); fail closed after retries exhaust
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
