// One-command release. Usage:
//   npm run release            -> bumps patch  (1.0.0 -> 1.0.1)
//   npm run release minor      -> bumps minor  (1.0.0 -> 1.1.0)
//   npm run release major      -> bumps major  (1.0.0 -> 2.0.0)
//   npm run release 1.4.2      -> sets exactly that version
//
// It updates the version in module.json + package.json, commits, tags vX.Y.Z,
// and pushes. Pushing the tag is what triggers .github/workflows/release.yml,
// which builds, packages, and publishes with NO further input from you.
//
// This uses your machine's existing git auth (SSH key or cached token). No password
// is entered here or anywhere in the pipeline — see SETUP.md, step 1.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const run = (cmd) => execSync(cmd, { stdio: "pipe" }).toString().trim();
const arg = process.argv[2] ?? "patch";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const [maj, min, pat] = pkg.version.split(".").map(Number);

let next;
if (arg === "major") next = `${maj + 1}.0.0`;
else if (arg === "minor") next = `${maj}.${min + 1}.0`;
else if (arg === "patch") next = `${maj}.${min}.${pat + 1}`;
else if (/^\d+\.\d+\.\d+$/.test(arg)) next = arg;
else { console.error(`Unrecognized version arg: "${arg}"`); process.exit(1); }

// Refuse to release a dirty tree — a release must be a clean, known state.
if (run("git status --porcelain")) {
  console.error("Working tree is not clean. Commit or stash first, then release.");
  process.exit(1);
}

for (const file of ["package.json", "module.json"]) {
  const json = JSON.parse(readFileSync(file, "utf8"));
  json.version = next;
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}

run(`git add package.json module.json`);
run(`git commit -m "Release v${next}"`);
run(`git tag v${next}`);
run(`git push`);
run(`git push origin v${next}`);

console.log(`\n✓ Released v${next}.`);
console.log(`  GitHub Actions is now building and publishing it.`);
console.log(`  Watch: https://github.com/<your-repo>/actions`);
