/** EN presentation labels for canonical EN statuses (AD-13: EN is the source).
 *  Keys are the canonical status strings — looked up via statusVi(), never t(). */
export const status = {
  Submitted: 'In Pool',
  'Submitted to VP Andy': 'Awaiting VP Andy',
  'Submitted to DCC2': 'Awaiting DCC2',
  'Received by DCC2': 'DCC2 processing',
  'Submitted to DCC3': 'Awaiting DCC3',
  'Received by DCC3': 'DCC3 processing',
  'Submitted to Accounting': 'Sent to Accounting',
  'Received from ACC': 'Received from ACC',
  'Submitted to BOP': 'Awaiting BOP',
  'Submitted to DCC2 (Hardcopy)': 'Awaiting DCC2 (hardcopy)',
  Hardcopy: 'Hardcopy done',
  'Sent to Accounting': 'Sent to Accounting (closed)',
  Completed: 'Completed',
  Returned: 'Returned',
  'Return-fixing': 'Fixing & resubmitting',
  Reopened: 'Reopened',
  Cancelled: 'Cancelled',
} satisfies Record<string, string>
