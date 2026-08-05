import { useEffect, useState } from 'react'
import { t } from '../i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/** Đồng hồ ca trực trong topbar: HH:MM · Tn DD/MM, cập nhật mỗi phút. */
export function Clock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  const dow = t('shell.clock.dow').split(',')
  const txt = `${pad(now.getHours())}:${pad(now.getMinutes())} · ${dow[now.getDay()]} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`
  return <span className={className}>{txt}</span>
}
