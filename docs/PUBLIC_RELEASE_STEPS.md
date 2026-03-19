# Public Release Steps

This checklist covers the final steps before making the repository public and publishing the first public release.

## 1. Final Repository Readiness

- Confirm required root files exist and are current:
  - `README.md`
  - `LICENSE`
  - `CONTRIBUTING.md`
  - `SECURITY.md`
- Confirm discovery metadata is set in GitHub:
  - Description
  - Homepage
  - Topics
- Confirm issue and PR workflows are enabled:
  - `.github/ISSUE_TEMPLATE/*`
  - `.github/PULL_REQUEST_TEMPLATE.md`
  - `.github/release.yml`

## 2. Pre-Release Quality Gate

Run from repo root:

```bash
pi
pr type-check:all
pr build:all
pnpm test
```

Optional sanity checks:

```bash
gst
gd
```

## 3. Package and CLI Validation

Validate published package content and local CLI behavior:

```bash
cd packages/cli
pr build
pnpm pack --dry-run
pnpm link --global
netcap --version
netcap status
netcap setup --help
```

## 4. Versioning and Changelog

- Decide release version for `packages/cli/package.json`.
- Ensure `packages/cli/CHANGELOG.md` includes user-visible changes.
- Confirm migration notes for renamed/updated commands (notably `netcap`).

## 5. Tag and Release (When Ready)

You can do this later with git and GitHub CLI:

- Create annotated tag for the release version.
- Push tag to origin.
- Create GitHub Release from that tag.
- Use release notes grouped by categories from `.github/release.yml`.

## 6. Public Visibility Switch

Immediately before public launch:

- Verify no secrets in docs, scripts, or committed config.
- Verify private-only URLs/tokens are not present in examples.
- Switch repository visibility to public.

## 7. Post-Launch Discovery Tasks

- Pin the repository on your GitHub profile.
- Add a social preview image.
- Enable GitHub Discussions.
- Publish first short demo GIF in `README.md`.
- Submit to MCP and related awesome/directories.

## 8. Quick Rollback Plan

If launch issues appear:

- Keep a hotfix branch ready from the release tag.
- Publish a patch release quickly with concise release notes.
- Document user-facing workarounds in README and release notes.
