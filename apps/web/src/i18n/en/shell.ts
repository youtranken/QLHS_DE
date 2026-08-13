/** App shell: topbar, brand, theme, clock, role-less warning, DCC home tag. */
export const shell = {
  loading: 'Loading…',
  brand: {
    tagline: 'Ticket management',
  },
  topbar: {
    homeAria: 'Back to the Tickets board',
    brandSuffix: '· Tickets',
    logout: 'Sign out',
  },
  // Role label shown under the name in the user card (Admin sidebar + board header).
  roleLabel: {
    Admin: 'Administrator',
    Applicant: 'Staff',
    DCC1: 'Admin1',
    DCC2: 'Admin2',
    DCC3: 'Admin3',
  },
  // Split around <b> — keep the leading/trailing spacing bytes intact.
  roleWarn: {
    prefix: 'Your account ',
    noRole: 'has not been assigned a role',
    suffix: '. Please contact an Admin to be granted access.',
  },
  // Leading " · " is part of the string: rendered right after the role tag.
  dccHome: {
    allLines: ' · All 3 lines',
    lineContract: ' · Line B — Contract',
    linePayment: ' · Line C — Payment',
    hideMap: 'Collapse map',
    showMap: 'Show line map',
    mapRegion: 'Dispatch line map',
  },
  themeToggle: {
    aria: 'Toggle light/dark background',
    toDark: 'Dark',
    toLight: 'Light',
  },
  localeToggle: {
    aria: 'Switch language (Vietnamese / English)',
  },
  clock: {
    // Comma-joined Sun→Sat; Clock splits at render so a locale switch re-evaluates.
    dow: 'Sun,Mon,Tue,Wed,Thu,Fri,Sat',
  },
} as const
