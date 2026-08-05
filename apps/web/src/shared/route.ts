import { useEffect, useState } from 'react'

/** Minimal History-API deep-links, no router dependency (EXPERIENCE: deep-link by
 *  code, openable from any role/tab). Clean URLs (/ticket/<code>, /admin/<section>)
 *  — nginx + Vite dev both fall back unknown paths to index.html, so F5/deep-link
 *  never 404s. Any component calls the open* helpers; App renders from useRoute(). */
export type Route =
  | { view: 'home' }
  | { view: 'ticket'; id: string }
  | { view: 'search' }
  | { view: 'admin'; section: string }

const TICKET = '/ticket/'
const SEARCH = '/search'
const ADMIN = '/admin/'
const HOME = '/'

// True once the app has pushed at least one in-app entry — so goBack() knows the
// previous history entry is ours to return to (not an external referrer).
let didPushInApp = false

/** pushState + notify: popstate only fires on back/forward, so we dispatch it
 *  ourselves after an in-app navigation so useRoute/AdminShell re-read the path. */
function navigate(path: string): void {
  if (path === window.location.pathname) return
  window.history.pushState(null, '', path)
  didPushInApp = true
  window.dispatchEvent(new Event('popstate'))
}

export function openTicketDetail(idOrCode: string): void {
  navigate(`${TICKET}${encodeURIComponent(idOrCode)}`)
}
export function openSearch(): void {
  navigate(SEARCH)
}
/** Deep-link một mục khu quản trị (/admin/<section>); section hợp lệ do AdminShell quyết. */
export function openAdminSection(section: string): void {
  navigate(`${ADMIN}${section}`)
}
export function adminSectionOf(path: string): string | null {
  return path.startsWith(ADMIN) ? path.slice(ADMIN.length) : null
}
export function goHome(): void {
  navigate(HOME)
}
/** Detail back-button: step back to wherever the user came from (so an admin's
 *  audit/analytics filters survive) ONLY when the previous entry is one we pushed;
 *  a fresh deep-link (external referrer) falls home instead of leaving the app. */
export function goBack(): void {
  if (didPushInApp) window.history.back()
  else goHome()
}
/** Back-compat alias for the detail page's back button. */
export const closeDetail = goHome

function parse(path: string): Route {
  if (path.startsWith(TICKET)) return { view: 'ticket', id: decodeURIComponent(path.slice(TICKET.length)) }
  if (path === SEARCH) return { view: 'search' }
  if (path.startsWith(ADMIN)) return { view: 'admin', section: path.slice(ADMIN.length) }
  return { view: 'home' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.pathname))
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.pathname))
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return route
}
