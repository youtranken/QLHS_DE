import { describe, it, expect } from 'vitest'
import type { AppConfigRepo } from '../../infra/prisma/config/app-config.repo'
import { GetAppConfigUseCase } from './get-app-config.usecase'
import { UpdateAppConfigUseCase, InvalidVpNameError } from './update-app-config.usecase'

interface Row {
  id: number
  vpName: string
  updatedBy: string | null
}

function fakeRepo(initial: Partial<Row> | null = null) {
  let row: Row | null = initial ? { id: 1, vpName: 'Andy', updatedBy: null, ...initial } : null
  const repo = {
    get: async () => row,
    upsert: async (data: { vpName: string; updatedBy: string | null }) => {
      row = { id: 1, ...data }
      return row
    },
    current: () => row,
  }
  return repo as unknown as AppConfigRepo & { current: () => Row | null }
}

describe('AppConfig use-cases (VP name)', () => {
  it('defaults to Andy when no row exists', async () => {
    expect(await new GetAppConfigUseCase(fakeRepo()).execute()).toEqual({ vpName: 'Andy' })
  })

  it('returns the stored name', async () => {
    expect(await new GetAppConfigUseCase(fakeRepo({ vpName: 'Bình' })).execute()).toEqual({ vpName: 'Bình' })
  })

  it('falls back to Andy when the stored value is blank', async () => {
    expect(await new GetAppConfigUseCase(fakeRepo({ vpName: '   ' })).execute()).toEqual({ vpName: 'Andy' })
  })

  it('trims and persists a new name with the actor', async () => {
    const repo = fakeRepo()
    await new UpdateAppConfigUseCase(repo).execute('  Khang  ', 'admin-sub')
    expect(repo.current()).toMatchObject({ vpName: 'Khang', updatedBy: 'admin-sub' })
  })

  it('rejects blank or over-long names', async () => {
    const repo = fakeRepo()
    await expect(new UpdateAppConfigUseCase(repo).execute('   ', 'a')).rejects.toBeInstanceOf(InvalidVpNameError)
    await expect(new UpdateAppConfigUseCase(repo).execute('x'.repeat(41), 'a')).rejects.toBeInstanceOf(
      InvalidVpNameError,
    )
  })
})
