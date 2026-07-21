import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "scripts",
    emptyOutDir: true,
    target: "esnext",
    minify: false,
    sourcemap: true,
    lib: {
      entry: "src/module.ts",
      formats: ["es"],
      fileName: () => "module.js",
    },
  },
});
