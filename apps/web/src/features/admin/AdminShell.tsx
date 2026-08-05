import { useEffect, useRef, useState } from 'react'
import { Menu, Moon, Sun, Globe, LogOut } from 'lucide-react'
import type { Role } from '@qlhs/contracts'
import { t } from '../../i18n'
import { adminSectionOf, openAdminSection } from '../../shared/route'
import { currentLocale, switchLocale } from '../../i18n/locale'
import { RoleSwitcher } from '../auth/RoleSwitcher'
import { AdminUsers } from './AdminUsers'
import { SlaConfigAdmin } from './SlaConfigAdmin'
import { AdminPauses } from './AdminPauses'
import { AdminAnalytics } from './AdminAnalytics'
import { AdminOverview } from './AdminOverview'
import { AdminAudit } from './AdminAudit'
import { AdminOptions } from './AdminOptions'
import { AdminConfig } from './AdminConfig'

export type AdminSection = 'overview' | 'roles' | 'options' | 'sla' | 'pause' | 'analytics' | 'audit' | 'config'

const SECTIONS: ReadonlySet<string> = new Set([
  'overview', 'roles', 'options', 'sla', 'pause', 'analytics', 'audit', 'config',
])

/** /admin/<section> → section hợp lệ; path lạ/trống → overview. */
function sectionFromPath(path: string): AdminSection {
  const s = adminSectionOf(path)
  return s !== null && SECTIONS.has(s) ? (s as AdminSection) : 'overview'
}

type IconName = 'overview' | 'users' | 'options' | 'sla' | 'pause' | 'analytics' | 'audit' | 'config'

interface NavItem {
  key: AdminSection
  label: string
  ready: boolean
  icon: IconName
}

/** Thứ tự nav theo SPEC 15-admin-overview: Tổng quan đầu tiên. Hàm (không phải
 *  const) để nhãn t() đọc lại catalog mỗi render — sẵn cho đổi ngôn ngữ. */
const navItems = (): NavItem[] => [
  { key: 'overview', label: t('adminShell.nav.overview'), ready: true, icon: 'overview' },
  { key: 'roles', label: t('adminShell.nav.roles'), ready: true, icon: 'users' },
  { key: 'options', label: t('adminShell.nav.options'), ready: true, icon: 'options' },
  { key: 'sla', label: t('adminShell.nav.sla'), ready: true, icon: 'sla' },
  { key: 'pause', label: t('adminShell.nav.pause'), ready: true, icon: 'pause' },
  { key: 'analytics', label: t('adminShell.nav.analytics'), ready: true, icon: 'analytics' },
  { key: 'audit', label: t('adminShell.nav.audit'), ready: true, icon: 'audit' },
  { key: 'config', label: t('adminShell.nav.config'), ready: true, icon: 'config' },
]

/** All admin sections are now backed by real APIs (N1–N4); kept for future panes. */
const SOON: Partial<Record<AdminSection, string>> = {}

/** Hai initial từ tên cho avatar cuối rail. */
function initials(s: string): string {
  const parts = s.trim().split(/\s+/).filter(Boolean)
  const pick = parts.length >= 2 ? parts[parts.length - 2]! + parts[parts.length - 1]! : s
  return pick
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || 'QT'
}

/** SA quản-trị shell (audit §K): sidebar full-height (brand đỉnh · nav · cụm
 *  user+vai+theme+thoát đáy) + một pane đang active. Admin không dùng topbar —
 *  mọi chrome gom vào sidebar. */
