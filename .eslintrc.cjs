/**
 * factor-desktop ESLint config.
 *
 * Tier 1 단계 — `no-restricted-imports` 한 룰로 FE 페이지 import 차단.
 * Tier 3 단계에서 `eslint-plugin-boundaries` + `dependency-cruiser` 로 확장.
 *
 * 룰북: ../CLAUDE.md § 코드 분리 룰북 (R1, R2)
 */

/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: [
    "dist",
    "dist-electron",
    "release",
    "node_modules",
    "scripts/**/*.cjs",
    "*.config.ts",
    "*.config.js",
    "*.config.cjs",
    ".eslintrc.cjs",
  ],
  rules: {
    // ─────────────────────────────────────────────────────────────
    // R1, R2 — FE 페이지 import 차단 (예외 없음, auth 포함)
    // ─────────────────────────────────────────────────────────────
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/pages", "@/pages/*", "@/pages/**"],
            message:
              "데스크탑은 FE 페이지(anomaly-eye-monitor/src/pages/*)를 import 할 수 없음. " +
              "leaf 컴포넌트/hook 만 import 하고 자체 페이지를 factor-desktop/src/pages/ 에 구현하세요. " +
              "auth 페이지도 예외 없음. 룰북: CLAUDE.md § R1, R2.",
          },
        ],
      },
    ],
    // TypeScript 권장 룰 중 너무 시끄러운 일부 완화 (Tier 1 단계의 안전한 default)
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    "@typescript-eslint/no-empty-object-type": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
};
