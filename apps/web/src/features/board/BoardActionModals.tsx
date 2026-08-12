import { HandoverModal } from './HandoverModal'
import { SendAccountingModal } from './SendAccountingModal'
import { ConfirmModal } from '../../shared/ConfirmModal'
import { toast } from '../../shared/toast'
import type { BoardCard } from './api'
import type { Ask } from './ask'
import { t } from '../../i18n'

export interface BoardActionModalsProps {
  handover: BoardCard | null
  sendAcc: BoardCard | null
  receiveAcc: BoardCard | null
  ask: Ask | null
  setHandover: (c: BoardCard | null) => void
  setSendAcc: (c: BoardCard | null) => void
  setReceiveAcc: (c: BoardCard | null) => void
  setAsk: (a: Ask | null) => void
  doReceive: (c: BoardCard, receivedAt: string) => Promise<void>
  doMissing: (c: BoardCard, reason: string) => Promise<void>
  doSendAcc: (c: BoardCard, documentNo: string) => Promise<void>
  doReceiveAcc: (c: BoardCard, receivedAt: string) => Promise<void>
  /** Refetch after a failed confirm so the surface reflects the true state. */
  onReload: () => Promise<void>
}

/**
 * The confirm/handover/send-accounting/receive modals shared by every surface that
 * drives a ticket action (the station board and the ticket detail). All state comes
 * from `useBoardActions`; this component only renders whichever modal is open. The
 * board keeps its batch-entry sheet separately — that one is board-only.
 */
export function BoardActionModals({
  handover, sendAcc, receiveAcc, ask,
  setHandover, setSendAcc, setReceiveAcc, setAsk,
  doReceive, doMissing, doSendAcc, doReceiveAcc, onReload,
}: BoardActionModalsProps) {
  return (
    <>
      {handover && (
        <HandoverModal
          code={handover.code ?? handover.id.slice(0, 8)}
          onConfirm={(d) => doReceive(handover, d)}
          onMissing={(reason) => doMissing(handover, reason)}
          onClose={() => setHandover(null)}
        />
      )}
      {sendAcc && (
        <SendAccountingModal
          code={sendAcc.code ?? sendAcc.id.slice(0, 8)}
          docLabel={
            sendAcc.flow === 'Payment'
              ? t('board.modals.sendAccounting.payNoLabel')
              : t('board.modals.sendAccounting.docNoLabel')
          }
          confirmClose={sendAcc.flow === 'Payment'}
          onSubmit={(docNo) => doSendAcc(sendAcc, docNo)}
          onClose={() => setSendAcc(null)}
        />
      )}
      {receiveAcc && (
        <HandoverModal
          title={t('board.modals.receiveAcc.title')}
          confirmLabel={t('board.modals.receiveAcc.confirm')}
          dateLabel={t('board.modals.receiveAcc.dateLabel')}
          code={receiveAcc.code ?? receiveAcc.id.slice(0, 8)}
          onConfirm={(d) => doReceiveAcc(receiveAcc, d)}
          onClose={() => setReceiveAcc(null)}
        />
      )}
      {ask && (
        <ConfirmModal
          title={ask.title}
          message={ask.message}
          code={ask.code}
          reason={ask.reason}
          reasonDefault={ask.reasonDefault}
          danger={ask.danger}
          confirmLabel={ask.confirmLabel}
          onConfirm={async (reason) => {
            const pending = ask
            setAsk(null)
            try {
              await pending.onOk(reason)
            } catch {
              toast.err(t('board.toasts.actionFailed'))
              await onReload()
            }
          }}
          onCancel={() => setAsk(null)}
        />
      )}
    </>
  )
}
