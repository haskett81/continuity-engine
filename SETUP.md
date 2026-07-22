# Continuity Engine — Credential-Free Release Pipeline

**What this gives you:** shipping a version is one command — `npm run release`. GitHub builds, packages, and publishes it with no further input. No agent ever types a password, and neither do you, per release.

**The boundary, stated once:** an automated agent (Claude Code or otherwise) will not enter passwords or account credentials — that gate is deliberate and doesn't move. This pipeline is designed so it never needs to. The only credential entry is a handful of **one-time** steps *you* do, in official UIs, in your own browser. After that, everything runs unattended.

---

## Files in this bundle → where they go in the repo

```
continuity-engine/
├─ .github/workflows/release.yml   ← ship-on-tag automation
├─ .github/workflows/ci.yml        ← build check on every push
├─ module.json                     ← manifest (edit the REPLACE_WITH_YOUR_GITHUB placeholders)
├─ package.json                    ← build + release scripts
└─ scripts/
   ├─ build.mjs                    ← bundles TS, copies assets → dist/
   └─ release.mjs                  ← bump + tag + push (triggers the release)
```

Drop these into the module repo root, keeping the folder structure. If you based the repo on the League of Foundry Developers template, these replace/augment its equivalents — this set is self-contained and doesn't depend on the template's own workflow.

Then edit `module.json`: replace every `REPLACE_WITH_YOUR_GITHUB` with your GitHub username (three places).

---

## One-time human setup (do these once, then never again)

### Step 1 — Password-free `git push` (5 minutes)

So `npm run release` can push without prompting. Two options; pick one:

- **SSH key (recommended).** Generate a key, add the public half to GitHub → Settings → SSH and GPG keys. Then your pushes authenticate with the key — no password, ever.
  ```
  ssh-keygen -t ed25519 -C "your-email"        # accept defaults
  cat ~/.ssh/id_ed25519.pub                     # copy this, paste into GitHub
  ```
  Set the repo's remote to SSH: `git remote set-url origin git@github.com:<you>/continuity-engine.git`
- **Or:** if you already push from this machine without being asked for a password, you're done — your OS keychain is already handling it. Skip to Step 2.

Claude Code can run the `ssh-keygen` command and set the remote for you. It cannot paste the key into GitHub's website — you do that one paste yourself.

### Step 2 — (Later, not now) Foundry registry auto-publish

Skip this until your module is registered in Foundry's directory (that happens at first launch, via the Package Submission Form — see the roadmap, Phase 3). The pipeline works without it; the registry step simply stays dormant.

When you're ready, add three **encrypted secrets** in the repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret name | Value |
|---|---|
| `FVTT_PACKAGE_ID` | Your module's numeric ID (from its Foundry admin page URL) |
| `FVTT_USERNAME` | Your Foundry account username |
| `FVTT_PASSWORD` | Your Foundry account password |

You paste these into **GitHub's own secrets form**, in your browser. They're encrypted at rest, the workflow reads them at run time, and they're never printed in logs. Neither Code nor Claude sees them. The moment `FVTT_PACKAGE_ID` exists, the release workflow starts publishing to the Foundry registry automatically — no code change needed.

---

## How you ship, from now on

```
npm run release          # patch: 1.0.0 → 1.0.1
npm run release minor    # 1.0.0 → 1.1.0
npm run release major    # 1.0.0 → 2.0.0
npm run release 1.4.2    # exact version
```

That's the whole thing. It bumps the version in both files, commits, tags `vX.Y.Z`, and pushes the tag. The tag push triggers `release.yml`, which builds and publishes. Watch it at `github.com/<you>/continuity-engine/actions`.

The manifest URL you share / register for installs is always:
```
https://github.com/<you>/continuity-engine/releases/latest/download/module.json
```

---

## Division of labor

- **You, in the game:** install the release in a live v14 world, test, re-test. This is the loop you keep.
- **Code, in the repo:** writes the module, runs `npm run build` locally to verify it compiles, and can run `npm run release` when you tell it to ship.
- **GitHub Actions, unattended:** builds, packages, attaches assets, and (once registered) publishes to the Foundry registry — every time, with no password entered.

If Code ever reports it "can't enter a password" during a release, nothing is wrong — the pipeline isn't supposed to. The credential entry lives entirely in the two one-time browser steps above.
