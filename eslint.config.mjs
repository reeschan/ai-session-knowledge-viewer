import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      // 既存コード (scripts/check-logs.ts:8) が、`{ finalResponse: _finalResponse, ...rest }` のように
      // 使わない値を先頭 `_` の名前で受けて捨てている。コードは直さず、`_` 始まりの未使用は許す。
      // (他の未使用変数・引数は引き続きエラーにする)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    "node_modules/**",
    "public/**",
    "docs/**",
  ]),
]);

export default eslintConfig;
