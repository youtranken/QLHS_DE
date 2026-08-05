import { useCallback, useEffect, useState } from 'react'
import { t } from '../../i18n'
import { StateNotice } from '../../shared/StateNotice'
import { toast } from '../../shared/toast'
import {
  getSmtpConfig,
  saveSmtpConfig,
  testSmtpConfig,
  type SmtpConfigInput,
  type SmtpConfigView,
} from './smtpApi'

const EMPTY: SmtpConfigInput = { host: '', port: 587, secure: false, username: '', password: '', from: '' }

/** Admin › Cấu hình › Email (SMTP). SA-only. The password is write-only: the API
 *  never returns it, so the field stays blank and "keep" means "don't change". */
export function AdminConfig() {
  const [cfg, setCfg] = useState<SmtpConfigView | null>(null)
  const [form, setForm] = useState<SmtpConfigInput>(EMPTY)
  const [testTo, setTestTo] = useState('')
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoadErr(null)
    try {
      const v = await getSmtpConfig()
      setCfg(v)
      setForm({ host: v.host, port: v.port, secure: v.secure, username: v.username, password: '', from: v.from })
    } catch {
      setLoadErr(t('adminConfig.loadErr'))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const set = <K extends keyof SmtpConfigInput>(k: K, v: SmtpConfigInput[K]) =>
    setForm((s) => ({ ...s, [k]: v }))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await saveSmtpConfig(form)
      toast.ok(t('adminConfig.saved'))
      setForm((s) => ({ ...s, password: '' }))
      await load()
    } catch (err) {
      toast.err((err as { message?: string })?.message ?? t('adminConfig.saveErr'))
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    if (!testTo.trim()) return
    setTesting(true)
    try {
      await testSmtpConfig({ ...form, to: testTo.trim() })
      toast.ok(t('adminConfig.testSent', { to: testTo.trim() }))
    } catch (err) {
      toast.err((err as { message?: string })?.message ?? t('adminConfig.testErr'))
    } finally {
      setTesting(false)
    }
  }

  if (loadErr) return <StateNotice kind="error" text={loadErr} onRetry={() => void load()} />
  if (!cfg) return <StateNotice kind="loading" text={t('adminConfig.loading')} />

  return (
    <section aria-label={t('adminConfig.title')} className="cfg-pane">
      <header className="cfg-head">
        <h1>{t('adminConfig.title')}</h1>
      </header>

      {!cfg.encKeyReady && <p className="cfg-warn" role="alert">{t('adminConfig.noEncKey')}</p>}

      <form className="panel cfg-form" onSubmit={save}>
        <label className="cfg-field cfg-wide">
          <span>{t('adminConfig.host')}</span>
          <input value={form.host} onChange={(e) => set('host', e.target.value)} placeholder="smtp.pmh.com.vn" autoComplete="off" />
          <em className="cfg-hint">{t('adminConfig.hostHint')}</em>
        </label>

        <label className="cfg-field">
          <span>{t('adminConfig.port')}</span>
          <input type="number" min={1} max={65535} value={form.port} onChange={(e) => set('port', Number(e.target.value))} />
        </label>

        <label className="cfg-field cfg-check">
          <input type="checkbox" checked={form.secure} onChange={(e) => set('secure', e.target.checked)} />
          <span>{t('adminConfig.secure')}</span>
        </label>

        <label className="cfg-field">
          <span>{t('adminConfig.username')}</span>
          <input value={form.username} onChange={(e) => set('username', e.target.value)} autoComplete="off" />
        </label>

        <label className="cfg-field">
          <span>{t('adminConfig.password')}</span>
          <input
            type="password"
            value={form.password ?? ''}
            onChange={(e) => set('password', e.target.value)}
            placeholder={cfg.hasPassword ? t('adminConfig.pwKept') : ''}
            autoComplete="new-password"
          />
        </label>

        <label className="cfg-field cfg-wide">
          <span>{t('adminConfig.from')}</span>
          <input value={form.from} onChange={(e) => set('from', e.target.value)} placeholder="qlhs@pmh.com.vn" autoComplete="off" />
        </label>

        <div className="cfg-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? t('adminConfig.saving') : t('adminConfig.save')}
          </button>
        </div>
      </form>

      <div className="panel cfg-test">
        <h2>{t('adminConfig.testTitle')}</h2>
        <p className="cfg-hint">{t('adminConfig.testHint')}</p>
        <div className="cfg-test-row">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder={t('adminConfig.testToPlaceholder')}
            aria-label={t('adminConfig.testTo')}
          />
          <button type="button" className="btn secondary" onClick={() => void test()} disabled={testing || !testTo.trim()}>
            {testing ? t('adminConfig.testSending') : t('adminConfig.testSend')}
          </button>
        </div>
      </div>
    </section>
  )
}
