import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { type INestApplication } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import cookieParser from 'cookie-parser'
import request, { type Agent } from 'supertest'
import { FLOW, TICKET_STATUS } from '@qlhs/contracts'
import { AppModule } from '../src/app.module'
import { DomainErrorFilter } from '../src/http/common/domain-error.filter'

const OWNER_URL = 'postgresql://qlhs:qlhs@localhost:5432/qlhs?schema=public'

/** Trợ lý nội bộ: đúng quyền (RBAC âm cross-user, không oracle), nhiều-ý, cờ tắt. */
describe('POST /assistant/ask', () => {
  let app: INestApplication
  let admin: PrismaClient

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: OWNER_URL } } })
    await admin.$connect()
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.use(cookieParser())
    app.useGlobalFilters(new DomainErrorFilter())
    await app.init()
  })

  afterAll(async () => {
    await admin.$disconnect()
    await app.close()
  })

  beforeEach(async () => {
    delete process.env.ASSISTANT_ENABLED
    await admin.ticketLock.deleteMany({})
    await admin.ticketEvent.deleteMany({})
    await admin.ticket.deleteMany({})
  })

  async function login(sub: string, roles: string[]): Promise<Agent> {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/auth/dev-login').send({ sub, roles })
    return agent
  }

  async function aTicket(applicantSub: string, code: string): Promise<void> {
    await admin.ticket.create({
      data: { status: TICKET_STATUS.Submitted, flow: FLOW.General, applicantSub, priority: 'normal', code },
    })
  }

  it('liệt kê hồ sơ của chính người hỏi', async () => {
    await aTicket('a', 'G-2026-0100')
    const a = await login('a', ['Applicant'])
    const res = await a.post('/assistant/ask').send({ text: 'hồ sơ của tôi' })
    expect(res.status).toBe(200)
    const list = res.body.answer.blocks.find((b: { type: string }) => b.type === 'ticketList')
    expect(list.rows.map((r: { code: string }) => r.code)).toContain('G-2026-0100')
  })

  it('KHÔNG lộ hồ sơ người khác qua chi tiết (không oracle, block "không tìm thấy")', async () => {
    await aTicket('a', 'G-2026-0101')
    const b = await login('b', ['Applicant'])
    const res = await b.post('/assistant/ask').send({ text: 'chi tiết hồ sơ G-2026-0101' })
    expect(res.status).toBe(200)
    // Không có block chi tiết; chỉ có block "không tìm thấy".
    expect(res.body.answer.blocks.some((x: { type: string }) => x.type === 'ticketDetail')).toBe(false)
    expect(JSON.stringify(res.body)).toContain('Không tìm thấy')
  })

  it('read-only: xem chi tiết hồ sơ của chính mình KHÔNG ghi ticket_view (markSeen:false)', async () => {
    await aTicket('a', 'G-2026-0110')
    const a = await login('a', ['Applicant'])
    const before = await admin.ticketView.count()
    const res = await a.post('/assistant/ask').send({ text: 'chi tiết hồ sơ G-2026-0110' })
    expect(res.status).toBe(200)
    // xem được chi tiết của mình…
    expect(res.body.answer.blocks.some((x: { type: string }) => x.type === 'ticketDetail')).toBe(true)
    // …nhưng chỉ HỎI không được đánh dấu đã xem (bảo toàn badge "chưa xem", AD-18).
    expect(await admin.ticketView.count()).toBe(before)
  })

  it('KHÔNG lộ "bước tiếp theo" của hồ sơ người khác', async () => {
    await aTicket('a', 'G-2026-0102')
    const b = await login('b', ['Applicant'])
    const res = await b.post('/assistant/ask').send({ text: 'G-2026-0102 bước tiếp theo là gì' })
    expect(res.status).toBe(200)
    expect(res.body.answer.blocks.some((x: { type: string }) => x.type === 'actions')).toBe(false)
  })

  it('nhiều ý một lúc → nhiều block', async () => {
    await aTicket('a', 'G-2026-0103')
    const a = await login('a', ['Applicant'])
    const res = await a.post('/assistant/ask').send({ text: 'hồ sơ của tôi và thông báo chưa đọc' })
    expect(res.status).toBe(200)
    expect(res.body.answer.blocks.length).toBe(2)
    expect(res.body.answer.blocks[0].type).toBe('ticketList')
  })

  it('ASSISTANT_ENABLED=0 → tắt (404)', async () => {
    process.env.ASSISTANT_ENABLED = '0'
    const a = await login('a', ['Applicant'])
    const res = await a.post('/assistant/ask').send({ text: 'hồ sơ của tôi' })
    expect(res.status).toBe(404)
  })

  it('Applicant hỏi "thống kê" → KHÔNG chạm analytics (unknown + gợi ý)', async () => {
    const a = await login('a', ['Applicant'])
    const res = await a.post('/assistant/ask').send({ text: 'thống kê tháng này' })
    expect(res.status).toBe(200)
    expect(res.body.answer.blocks.some((b: { type: string }) => b.type === 'stats')).toBe(false)
    expect(res.body.suggestions.length).toBeGreaterThan(0)
  })

  it('Admin "tổng quan hệ thống" → block thống kê', async () => {
    const boss = await login('boss', ['Admin'])
    const res = await boss.post('/assistant/ask').send({ text: 'tổng quan hệ thống' })
    expect(res.status).toBe(200)
    expect(res.body.answer.blocks.some((b: { type: string }) => b.type === 'stats')).toBe(true)
  })

  it('DCC1 "việc của tôi" → bàn làm việc (không unknown)', async () => {
    const lan = await login('lan', ['DCC1'])
    const res = await lan.post('/assistant/ask').send({ text: 'việc của tôi cần xử lý' })
    expect(res.status).toBe(200)
    const types = res.body.answer.blocks.map((b: { type: string }) => b.type)
    expect(types).not.toContain('text') // 'text' = unknown/clarify; workbox → ticketList|empty
  })
})
