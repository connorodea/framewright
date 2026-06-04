# Release Process

Releases are automated by `.github/workflows/release.yml`. Pushing a tag matching `v*` (for example `v0.1.0`, `v1.2.3`, `v1.0.0-beta.1`) builds, publishes to npm with provenance, and creates a GitHub release with auto-generated notes.

## One-time setup

1. Generate an npm **Automation** token (not a CLI / classic token) at <https://www.npmjs.com/settings/~/tokens>. Automation tokens are required for `--provenance` and bypass 2FA.
2. In GitHub repo Settings -> Secrets and variables -> Actions, add a new repository secret:
   - Name: `NPM_TOKEN`
   - Value: the automation token from step 1.
3. Confirm the workflow has the required permissions (already set in the file):
   - `contents: write` so the `github-release` job can create the release.
   - `id-token: write` so npm provenance attestations can be signed.

## Per release

1. On a feature branch, bump `version` in `package.json` (and `CHANGELOG.md` if present).
2. Commit, open a PR into the appropriate base branch, get it merged.
3. From your local checkout of the merged base:
   ```bash
   git pull
   git tag v<version>          # e.g. git tag v0.2.0
   git push origin v<version>
   ```
4. The `release.yml` workflow runs three jobs in order:
   - `verify`: install, typecheck, build.
   - `publish`: build and `npm publish --access public --provenance`.
   - `github-release`: create the GitHub release with auto-generated notes. Tags that contain `-` (e.g. `v1.0.0-beta.0`) are marked as prereleases.

## Reverting a bad publish

You have a **72 hour** window to unpublish from npm. After that, publish a patched version instead.

```bash
npm dist-tag rm framewright <version>
npm unpublish framewright@<version>
```

Then delete the GitHub release and tag if needed:

```bash
gh release delete v<version> --yes
git push --delete origin v<version>
git tag -d v<version>
```
