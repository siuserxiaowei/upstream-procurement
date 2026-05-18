import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist", ".tmp", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      // Legitimate mount-fetch pattern (async data load in []-effect):
      // rewriting would be churn with no behavior benefit. Keep as advisory.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // CommonJS build-tooling config files (postcss/tailwind) use Node's
    // `module` global. Declare the CommonJS environment so it isn't flagged.
    files: ["postcss.config.js", "tailwind.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
  },
);
