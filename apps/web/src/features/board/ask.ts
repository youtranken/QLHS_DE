/** A pending gated action awaiting confirmation in the ConfirmModal. */
export interface Ask {
  title: string
  message: string
  code?: string
  reason?: boolean
  reasonDefault?: string
  danger?: boolean
  confirmLabel?: string
  onOk: (reason?: string) => Promise<void>
}
