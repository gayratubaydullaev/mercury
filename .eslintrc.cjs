module.exports = {
  root: true,
  ignorePatterns: ['node_modules', 'dist', '.next', 'coverage'],
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      parserOptions: { project: ['./apps/*/tsconfig.json', './packages/*/tsconfig.json'] },
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:@typescript-eslint/strict',
        'prettier',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      },
    },
  ],
};
