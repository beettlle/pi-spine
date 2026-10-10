# Publish failure recovery and post-publish smoke

Read this only when `release.yml` fails or post-approve smoke fails. The happy path lives in [SKILL.md](../SKILL.md) Phase 6.

---

## Publish failure recovery (HARD STOP — do not retag)

When `release.yml` fails, diagnose with the failed job log before any recovery:

```bash
gh run view <run-id> --log-failed
```

| Symptom | Meaning | Action |
|---------|---------|--------|
| OIDC / trusted publisher mismatch / `ENEEDAUTH` | Trusted Publisher config wrong (workflow name, Environment name set while job has none, stage permission missing) | Fix npm Trusted Publisher; re-dispatch same tag — do **not** `npm version` again |
| Legacy `E404` on PUT with `NPMSECRET` | Old token path still in use or secret bad | Prefer OIDC; emergency: rotate `NPMSECRET` only if workflow still uses token |
| Validation steps failed (typecheck / lint / coverage / CLI smoke) | Tagged commit not release-safe | Fix on `main`, create a **new** patch version + tag; do not force-publish a broken tag |
| CI gate failed for tagged commit | Pre-tag CI was red or missing | Fix `main` / re-run `ci.yml`; new tag if the old tag pointed at a bad commit |
| Stage green but install missing version | Not approved yet | Approve with 2FA; do not retag |
| GitHub Release step failed after stage succeeded | Notes/release page only | Create release manually; do not double-stage the same version without rejecting the prior stage first |

### Re-dispatch existing tag

After a Trusted Publisher or transient registry fix:

```bash
# Tag must already exist; this re-runs checkout → gate → stage → gh release
# workflow_dispatch uses the workflow file from the branch you select (usually main)
gh workflow run release.yml -f tag=v{VERSION}
gh run list --workflow release.yml --limit 3
gh run watch --exit-status <new-run-id>
```

UI equivalent: **Actions → Release → Run workflow** → enter `v{VERSION}`.

**Do not** delete/retag/`npm version` again when the only failure was auth/OIDC — `package.json` and the `v*` tag are already correct.

Distinguish **stage auth failures** (table above) from **post-approve install E404/ETARGET** (registry lag F9 — below) and from **pre-approve missing version** (approve pending).

---

## Post-publish smoke

Run per `docs/release/npm-publish.md` — **only after stage success and 2FA approve**.

**Retry on registry lag (F9, [#247](https://github.com/beettlle/pi-spine/issues/247)):** the first `npm install -g` right after approve can fail with `ETARGET` / "No matching version found" while the registry propagates, even when `npm view` already lists the version. Prefer the bounded wrapper:

```bash
scripts/post-publish-smoke.sh <version>
```

Manual equivalent (bounded retries on `ETARGET`/404-class errors only — 5s/10s/20s backoff capped at 60s, max 6 attempts; non-lag install errors fail immediately and exhausted retries fail closed, never masked as lag):

```bash
npm install -g pi-spine@<version>
spine version
spine doctor
```

If retries exhaust, **STOP** — treat it as a real missing-version failure and investigate the publish; do not keep waiting silently.
