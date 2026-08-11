/**
 * Ticket audit actions (AD-3/AD-4). The state-machine edges use the transition
 * subset (keyed by from/event/flow); `Created` and `PriorityChanged` are typed
 * non-status audit actions (B6) — they append a row but never change status.
 */
export const TICKET_EVENT = {
  SubmitToAndy: 'submitToAndy',
  AndyApproveComplete: 'andyApproveComplete',
  AndyRequireBop: 'andyRequireBop',
  BopApprove: 'bopApprove',
  SendBack: 'sendBack',
  // System auto-returns an un-picked Pool ticket to the Applicant (grace elapsed).
  AutoReturn: 'auto_return',
  ConfirmReturnReceipt: 'confirmReturnReceipt',
  Resubmit: 'resubmit',
  Reopen: 'reopen',
  Undo: 'undo',
  Cancel: 'cancel',
  // Contract flow — 2-phase handover DCC1↔DCC2 (Epic 3)
  HandoverToDcc2: 'handoverToDcc2',
  ConfirmReceivedByDcc2: 'confirmReceivedByDcc2',
  SendToAccounting: 'sendToAccounting',
  ReceiveFromAcc: 'receiveFromAcc',
  SubmitToBop: 'submitToBop',
  CompleteContract: 'completeContract',
  // Payment flow — 2-phase handover DCC1→DCC3 (Epic 4). `sendToAccounting` is
  // reused for the close step (routes to `Sent to Accounting` by flow, Story 4.2).
  HandoverToDcc3: 'handoverToDcc3',
  ConfirmReceivedByDcc3: 'confirmReceivedByDcc3',
  // Non-status audit actions (B6)
  Created: 'created',
  PriorityChanged: 'priority_changed',
  FieldChanged: 'field_changed',
  ReopenRequested: 'reopen_requested',
  PoolPicked: 'pool_picked',
  LockSeized: 'lock_seized',
  // 2-phase handover exceptions (B6 — no status change, custody stays at sender)
  MissingPaperFlagged: 'missing_paper_flagged',
  MissingPaperCleared: 'missing_paper_cleared',
  // DCC2/DCC3 push-back: a note asking DCC1 to Return (DCC2/3 never Return, AD-11)
  ReturnRequested: 'return_requested',
} as const

export type TicketEvent = (typeof TICKET_EVENT)[keyof typeof TICKET_EVENT]
