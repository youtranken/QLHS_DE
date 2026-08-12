/** Login screen, digest toggle, role switcher. */
export const auth = {
  login: {
    title: 'Sign in',
    subtitle: 'Sign in to get started — enter your email.',
    emailLabel: 'Email or username',
    emailPlaceholder: 'email@pmh.com.vn',
    passwordLabel: 'Password',
    signingInAs: 'Signing in as',
    changeEmail: 'change',
    continue: 'Continue',
    checking: 'Checking…',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    probeError: 'Could not verify the account — please try again later.',
    badCredentials: 'Incorrect account or password.',
    tooManyAttempts: 'Too many attempts — sign-in temporarily locked. Try again in a few minutes.',
    accessDenied: 'Your account does not have access to QLHS. Contact an admin to be assigned a group.',
    sessionExpired: 'Your session has expired. Please sign in again.',
    sessionExpiredKeepEditing: 'Your session has expired. Save what you are editing, then sign in again.',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    heroEyebrow: 'Ticket management · Internal',
    heroTitle: 'Track tickets,',
    heroTitleEm: 'station by station.',
    heroLead:
      'Intake → processing → approval → archive. One sign-in gate, tracking the progress and SLA of every ticket.',
  },
  digest: {
    label: 'Morning digest',
    onTitle: 'Receiving reminder emails at 7:30 (only when tickets need attention). Click to turn off.',
    offTitle: 'Morning reminder emails are off. Click to turn on.',
    saveErr: 'Could not save your reminder preference — try again.',
  },
  roleSwitcher: {
    aria: 'Switch role',
  },
} as const
