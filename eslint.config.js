import tsParser from '@typescript-eslint/parser'

/**
 * AD-1 (domain core is pure): files under apps/api/src/domain/** must not import
 * framework/IO. Enforced in CI-check, not just convention. `lint:boundaries`
 * runs this; a violation fails the build (see domain/boundary.spec.ts).
 */
export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.example.ts'] },
  {
    files: ['apps/api/src/domain/**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@prisma/client', message: 'AD-1: domain không được import Prisma.' },
          ],
          patterns: [
            { group: ['@nestjs/*'], message: 'AD-1: domain không được import NestJS.' },
            { group: ['@prisma/*'], message: 'AD-1: domain không được import Prisma.' },
            {
              group: ['**/http/**', '**/infra/**'],
              message: 'AD-1: domain không được import http/infra.',
            },
          ],
        },
      ],
    },
  },
]
