import eslint from "@eslint/js"
import eslintConfigPrettier from "eslint-config-prettier"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["**/dist/**", "**/coverage/**", "**/drizzle/**", "node_modules/**"] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: ["**/*.ts", "**/*.tsx"] })),
  ...tseslint.configs.stylisticTypeChecked.map((c) => ({ ...c, files: ["**/*.ts", "**/*.tsx"] })),
  eslintConfigPrettier,
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs", "**/*.config.ts", "vitest.workspace.ts"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.ts", "packages/*/*.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/prefer-readonly": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-param-reassign": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/dot-notation": ["error", { allowIndexSignaturePropertyAccess: true }],
    },
  },
)
