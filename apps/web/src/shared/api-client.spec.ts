import { describe, it, expect, vi, afterEach } from 'vitest'
import { apiGet, ApiClientError, setOnSessionExpired } from './api-client'

function stubFetch(status: number, body: unknown, jsonThrows = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (jsonThrows) throw new Error('not json')
        return body
      },
    }),
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('api-client', () => {
  it('returns the parsed body on success', async () => {
    stubFetch(200, { ok: true, n: 3 })
    await expect(apiGet('/x')).resolves.toEqual({ ok: true, n: 3 })
  })

  it('surfaces the server error envelope (code + message) on failure', async () => {
    stubFetch(409, { code: 'AlreadyPicked', message: 'Đang được d1 xử lý' })
    await expect(apiGet('/x')).rejects.toMatchObject({
      status: 409,
      code: 'AlreadyPicked',
      message: 'Đang được d1 xử lý',
    })
  })

  it('still throws an ApiClientError when the error body is not JSON', async () => {
    stubFetch(500, null, true)
    const err = (await apiGet('/x').catch((e: unknown) => e)) as ApiClientError
    expect(err).toBeInstanceOf(ApiClientError)
    expect(err.status).toBe(500)
    expect(err.code).toBeUndefined()
  })

  it('fires the session-expiry hook on a 401 from a real endpoint', async () => {
    const onExpire = vi.fn()
    setOnSessionExpired(onExpire)
    stubFetch(401, { code: 'Unauthorized' })
    await expect(apiGet('/tickets')).rejects.toBeInstanceOf(ApiClientError)
    expect(onExpire).toHaveBeenCalledOnce()
  })

  it('does NOT fire expiry on a 401 from an /auth/ endpoint', async () => {
    const onExpire = vi.fn()
    setOnSessionExpired(onExpire)
    stubFetch(401, { code: 'Unauthorized' })
    await expect(apiGet('/auth/me')).rejects.toBeInstanceOf(ApiClientError)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('does NOT bounce on a 401 while a modal/form is open — it would discard the user’s input', async () => {
    const onExpire = vi.fn()
    setOnSessionExpired(onExpire)
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)
    stubFetch(401, { code: 'Unauthorized' })
    await expect(apiGet('/tickets')).rejects.toBeInstanceOf(ApiClientError)
    expect(onExpire).not.toHaveBeenCalled()
    document.body.removeChild(dialog)
  })
})
