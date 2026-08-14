/** Cross-feature strings: relative-time units, generic buttons, fallbacks. */
export const common = {
  actions: {
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
  },
  confirm: {
    title: 'Confirm',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'State a reason (required)…',
  },
  toasts: {
    regionAria: 'Notifications',
  },
  states: {
    loading: 'Loading…',
    retry: 'Retry',
  },
  select: {
    noOptions: '— No options —',
    searchPlaceholder: 'Search…',
    searchAria: 'Search options',
    noMatch: '— No match —',
  },
  datePicker: {
    choose: 'Pick a date',
    clear: 'Clear date',
    prev: 'Previous month',
    next: 'Next month',
  },
  time: {
    justNow: 'just now',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    minutesAgo: '{n} min ago',
    hoursAgo: '{n} h ago',
    daysAgo: '{n} d ago',
  },
} as const
