import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "coverage/**",
    "dist/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    ".vite/**",
  ]),

  eslint.configs.recommended,

  {
    files: ["src/**/*.ts"],
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // show up older patterns with modern equivalents
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-object-has-own': 'error',
      'prefer-object-spread': 'error',
      'prefer-template': 'error',

      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": "off",

      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',

      // TS: enforce consistent syntax where multiple spellings exist
      '@typescript-eslint/consistent-generic-constructors': 'error',
      '@typescript-eslint/consistent-indexed-object-style': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
      '@typescript-eslint/prefer-function-type': 'error',

      // TS: reduce noise and strip redundant annotations, consolidate type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/consistent-type-exports": [
        "error",
        { fixMixedExportsWithInlineTypeSpecifier: true },
      ],

      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/no-confusing-void-expression": [
        "error",
        { ignoreArrowShorthand: true },
      ],
      "@typescript-eslint/non-nullable-type-assertion-style": "off",

      complexity: ["error", 25],
      "max-depth": ["error", 4],
      "max-lines-per-function": [
        "error",
        { max: 250, skipBlankLines: true, skipComments: true },
      ],

      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  {
    files: ["*.config.{js,ts}"],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
    },
  },

  {
    files: ["tests/**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
