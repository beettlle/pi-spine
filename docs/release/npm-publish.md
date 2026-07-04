# npm publish (tag-triggered)

Release flow: `npm version <patch|minor|major>` → `git push --tags` → [`.github/workflows/release.yml`](../../.github/workflows/release.yml) runs tests, publishes to npm, and creates a GitHub Release. Manual `npm publish` is an emergency fallback only (see [Emergency manual publish](#emergency-manual-publish)).

## Tag-triggered release flow

1. **Pre-release checks** — run locally:
   ```bash
   npm run typecheck && SPINE_WORKER_STUB=1 npm test
   npm run coverage:check
   ```
2. **Bump version and tag** — uses npm's built-in versioning:
   ```bash
   npm version patch   # or minor / major
   ```
   This updates `package.json`, commits the change, and creates a `v<version>` git tag.
3. **Push commit and tag**:
   ```bash
   git push && git push --tags
   ```
4. **Automatic release** — pushing the `v*` tag triggers `release.yml`:
   - Checks out code at the tag ref.
   - Runs `npm run typecheck` and `npm test`.
   - Runs `npm publish --access public --ignore-scripts` using secret `NPMSECRET`.
   - Creates a GitHub Release with auto-generated notes via `gh release create --generate-notes`.
5. **Post-publish smoke** — verify install and CLI:
   ```bash
   npm install -g pi-spine@<version>
   spine version
   spine doctor
   pi install npm:pi-spine
   ```

## Manual re-publish (workflow_dispatch)

If the tag-triggered workflow fails (e.g. transient npm registry error), re-run it manually:

1. Go to **Actions → Release → Run workflow**.
2. Enter the tag name (e.g. `v1.2.3`) — the tag must already exist in the repo.
3. The workflow checks out at that tag and re-runs the full publish pipeline.

## Pre-publish checklist

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green
- [ ] `npm run coverage:check` green (≥77% line on `src/`, `bin/`, `extensions/`)
- [ ] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`, `scripts/coverage-parse.mjs`
- [ ] Version bump committed (via `npm version`)
- [ ] Tag pushed (`git push --tags`)
- [ ] `release.yml` succeeded
- [ ] Post-publish smoke: global install + `spine doctor`
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
