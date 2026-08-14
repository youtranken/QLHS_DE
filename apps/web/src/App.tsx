import { useState } from 'react'
import { ROLE } from '@qlhs/contracts'
import { ChevronDown, Map as MapIcon } from 'lucide-react'
import { t } from './i18n'
import { apiPost } from './shared/api-client'
import { prettyName } from './shared/format'
import { ThemeToggle } from './shared/ThemeToggle'
import { LocaleToggle } from './shared/LocaleToggle'
import { ToastHost } from './shared/ToastHost'
import { Clock } from './shared/Clock'
import { useRoute, goHome } from './shared/route'
import { useIdleLogout } from './shared/useIdleLogout'
import { useLocaleVersion } from './i18n/locale'
import { useCurrentUser } from './features/auth/useCurrentUser'
import { RoleSwitcher } from './features/auth/RoleSwitcher'
import { roleLabel } from './features/auth/roleLabel'
import { NotificationBell } from './features/notifications/NotificationBell'
import { TicketDetail } from './features/tickets/TicketDetail'
import { LoginPage } from './features/auth/LoginPage'
import { useSsoAutostart } from './features/auth/sso-autostart'
import RecordVault3D from './features/auth/RecordVault3D'
import { CreateTicketForm } from './features/tickets/CreateTicketForm'
import { MyTickets } from './features/tickets/MyTickets'
import { ApplicantSearch } from './features/tickets/ApplicantSearch'
import { AdminShell } from './features/admin/AdminShell'
import { LineMap } from './features/dispatch/LineMap'
import { StationBoard } from './features/board/StationBoard'
import { ClosedTickets } from './features/closed/ClosedTickets'
import { AssistantPanel } from './features/assistant/AssistantPanel'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const src = parts.length >= 2 ? parts[parts.length - 2] + ' ' + parts[parts.length - 1] : name
  return src
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

