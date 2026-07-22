// Build: bundle src/module.ts -> dist/module.js, then copy static assets + manifest into dist/.
// Keeps the release workflow simple: it just runs `npm run build` and zips dist/.
import { build } from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });

// 1) Bundle the module entrypoint. Adjust entryPoints if yours differs.
await build({
  entryPoints: ["src/module.ts"],
  outfile: "dist/module.js",
  bundle: true,
  format: "esm",
  target: "es2022",
  sourcemap: true,
  // Foundry globals (game, ui, foundry, CONFIG, Hooks…) are provided at runtime.
  // esbuild leaves undeclared globals alone by default, so nothing to externalize.
});

// 2) Copy static assets that exist. None are required for the build to succeed.
for (const dir of ["templates", "lang", "styles", "assets"]) {
  if (existsSync(dir)) cpSync(dir, `dist/${dir}`, { recursive: true });
}

// 3) Copy the manifest. The release workflow stamps version/url/download into this copy.
cpSync("module.json", "dist/module.json");

console.log("Built dist/ ✓");
