import { describe, it, expect } from 'vitest'
import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { findEdge, legalActions, EDGES } from './index'

describe('findEdge (AD-3 — flow-keyed resolution, B1)', () => {
  it('resolves a General edge', () => {
    const edge = findEdge(
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_EVENT.AndyApproveComplete,
      FLOW.General,
    )
    expect(edge?.to).toBe(TICKET_STATUS.Completed)
  })

  it('falls back to a shared "*" edge for any flow', () => {
    const edge = findEdge(TICKET_STATUS.Submitted, TICKET_EVENT.SubmitToAndy, FLOW.Contract)
    expect(edge?.to).toBe(TICKET_STATUS.SubmittedToVpAndy)
  })

  it('does NOT leak a General edge into another flow', () => {
    // andyApproveComplete is General-only; a Contract ticket must not resolve it.
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.AndyApproveComplete, FLOW.Contract),
    ).toBeUndefined()
  })
})

describe('legalActions (basis for AD-17 actionbar)', () => {
  it('lists DCC1 actions at Submitted to VP Andy in General', () => {
    const actions = legalActions(TICKET_STATUS.SubmittedToVpAndy, ROLE.Dcc1, FLOW.General)
    expect(actions.sort()).toEqual(
      [TICKET_EVENT.AndyApproveComplete, TICKET_EVENT.AndyRequireBop, TICKET_EVENT.SendBack].sort(),
    )
  })

  it('gives an Applicant no actions at Submitted to VP Andy', () => {
    expect(legalActions(TICKET_STATUS.SubmittedToVpAndy, ROLE.Applicant, FLOW.General)).toEqual([])
  })

  it('lets an Applicant cancel while Submitted', () => {
    expect(legalActions(TICKET_STATUS.Submitted, ROLE.Applicant, FLOW.General)).toEqual([
      TICKET_EVENT.Cancel,
    ])
  })

  it('lets DCC1 Return a pre-mint ticket from Pool (wrong doc type at reception)', () => {
    expect(legalActions(TICKET_STATUS.Submitted, ROLE.Dcc1, FLOW.General)).toContain(
      TICKET_EVENT.SendBack,
    )
  })

  it('DCC1 is the single Return actor — DCC2/DCC3 have no sendBack (AC3)', () => {
    expect(legalActions(TICKET_STATUS.ReceivedByDcc2, ROLE.Dcc2, FLOW.Contract)).not.toContain(
      TICKET_EVENT.SendBack,
    )
    expect(legalActions(TICKET_STATUS.ReceivedByDcc3, ROLE.Dcc3, FLOW.Payment)).not.toContain(
      TICKET_EVENT.SendBack,
    )
  })
})

describe('Return edges (Epic 2 — sendBack, enteredFlow)', () => {
  it('ACC return is a heavy edge (enteredFlow) → counts a round', () => {
    const edge = findEdge(TICKET_STATUS.ReceivedFromAcc, TICKET_EVENT.SendBack, FLOW.Contract)
    expect(edge?.to).toBe(TICKET_STATUS.Returned)
    expect(edge?.ownerRole).toBe(ROLE.Dcc1)
    expect(edge?.enteredFlow).toBe(true)
  })

  it('pre-ACC returns are light — no enteredFlow (Andy reject, pre-mint)', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.SendBack, FLOW.General)?.enteredFlow,
    ).toBeFalsy()
    expect(
      findEdge(TICKET_STATUS.Submitted, TICKET_EVENT.SendBack, FLOW.General)?.enteredFlow,
    ).toBeFalsy()
  })
})

