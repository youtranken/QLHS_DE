import type { ReactNode } from 'react'

/** A pending gated action awaiting confirmation in the ConfirmModal. */
export interface Ask {
  title: string
  /** ReactNode so a message can emphasise a word (e.g. bold "Xác nhận"). */
  message: ReactNode
  code?: string
  reason?: boolean
  reasonDefault?: string
  danger?: boolean
  confirmLabel?: string
  onOk: (reason?: string) => Promise<void>
}
