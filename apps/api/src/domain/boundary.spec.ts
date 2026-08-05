import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

/**
 * Proves the AD-1 boundary rule actually fails a violating domain file — the
 * rule is enforcement, not just documentation. Runs ESLint on virtual files
 * placed under the domain path so the flat-config glob applies.
 */
describe('AD-1 boundary rule (domain core stays pure)', () => {
  async function lintDomain(code: string) {
    const eslint = new ESLint({ cwd: process.cwd() })
    const [result] = await eslint.lintText(code, {
      filePath: 'apps/api/src/domain/_probe.ts',
    })
    return result!.messages
  }

  it('flags a domain file importing @nestjs/*', async () => {
    const msgs = await lintDomain(
      "import { Injectable } from '@nestjs/common'\nexport const x = 1\n",
    )
    expect(msgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true)
  })

  it('flags a domain file importing @prisma/client', async () => {
    const msgs = await lintDomain(
      "import { PrismaClient } from '@prisma/client'\nexport const x = 1\n",
    )
    expect(msgs.some((m) => m.ruleId === 'no-restricted-imports')).toBe(true)
  })

  it('allows a pure domain file', async () => {
    const msgs = await lintDomain(
      'export const add = (a: number, b: number): number => a + b\n',
    )
    expect(msgs.filter((m) => m.severity === 2)).toHaveLength(0)
  })
})