export function App() {
  useLocaleVersion() // re-render the whole tree in place when the language switches
  const { state, setActiveRole, reload } = useCurrentUser()
  // Opened FROM the PMH ID portal ("Mở dự án") with a live IdP session → hand off
  // to SSO so the user goes straight in, no email retype. A DIRECT visit keeps the
  // email form (and its break-glass SA path) — we never auto-redirect it.
  const authError = new URLSearchParams(window.location.search).get('auth_error') === 'access_denied'
  const handingOff = useSsoAutostart({ anonymous: state.status === 'anon', authError })
  const [reloadKey, setReloadKey] = useState(0)
  // The metro map is signage; DCC can collapse it to bring the actionable board up.
  const [mapOpen, setMapOpen] = useState(true)
  const route = useRoute()
  // Idle-logout 15' (khớp QLTS/PMH ID): poll ngầm giữ token sống nên phải đếm idle
  // theo tương tác thật ở client rồi đóng phiên. Chỉ tính khi đã đăng nhập.
  useIdleLogout(() => void apiPost('/auth/logout').then(reload), state.status === 'authed')

  if (state.status === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
        {t('shell.loading')}
      </div>
    )
  }

  if (state.status === 'anon') {
    // Redirecting to the portal SSO — show a wait screen, don't flash the form.
    if (handingOff) {
      return (
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--ink-3)' }}>
          {t('shell.loading')}
        </div>
      )
    }
    return (
      <div className="loginbg">
        <div className="login-wrap">
          {/* cột trái: chữ ở trên, dây chuyền hồ sơ chạy bên dưới */}
          <div className="login-hero reveal">
            <div className="login-hero__brand">
              <span className="q" aria-hidden>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M4 17V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10" />
                  <circle cx="8.5" cy="17.5" r="1.6" />
                  <circle cx="15.5" cy="17.5" r="1.6" />
                  <path d="M4 12h16" />
                </svg>
              </span>
              <b>QLHS</b>
            </div>
            <div className="login-hero__eyebrow">{t('auth.login.heroEyebrow')}</div>
            <h1 className="login-hero__title">
              {t('auth.login.heroTitle')}
              <br />
              <em>{t('auth.login.heroTitleEm')}</em>
            </h1>
            <p className="login-hero__lead">{t('auth.login.heroLead')}</p>
            <div className="login-hero__scene" aria-hidden>
              <RecordVault3D />
            </div>
          </div>

          <div className="logincard panel reveal">
            <div className="lc-hd">
              <div className="lc-hd-top">
                <h2>{t('auth.login.title')}</h2>
                <LocaleToggle />
              </div>
              <div className="sub">{t('auth.login.subtitle')}</div>
            </div>
            <div className="panel-bd">
              {new URLSearchParams(window.location.search).get('auth_error') === 'access_denied' && (
                <div className="lc-alert" role="alert">
                  {t('auth.login.accessDenied')}
                </div>
              )}
              <LoginPage onLoggedIn={() => void reload()} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const { user } = state
  const name = prettyName(user.displayName ?? user.sub)
  const isAdmin = user.activeRole === ROLE.Admin
  // /admin/* chỉ có nghĩa với vai Admin; vai khác dính path đó (đổi vai, share
  // link) thì rơi về trang chủ của vai mình thay vì màn trắng.
  const home = route.view === 'home' || (route.view === 'admin' && !isAdmin)
  const isDcc =
    user.activeRole === ROLE.Dcc1 || user.activeRole === ROLE.Dcc2 || user.activeRole === ROLE.Dcc3
  const isAdminHome = (route.view === 'home' || route.view === 'admin') && isAdmin

  return (
    <>
      {!isAdminHome && (
      <div className="topbar">
        <button type="button" className="brand" onClick={goHome} aria-label={t('shell.topbar.homeAria')}>
          <span className="q" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 17V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10" />
              <circle cx="8.5" cy="17.5" r="1.6" />
              <circle cx="15.5" cy="17.5" r="1.6" />
              <path d="M4 12h16" />
            </svg>
          </span>
          QLHS{' '}
          <small>
            {user.activeRole === ROLE.Applicant
              ? t('tickets.myList.title')
              : t('shell.topbar.brandSuffix')}
          </small>
        </button>
        <RoleSwitcher roles={user.roles} activeRole={user.activeRole} onChange={setActiveRole} />
        {/* Right cluster pushed to the edge (replaces the old clock's margin-left:auto). */}
        <div className="topbar-right">
          <NotificationBell />
          <LocaleToggle />
          <ThemeToggle />
          <div className="me">
            {/* Tên + nhãn vai (Admin1/2/3 · Nhân viên · Quản trị viên) như QLTS.
                Ẩn nhãn khi ≥2 vai — RoleSwitcher đã hiện vai, tránh lặp. */}
            <span className="who">
              <span className="nm">{name}</span>
              {user.roles.length <= 1 && roleLabel(user.activeRole) && (
                <span className="rl">{roleLabel(user.activeRole)}</span>
              )}
            </span>
            <span className="av" aria-hidden>
              {initials(name)}
            </span>
            <button
              type="button"
              className="logout"
              onClick={() => void apiPost('/auth/logout').then(reload)}
            >
              {t('shell.topbar.logout')}
            </button>
          </div>
        </div>
      </div>
      )}

      <main className={isAdminHome ? 'flush' : undefined}>
        {/* key by id so navigating ticket A→B remounts fresh — no stale detail
            or carried-over error from the previous ticket. */}
        {route.view === 'ticket' && <TicketDetail key={route.id} ticketId={route.id} />}

        {route.view === 'search' && isDcc && (
          <ClosedTickets role={user.activeRole} onBack={goHome} />
        )}

        {/* Applicant's own lookup — same /search route, but owner-scoped data so it
            only ever shows the applicant's own tickets (never anyone else's). */}
        {route.view === 'search' && user.activeRole === ROLE.Applicant && (
          <ApplicantSearch onBack={goHome} />
        )}

        {home && user.activeRole === null && (
          <div className="rolewarn">
            {t('shell.roleWarn.prefix')}
            <b>{t('shell.roleWarn.noRole')}</b>
            {t('shell.roleWarn.suffix')}
          </div>
        )}

        {isAdminHome && (
          <AdminShell
            userName={name}
            roles={user.roles}
            activeRole={user.activeRole}
            onChangeRole={setActiveRole}
            onLogout={() => void apiPost('/auth/logout').then(reload)}
          />
        )}

        {home && user.activeRole === ROLE.Applicant && (
          <section>
            <MyTickets
              reloadKey={reloadKey}
              action={<CreateTicketForm onCreated={() => setReloadKey((k) => k + 1)} />}
            />
          </section>
        )}

        {home && isDcc && (
          <section className="dcc-home">
            <div className="maptoggle">
              <button
                type="button"
                className="maptoggle-btn"
                aria-expanded={mapOpen}
                aria-controls="dcc-linemap"
                onClick={() => setMapOpen((v) => !v)}
              >
                <MapIcon className="mapicn" size={15} strokeWidth={1.9} aria-hidden />
                <span className="lbl">
                  {mapOpen ? t('shell.dccHome.hideMap') : t('shell.dccHome.showMap')}
                </span>
                <ChevronDown className="chev" size={15} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            {/* Region persists (even collapsed) so aria-controls always resolves. */}
            <div id="dcc-linemap" role="region" aria-label={t('shell.dccHome.mapRegion')} hidden={!mapOpen}>
              {mapOpen && (
                <LineMap
                  scope={
                    user.activeRole +
                    (user.activeRole === ROLE.Dcc1
                      ? t('shell.dccHome.allLines')
                      : user.activeRole === ROLE.Dcc2
                        ? t('shell.dccHome.lineContract')
                        : t('shell.dccHome.linePayment'))
                  }
                />
              )}
            </div>
            <StationBoard
              canManage={user.activeRole === ROLE.Dcc1}
              dcc2={user.activeRole === ROLE.Dcc2}
              dcc3={user.activeRole === ROLE.Dcc3}
            />
          </section>
        )}
      </main>
      <AssistantPanel key={user.activeRole ?? 'none'} activeRole={user.activeRole} userName={name} />
      <ToastHost />
    </>
  )
}
