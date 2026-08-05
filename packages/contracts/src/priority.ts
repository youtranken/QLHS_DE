/** Applicant priority label (FR-2). Urgent/Rush float to the top of the Pool. */
export const PRIORITY = {
  Normal: 'normal',
  Rush: 'rush',
  Urgent: 'urgent',
} as const

export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY]

export const ALL_PRIORITIES: readonly Priority[] = Object.values(PRIORITY)
