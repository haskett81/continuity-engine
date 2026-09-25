# Development and release setup

This document describes the current repository scripts and GitHub workflows. Releasing a version publishes files to GitHub, and may also publish to the Foundry package registry when its optional secrets are configured.

## Local checks

Use Node.js 20 and the committed `package-lock.json`:

```text
npm ci
npm run typecheck
npm run build
```

The build script writes the distributable module to `dist/`. CI runs the type check and build on pushes and pull requests to `master`.

## Release

Check the module in a backed-up Foundry v14 world before publishing. Confirm that `package.json` and `module.json` carry the same version and that the working tree is clean.

`npm run release` increments the patch version; `npm run release -- minor`, `npm run release -- major`, or `npm run release -- 1.2.3` selects another version. The script updates both version files, commits them, creates a `vX.Y.Z` tag, and pushes the commit and tag through your existing Git authentication. Running it is a publication action.

The tag starts `.github/workflows/release.yml`. That workflow builds the package, stamps release URLs into its manifest, and attaches `module.json` and `module.zip` to a GitHub release. Check the workflow result and both assets before sharing the install link.

The workflow has an optional Foundry registry step. It runs only when `FVTT_PACKAGE_ID` is configured as a repository secret, and it also needs `FVTT_USERNAME` and `FVTT_PASSWORD`. Configure those only in GitHub's repository settings when registry publication is intended. Do not put credentials in repository files or issue reports.

The [versioned release list](https://github.com/haskett81/continuity-engine/releases) is the source for install links. Use a specific version's `module.json` until the repository's Latest release is confirmed to be a Continuity module release.
