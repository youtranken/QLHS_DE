import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { PrismaClient } from '@prisma/client'
import { FLOW, ROLE, TICKET_EVENT, TICKET_STATUS } from '@qlhs/contracts'
import { PrismaModule } from '../src/infra/prisma/prisma.module'
import { PrismaService } from '../src/infra/prisma/prisma.service'
import { TicketModule } from '../src/ticket.module'
import { TransitionTicketUseCase } from '../src/application/core/transition-ticket.usecase'
import { TicketTransitionRepo } from '../src/infra/prisma/ticket/ticket-transition.repo'

// The app runs as the restricted role (append-only). Test setup/teardown needs
// the owner because the app role legitimately CANNOT delete audit rows.
const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

describe('ticket transition (e2e — atomic + append-only, AD-2/4/14)', () => {
  let prisma: PrismaService // app role (qlhs_app) — the code under test
  let admin: PrismaClient // owner — setup/teardown only
  let useCase: TransitionTicketUseCase
  let repo: TicketTransitionRepo
  let close: () => Promise<void>

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, TicketModule],
    }).compile()
    const app = moduleRef.createNestApplication()
    await app.init()
    prisma = app.get(PrismaService)
    useCase = app.get(TransitionTicketUseCase)
    repo = app.get(TicketTransitionRepo)
    close = () => app.close()
  })

  afterAll(async () => {
    await admin.$disconnect()
    await close()
  })

  beforeEach(async () => {
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function seedTicket(status: string): Promise<string> {
    const t = await admin.ticket.create({
      data: { status, flow: FLOW.General, applicantSub: 'test-app', currentHolderSub: 'test-dcc1' },
    })
    return t.id
  }

  it('persists status + holder + exactly one audit row atomically', async () => {
    const id = await seedTicket(TICKET_STATUS.SubmittedToVpAndy)
    await useCase.execute({
      ticketId: id,
      event: TICKET_EVENT.AndyApproveComplete,
      actor: { sub: 'test-dcc1', activeRole: ROLE.Dcc1 },
    })
    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } })
    expect(after.status).toBe(TICKET_STATUS.Completed)
    expect(after.currentHolderSub).toBeNull() // terminal → no holder
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: id } })
    expect(events).toHaveLength(1)
    expect(events[0]?.toStatus).toBe(TICKET_STATUS.Completed)
  })

  it('rolls back the status change if the audit append fails (no orphan state)', async () => {
    const id = await seedTicket(TICKET_STATUS.SubmittedToVpAndy)
    // Valid new state, but the event points at a ghost ticket → FK insert fails,
    // so the whole transaction (incl. the status update) rolls back.
    await expect(
      repo.apply(id, () => ({
        ticket: {
          id,
          status: TICKET_STATUS.Completed,
          flow: FLOW.General,
          applicantSub: 'test-app',
          currentHolderSub: null,
          roundNo: 0,
          statusEnteredAt: new Date(),
        },
        event: {
          ticketId: 'ghost-does-not-exist',
          actorSub: 'test-dcc1',
          action: TICKET_EVENT.AndyApproveComplete,
          fromStatus: TICKET_STATUS.SubmittedToVpAndy,
          toStatus: TICKET_STATUS.Completed,
          roundNo: 0,
          occurredAt: new Date(),
        },
      })),
    ).rejects.toThrow()

    const after = await prisma.ticket.findUniqueOrThrow({ where: { id } })
    expect(after.status).toBe(TICKET_STATUS.SubmittedToVpAndy) // unchanged
    const events = await prisma.ticketEvent.findMany({ where: { ticketId: id } })
    expect(events).toHaveLength(0)
  })

  it('append-only: the app role cannot UPDATE ticket_event (AD-4 GRANT)', async () => {
    await expect(
      prisma.$executeRawUnsafe(`UPDATE ticket_event SET reason = 'tamper'`),
    ).rejects.toThrow(/permission denied/i)
  })
})
