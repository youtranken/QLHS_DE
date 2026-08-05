import { apiGet } from './api-client'
import { setVpName } from '../i18n'

interface PublicConfig {
  vpName: string
}

/** Load public app config (VP display name) and apply it before labels render.
 *  Best-effort: any failure leaves the built-in default ("Andy"). */
export async function loadPublicConfig(): Promise<void> {
  try {
    const cfg = await apiGet<PublicConfig>('/config')
    setVpName(cfg.vpName)
  } catch {
    // keep the default name
  }
}
