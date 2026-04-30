import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/out/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/prisma/generated/**",
      "**/next-env.d.ts",
      "**/.github/**",
      "src/renderer/public/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/core/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "src/shared/**/*.ts",
      "electron.vite.config.ts",
      "tailwind.config.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    ignores: [
      "src/renderer/lib/platform/**",
      "src/renderer/**/*.test.ts",
      "src/renderer/**/*.test.tsx",
      "src/renderer/vite-env.d.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='window'][property.name='api']",
          message: "Use the renderer platform adapter instead of direct window.api access.",
        },
      ],
    },
  },
  prettierConfig
);
