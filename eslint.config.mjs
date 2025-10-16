// eslint.config.mjs
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import ts from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';

export default [
  // 1) 全局忽略（Flat Config 不看 .eslintignore）
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  // 2) 仅给 JS 文件（如果仓库里有 JS）应用 JS 推荐规则
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: { ...js.configs.recommended.rules },
  },

  // 3) TS 规则（只扫源码/测试，不会再扫 dist）
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname, // 重要：定位 tsconfig
      },
    },
    plugins: { '@typescript-eslint': ts },
    rules: {
      ...ts.configs.recommended.rules,
      'no-console': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },

  // 4) 关闭与 Prettier 冲突的规则（放最后）
  prettier,
];