describe('Contract handover DCC1→DCC2 (Story 3.1, FR-10)', () => {
  it('DCC1 hands an Andy-approved Contract to DCC2', () => {
    const edge = findEdge(
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_EVENT.HandoverToDcc2,
      FLOW.Contract,
    )
    expect(edge?.to).toBe(TICKET_STATUS.SubmittedToDcc2)
    expect(edge?.ownerRole).toBe(ROLE.Dcc1)
  })

  it('does NOT expose handover in General or Payment', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc2, FLOW.General),
    ).toBeUndefined()
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc2, FLOW.Payment),
    ).toBeUndefined()
  })

  it('DCC2 confirms the hardcopy → Received by DCC2', () => {
    const edge = findEdge(
      TICKET_STATUS.SubmittedToDcc2,
      TICKET_EVENT.ConfirmReceivedByDcc2,
      FLOW.Contract,
    )
    expect(edge?.to).toBe(TICKET_STATUS.ReceivedByDcc2)
    expect(edge?.ownerRole).toBe(ROLE.Dcc2)
    expect(edge?.reversible).toBe(false)
  })

  it('only DCC2 can confirm receipt — DCC1 cannot fire it', () => {
    expect(
      legalActions(TICKET_STATUS.SubmittedToDcc2, ROLE.Dcc1, FLOW.Contract),
    ).not.toContain(TICKET_EVENT.ConfirmReceivedByDcc2)
    expect(
      legalActions(TICKET_STATUS.SubmittedToDcc2, ROLE.Dcc2, FLOW.Contract),
    ).toEqual([TICKET_EVENT.ConfirmReceivedByDcc2])
  })

  it('handover is a light edge — no round bump (pre-external processing)', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc2, FLOW.Contract)
        ?.enteredFlow,
    ).toBeFalsy()
  })

  it('DCC2 sends to Accounting from Received by DCC2 (Story 3.2)', () => {
    const edge = findEdge(
      TICKET_STATUS.ReceivedByDcc2,
      TICKET_EVENT.SendToAccounting,
      FLOW.Contract,
    )
    expect(edge?.to).toBe(TICKET_STATUS.SubmittedToAccounting)
    expect(edge?.ownerRole).toBe(ROLE.Dcc2)
  })

  it('DCC1 receives back from ACC then submits BOP (Story 3.3)', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToAccounting, TICKET_EVENT.ReceiveFromAcc, FLOW.Contract)?.to,
    ).toBe(TICKET_STATUS.ReceivedFromAcc)
    expect(
      findEdge(TICKET_STATUS.ReceivedFromAcc, TICKET_EVENT.SubmitToBop, FLOW.Contract)?.to,
    ).toBe(TICKET_STATUS.SubmittedToBop)
  })

  it('Received from ACC exposes exactly Return + Submit BOP to DCC1 (AD-17)', () => {
    expect(
      legalActions(TICKET_STATUS.ReceivedFromAcc, ROLE.Dcc1, FLOW.Contract).sort(),
    ).toEqual([TICKET_EVENT.SendBack, TICKET_EVENT.SubmitToBop].sort())
  })

  it('the only path to Submitted to BOP (Contract) is via Received from ACC — BOP once/round', () => {
    const intoBop = EDGES.filter(
      (e) => e.to === TICKET_STATUS.SubmittedToBop && (e.flow === FLOW.Contract || e.flow === '*'),
    )
    expect(intoBop).toHaveLength(1)
    expect(intoBop[0]?.from).toBe(TICKET_STATUS.ReceivedFromAcc)
  })

  it('BOP approved → Hardcopy → Completed chain (Story 3.4)', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToBop, TICKET_EVENT.BopApprove, FLOW.Contract)?.to,
    ).toBe(TICKET_STATUS.SubmittedToDcc2Hardcopy)
    expect(
      findEdge(TICKET_STATUS.SubmittedToDcc2Hardcopy, TICKET_EVENT.ConfirmReceivedByDcc2, FLOW.Contract)?.to,
    ).toBe(TICKET_STATUS.Hardcopy)
    const done = findEdge(TICKET_STATUS.Hardcopy, TICKET_EVENT.CompleteContract, FLOW.Contract)
    expect(done?.to).toBe(TICKET_STATUS.Completed)
    expect(done?.reversible).toBe(false)
  })

  it('Contract BopApprove routes differently from General (not Completed)', () => {
    expect(findEdge(TICKET_STATUS.SubmittedToBop, TICKET_EVENT.BopApprove, FLOW.General)?.to).toBe(
      TICKET_STATUS.Completed,
    )
    expect(findEdge(TICKET_STATUS.SubmittedToBop, TICKET_EVENT.BopApprove, FLOW.Contract)?.to).toBe(
      TICKET_STATUS.SubmittedToDcc2Hardcopy,
    )
  })

  it('AC4: DCC1 is the sole Return actor from DCC2-held states — heavy (counts a round)', () => {
    for (const from of [TICKET_STATUS.ReceivedByDcc2, TICKET_STATUS.Hardcopy]) {
      const edge = findEdge(from, TICKET_EVENT.SendBack, FLOW.Contract)
      expect(edge?.to).toBe(TICKET_STATUS.Returned)
      expect(edge?.ownerRole).toBe(ROLE.Dcc1)
      expect(edge?.enteredFlow).toBe(true)
      // DCC2 cannot fire sendBack from these states.
      expect(legalActions(from, ROLE.Dcc2, FLOW.Contract)).not.toContain(TICKET_EVENT.SendBack)
    }
  })
})

