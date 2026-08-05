import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './design/fonts.css'
import './design/tokens.css'
import './design/components/index.css'
import './design/shell/index.css'
import './design/login/index.css'
import './design/board.css'
import './design/board-bulk.css'
import './design/select.css'
import './design/datepicker.css'
import './design/metro/index.css'
import './design/cards/index.css'
import './design/table/index.css'
import './design/detail.css'
import './design/modal.css'
import './design/admin.css'
import './design/admin-nav.css'
import './design/admin-overview/index.css'
import './design/admin-users/index.css'
import './design/admin-sla/index.css'
import './design/admin-audit.css'
import './design/admin-options.css'
import './design/admin-analytics.css'
import './design/admin-config.css'
// Admin redesign · Vân Đài (Aurora) — scoped to .adminshell, loaded LAST
// so its token overrides win over the base admin CSS above.
import './design/admin-aurora/tokens.css'
import './design/admin-aurora/kit.css'
import { App } from './App'
import { applyStartupLocale } from './i18n/locale'

// Dark is the default surface (EXPERIENCE §Foundation); light is a peer. Set the
// theme before first paint to avoid a flash.
const saved = localStorage.getItem('qlhs-theme')
document.documentElement.dataset.theme = saved === 'light' ? 'light' : 'dark'

// Apply the saved UI language before first render (VI is the built-in default).
applyStartupLocale()

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
