import type { Ticket } from '@prisma/client'

/** API projection of a ticket. Amount → string (BigInt is not JSON-safe). */
export interface TicketView {
  id: string
  code: string | null
  status: string
  flow: string
  priority: string
  documentType: string | null
  description: string | null
  paymentTerm: string | null
  contractNo: string | null
  projectTeam: string | null
  currency: string | null
  amount: string | null
  budgetCode: string | null
  contractor: string | null
  currentHolderSub: string | null
  roundNo: number
  createdAt: string
  /** Derived per-viewer "unseen >24h" signal (AD-18); set only where joined. */
  unseen?: boolean
}

export function toTicketView(t: Ticket): TicketView {
  return {
    id: t.id,
    code: t.code,
    status: t.status,
    flow: t.flow,
    priority: t.priority,
    documentType: t.documentType,
    description: t.description,
    paymentTerm: t.paymentTerm,
    contractNo: t.contractNo,
    projectTeam: t.projectTeam,
    currency: t.currency,
    amount: t.amount === null ? null : t.amount.toString(),
    budgetCode: t.budgetCode,
    contractor: t.contractor,
    currentHolderSub: t.currentHolderSub,
    roundNo: t.roundNo,
    createdAt: t.createdAt.toISOString(),
  }
}