describe('Payment handover DCC1→DCC3 (Story 4.1, FR-13)', () => {
  it('DCC1 hands an Andy-approved Payment to DCC3', () => {
    const edge = findEdge(
      TICKET_STATUS.SubmittedToVpAndy,
      TICKET_EVENT.HandoverToDcc3,
      FLOW.Payment,
    )
    expect(edge?.to).toBe(TICKET_STATUS.SubmittedToDcc3)
    expect(edge?.ownerRole).toBe(ROLE.Dcc1)
    expect(edge?.reversible).toBe(true)
  })

  it('does NOT expose the DCC3 handover in General or Contract', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc3, FLOW.General),
    ).toBeUndefined()
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc3, FLOW.Contract),
    ).toBeUndefined()
  })

  it('DCC3 confirms the hardcopy → Received by DCC3', () => {
    const edge = findEdge(
      TICKET_STATUS.SubmittedToDcc3,
      TICKET_EVENT.ConfirmReceivedByDcc3,
      FLOW.Payment,
    )
    expect(edge?.to).toBe(TICKET_STATUS.ReceivedByDcc3)
    expect(edge?.ownerRole).toBe(ROLE.Dcc3)
    expect(edge?.reversible).toBe(false)
  })

  it('only DCC3 can confirm receipt — DCC1 cannot fire it', () => {
    expect(
      legalActions(TICKET_STATUS.SubmittedToDcc3, ROLE.Dcc1, FLOW.Payment),
    ).not.toContain(TICKET_EVENT.ConfirmReceivedByDcc3)
    expect(
      legalActions(TICKET_STATUS.SubmittedToDcc3, ROLE.Dcc3, FLOW.Payment),
    ).toEqual([TICKET_EVENT.ConfirmReceivedByDcc3])
  })

  it('handover is a light edge — no round bump (pre-external processing)', () => {
    expect(
      findEdge(TICKET_STATUS.SubmittedToVpAndy, TICKET_EVENT.HandoverToDcc3, FLOW.Payment)
        ?.enteredFlow,
    ).toBeFalsy()
  })

  it('DCC1 at Submitted to VP Andy (Payment) sees only handover + Return (no BOP, FR-8)', () => {
    expect(
      legalActions(TICKET_STATUS.SubmittedToVpAndy, ROLE.Dcc1, FLOW.Payment).sort(),
    ).toEqual([TICKET_EVENT.HandoverToDcc3, TICKET_EVENT.SendBack].sort())
  })
})

