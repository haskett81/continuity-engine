import { defineConfig } from "vitest/config";

// Kept separate from vite.config.ts so running tests never touches the build settings.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
