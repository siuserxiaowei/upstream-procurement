import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/upstream-procurement/",
  test: {
    environment: "jsdom",
    // .worktrees holds parallel-dev git worktrees (copies of this repo);
    // never let vitest pick up their duplicate test files.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
  },
});