describe('Payment close DCC3 → Sent to Accounting (Story 4.2, FR-13/H5)', () => {
  it('DCC3 sends to Accounting from Received by DCC3 → Sent to Accounting (one hop)', () => {
    const edge = findEdge(
      TICKET_STATUS.ReceivedByDcc3,
      TICKET_EVENT.SendToAccounting,
      FLOW.Payment,
    )
    expect(edge?.to).toBe(TICKET_STATUS.SentToAccounting)
    expect(edge?.ownerRole).toBe(ROLE.Dcc3)
    expect(edge?.reversible).toBe(false)
  })

  it('sendToAccounting routes by flow — Contract mid-flow vs Payment close', () => {
    expect(
      findEdge(TICKET_STATUS.ReceivedByDcc2, TICKET_EVENT.SendToAccounting, FLOW.Contract)?.to,
    ).toBe(TICKET_STATUS.SubmittedToAccounting)
    expect(
      findEdge(TICKET_STATUS.ReceivedByDcc3, TICKET_EVENT.SendToAccounting, FLOW.Payment)?.to,
    ).toBe(TICKET_STATUS.SentToAccounting)
  })

  it('Payment never routes through BOP or Completed (H5)', () => {
    const paymentEdges = EDGES.filter((e) => e.flow === FLOW.Payment)
    expect(paymentEdges.some((e) => e.to === TICKET_STATUS.SubmittedToBop)).toBe(false)
    expect(paymentEdges.some((e) => e.to === TICKET_STATUS.Completed)).toBe(false)
  })

  it('DCC3 at Received by DCC3 sees exactly [sendToAccounting] (AD-17)', () => {
    expect(legalActions(TICKET_STATUS.ReceivedByDcc3, ROLE.Dcc3, FLOW.Payment)).toEqual([
      TICKET_EVENT.SendToAccounting,
    ])
  })
})

describe('Payment pre-close Return at Received by DCC3 (H2 — symmetric to Contract AC4)', () => {
  it('DCC1 Returns a wrong hardcopy from Received by DCC3 — heavy (counts a round)', () => {
    // Walkthrough §C:83 / PRD §4.2: DCC3 spots a wrong hardcopy → đẩy ngược DCC1 →
    // DCC1 Returns. Past external processing, so it counts a round (enteredFlow).
    const edge = findEdge(TICKET_STATUS.ReceivedByDcc3, TICKET_EVENT.SendBack, FLOW.Payment)
    expect(edge?.to).toBe(TICKET_STATUS.Returned)
    expect(edge?.ownerRole).toBe(ROLE.Dcc1)
    expect(edge?.enteredFlow).toBe(true)
  })

  it('DCC3 still never Returns itself — only DCC1 fires it (AD-11)', () => {
    expect(legalActions(TICKET_STATUS.ReceivedByDcc3, ROLE.Dcc3, FLOW.Payment)).not.toContain(
      TICKET_EVENT.SendBack,
    )
    expect(legalActions(TICKET_STATUS.ReceivedByDcc3, ROLE.Dcc1, FLOW.Payment)).toContain(
      TICKET_EVENT.SendBack,
    )
  })
})

describe('Payment reopen from Sent to Accounting (Story 4.3, FR-14/H5)', () => {
  it('DCC1 reopens a closed Payment: Sent to Accounting --reopen--> Reopened', () => {
    const edge = findEdge(TICKET_STATUS.SentToAccounting, TICKET_EVENT.Reopen, FLOW.Payment)
    expect(edge?.to).toBe(TICKET_STATUS.Reopened)
    expect(edge?.ownerRole).toBe(ROLE.Dcc1)
    expect(edge?.reversible).toBe(false)
  })

  it('reopen chain reaches Returned and counts a round (heavy — past ACC)', () => {
    // reopen → Reopened, then the shared Reopened --sendBack--> Returned (enteredFlow).
    expect(findEdge(TICKET_STATUS.SentToAccounting, TICKET_EVENT.Reopen, FLOW.Payment)?.to).toBe(
      TICKET_STATUS.Reopened,
    )
    const back = findEdge(TICKET_STATUS.Reopened, TICKET_EVENT.SendBack, FLOW.Payment)
    expect(back?.to).toBe(TICKET_STATUS.Returned)
    expect(back?.enteredFlow).toBe(true)
  })

  it('only DCC1 may reopen — DCC3 has no reopen edge (request-only)', () => {
    expect(legalActions(TICKET_STATUS.SentToAccounting, ROLE.Dcc3, FLOW.Payment)).toEqual([])
    expect(legalActions(TICKET_STATUS.SentToAccounting, ROLE.Dcc1, FLOW.Payment)).toEqual([
      TICKET_EVENT.Reopen,
    ])
  })
})

describe('edge set integrity', () => {
  it('has no duplicate (from, event, flow) keys', () => {
    const keys = EDGES.map((e) => `${e.from}|${e.event}|${e.flow}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
