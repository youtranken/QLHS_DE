/** Admin shell: sidebar brand, nav labels + sub-captions, footer actions. */
export const adminShell = {
  brand: {
    title: 'QLHS · Tickets',
    sub: 'Admin console',
  },
  navAria: 'Admin area',
  soonTag: 'soon',
  logout: 'Sign out',
  defaultUserName: 'Administrator',
  collapseNav: 'Collapse menu',
  expandNav: 'Expand menu',
  accountMenu: 'Account',
  language: 'Language',
  languageHint: 'Tiếng Việt · English soon',
  themeDark: 'Dark theme',
  themeLight: 'Light theme',
  nav: {
    overview: 'Overview',
    roles: 'Users & Roles',
    appoint: 'Appoint via SSO',
    options: 'Catalogs',
    sla: 'SLA thresholds',
    pause: 'SLA pauses',
    analytics: 'Operations analytics',
    audit: 'System audit log',
    config: 'Configuration',
  },
} as const