export function AdminShell({
  userName = t('adminShell.defaultUserName'),
  roles = [],
  activeRole = null,
  onChangeRole,
  onLogout,
}: {
  userName?: string
  roles?: Role[]
  activeRole?: Role | null
  onChangeRole?: (r: Role) => void
  onLogout?: () => void
}) {
  // Section sống trong URL (/admin/<section>) để deep-link/F5/back-forward;
  // state đổi ngay khi click, popstate đồng bộ khi điều hướng bằng browser.
  const [section, setSection] = useState<AdminSection>(() => sectionFromPath(window.location.pathname))
  useEffect(() => {
    const onPop = () => setSection(sectionFromPath(window.location.pathname))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const go = (key: AdminSection) => {
    setSection(key)
    openAdminSection(key)
  }

  // Mobile nav is a horizontal pill strip. Track scroll position so CSS can fade
  // the edge(s) that still have off-screen pills (an intentional "swipe for more"
  // affordance instead of a raw scrollbar), and keep the active pill in view.
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const sync = () => {
      const slack = el.scrollWidth - el.clientWidth
      el.dataset.fadeStart = String(el.scrollLeft > 4)
      el.dataset.fadeEnd = String(el.scrollLeft < slack - 4)
    }
    sync()
    el.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync)
    return () => {
      el.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('button.on')
    // Progressive enhancement — skip where scrollIntoView isn't implemented (jsdom).
    try {
      active?.scrollIntoView({ inline: 'center', block: 'nearest' })
    } catch {
      /* no-op */
    }
  }, [section])

  // Icon theme toggle lives in the account menu (same logic as the shared ThemeToggle).
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? 'dark')
  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    document.documentElement.dataset.theme = next
    localStorage.setItem('qlhs-theme', next)
    setTheme(next)
  }

  // Collapse the sidebar to an icon rail (QLTS pattern). The account actions
  // (ngôn ngữ/theme/thoát) hide behind a click on the user name.
  const [collapsed, setCollapsed] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const footRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const userBtnRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (footRef.current && !footRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    // Esc closes and returns focus to the trigger (a role=menu must be keyboard-operable).
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        userBtnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    // Move focus into the menu on open so keyboard users land on an actionable item.
    const first = menuRef.current?.querySelector<HTMLElement>(
      '[role="menuitem"]:not([aria-disabled="true"])',
    )
    first?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  return (
    <div className={collapsed ? 'adminshell collapsed' : 'adminshell'}>
      <aside className="adminside">
        <div className="nvhd">
          <span className="brandmark" aria-hidden>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
              <path d="M4 17V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10" />
              <circle cx="8.5" cy="17.5" r="1.6" />
              <circle cx="15.5" cy="17.5" r="1.6" />
              <path d="M4 12h16" />
            </svg>
          </span>
          <span>
            <span className="t">{t('adminShell.brand.title')}</span>
            <span className="s">{t('adminShell.brand.sub')}</span>
          </span>
        </div>

        <nav className="adminnav" aria-label={t('adminShell.navAria')} ref={navRef}>
          {navItems().map((n) => (
            <button
              key={n.key}
              type="button"
              className={section === n.key ? 'on' : ''}
              aria-current={section === n.key ? 'page' : undefined}
              title={n.label}
              onClick={() => go(n.key)}
            >
              <span className="ic" aria-hidden>
                <NavIcon name={n.icon} />
              </span>
              <span className="txt">
                <span className="lbl">
                  {n.label}
                  {!n.ready && <em className="soon-tag">{t('adminShell.soonTag')}</em>}
                </span>
              </span>
            </button>
          ))}
        </nav>

        <div className="sidefoot" ref={footRef}>
          {roles.length > 1 && onChangeRole && !collapsed && (
            <RoleSwitcher roles={roles} activeRole={activeRole} onChange={onChangeRole} />
          )}
          {menuOpen && (
            <div className="sb-actions" role="menu" id="sb-account-menu" ref={menuRef}>
              <div className="sb-act-row">
                <button
                  type="button"
                  className="sb-act lang"
                  role="menuitem"
                  title={t('adminShell.language')}
                  onClick={() => switchLocale(currentLocale() === 'vi' ? 'en' : 'vi')}
                >
                  <Globe size={15} aria-hidden />
                  {t('adminShell.language')}
                  <span className="sb-badge">{currentLocale().toUpperCase()}</span>
                </button>
                <button
                  type="button"
                  className="sb-act theme-ic"
                  role="menuitem"
                  onClick={toggleTheme}
                  title={theme === 'light' ? t('adminShell.themeDark') : t('adminShell.themeLight')}
                  aria-label={theme === 'light' ? t('adminShell.themeDark') : t('adminShell.themeLight')}
                >
                  {theme === 'light' ? <Moon size={16} aria-hidden /> : <Sun size={16} aria-hidden />}
                </button>
              </div>
              {onLogout && (
                <button type="button" className="sb-act danger" role="menuitem" onClick={onLogout}>
                  <LogOut size={15} aria-hidden />
                  {t('adminShell.logout')}
                </button>
              )}
            </div>
          )}
          <div className="suser-row">
            <button
              type="button"
              className="sb-collapse"
              onClick={() => setCollapsed((v) => !v)}
              title={collapsed ? t('adminShell.expandNav') : t('adminShell.collapseNav')}
              aria-label={collapsed ? t('adminShell.expandNav') : t('adminShell.collapseNav')}
            >
              <Menu size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="sb-userbtn"
              ref={userBtnRef}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? 'sb-account-menu' : undefined}
              title={collapsed ? t('adminShell.expandNav') : t('adminShell.accountMenu')}
              onClick={() => {
                // Collapsed rail → clicking the user expands the sidebar first (UX),
                // then reveals the account menu.
                if (collapsed) {
                  setCollapsed(false)
                  setMenuOpen(true)
                } else {
                  setMenuOpen((v) => !v)
                }
              }}
            >
              <span className="av" aria-hidden>{initials(userName)}</span>
              <span className="who">
                <span className="nm">{userName}</span>
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="adminmain">
        {section === 'overview' && <AdminOverview onNavigate={go} />}
        {section === 'roles' && <AdminUsers />}
        {section === 'sla' && <SlaConfigAdmin />}
        {section === 'pause' && <AdminPauses />}
        {section === 'analytics' && <AdminAnalytics />}
        {section === 'audit' && <AdminAudit />}
        {section === 'options' && <AdminOptions />}
        {section === 'config' && <AdminConfig />}
        {SOON[section] && <div className="console-soon">{SOON[section]}</div>}
      </div>
    </div>
  )
}

function NavIcon({ name }: { name: IconName }) {
  const p = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'overview':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z" />
        </svg>
      )
    case 'users':
      return (
        <svg {...p}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case 'options':
      return (
        <svg {...p}>
          <path d="M4 6h16M4 12h16M4 18h9" />
          <circle cx="18" cy="18" r="2.4" />
        </svg>
      )
    case 'sla':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )
    case 'pause':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 9v6M14 9v6" />
        </svg>
      )
    case 'analytics':
      return (
        <svg {...p}>
          <path d="M3 3v18h18" />
          <path d="M7 15l3-4 3 2 4-6" />
        </svg>
      )
    case 'audit':
      return (
        <svg {...p}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      )
    case 'config':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
  }
}
