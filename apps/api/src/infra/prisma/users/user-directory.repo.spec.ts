import { describe, it, expect } from 'vitest'
import { UserDirectoryRepo } from './user-directory.repo'
import type { PrismaService } from '../prisma.service'

/** Captures the args a Prisma call receives without touching a database. */
function fakePrisma() {
  const calls: unknown[] = []
  const prisma = {
    user: {
      upsert: async (args: unknown) => {
        calls.push(args)
        return {}
      },
    },
  } as unknown as PrismaService
  return { prisma, calls }
}

describe('UserDirectoryRepo.upsertUser', () => {
  it('upserts by sub and writes the display fields', async () => {
    const { prisma, calls } = fakePrisma()

    await new UserDirectoryRepo(prisma).upsertUser({
      sub: 'u-1',
      fullName: 'Nguyen Van A',
      email: 'a@pmh.com.vn',
    })

    expect(calls).toEqual([
      {
        where: { sub: 'u-1' },
        create: { sub: 'u-1', fullName: 'Nguyen Van A', email: 'a@pmh.com.vn' },
        update: { fullName: 'Nguyen Van A', email: 'a@pmh.com.vn' },
      },
    ])
  })

  it('normalises missing display fields to null so a later login can clear them', async () => {
    const { prisma, calls } = fakePrisma()

    await new UserDirectoryRepo(prisma).upsertUser({ sub: 'u-2' })

    expect(calls).toEqual([
      {
        where: { sub: 'u-2' },
        create: { sub: 'u-2', fullName: null, email: null },
        update: { fullName: null, email: null },
      },
    ])
  })
})
