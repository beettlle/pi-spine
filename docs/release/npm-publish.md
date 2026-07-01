# npm publish (CI-first)

Release flow: bump version on `main` → green CI → [`.github/workflows/publish.yml`](../../.github/workflows/publish.yml) publishes to npm. Manual `npm publish` is an emergency fallback only (see [Emergency manual publish](#emergency-manual-publish)).

## CI-first release flow

1. **Pre-release checks** — run locally or rely on CI:
   ```bash
   npm run typecheck && SPINE_WORKER_STUB=1 npm test
   npm run coverage:check
   ```
2. **Bump version** — set `package.json` `version` on `main` (semver patch/minor/major as appropriate).
3. **Push to `main`** — triggers [CI](https://github.com/beettlle/pi-spine/actions/workflows/ci.yml) (`typecheck`, full test suite, coverage ≥77%, CLI smoke).
4. **Wait for CI green** — do not tag or create a GitHub Release until CI succeeds on the release commit.
5. **Tag and GitHub Release** (after CI green):
   ```bash
   git tag v<version>
   git push origin v<version>
   gh release create v<version> --title "pi-spine <version>" --notes "..."
   ```
6. **Automatic publish** — when CI completes successfully on `main`, `publish.yml` runs (no manual `workflow_dispatch`):
   - Verifies the triggering CI run concluded `success`.
   - Checks npm for `pi-spine@<version>`; **skips** if that version already exists (idempotent re-runs).
   - Otherwise runs `npm publish --access public --ignore-scripts` using secret `NPMSECRET`.
7. **Post-publish smoke** — verify install and CLI:
   ```bash
   npm install -g pi-spine@<version>
   spine version
   spine doctor
   pi install npm:pi-spine
   ```

## Pre-publish checklist

- [ ] `npm run typecheck && SPINE_WORKER_STUB=1 npm test` green
- [ ] `npm run coverage:check` green (≥77% line on `src/`, `bin/`, `extensions/`)
- [ ] `package.json` `files` includes `bin/`, `src/`, `extensions/`, `skills/`, `templates/`, `scripts/coverage-parse.mjs`
- [ ] Version bump merged to `main`
- [ ] CI green on the release commit
- [ ] `publish.yml` succeeded (or version already on npm from prior run)
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

Prefer fixing `publish.yml` / secrets and re-running the workflow. Do not bypass CI gates for routine releases.

## pi.dev

- Package page: https://pi.dev/packages/pi-spine
- Install: `pi install npm:pi-spine` (auto-synced from npm registry)
