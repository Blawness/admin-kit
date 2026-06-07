import js from "@eslint/js";
import tseslint from "typescript-eslint";

// The source uses `eslint-disable` comments that reference rules from plugins
// not installed here (Next.js / jsx-a11y, which run in the consuming app).
// Register no-op stub rules so those directives don't error in this package's
// standalone lint. Stub rules never report, so the directives are also treated
// as "unused" — which we silence via linterOptions below.
const stub = { meta: {}, create: () => ({}) };
const stubPlugin = (rules) => ({
  rules: Object.fromEntries(rules.map((r) => [r, stub])),
});

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "drizzle/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {
      "@next/next": stubPlugin(["no-img-element"]),
      "jsx-a11y": stubPlugin(["no-autofocus"]),
    },
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "no-useless-assignment": "off",
    },
  }
);
