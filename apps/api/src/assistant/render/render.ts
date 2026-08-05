import { isTerminal, type TicketStatus } from '@qlhs/contracts'
import { type TicketView } from '../../application/core/ticket-view'
import { type TicketDetail } from '../../application/core/ticket-detail.usecase'
import { type NotificationList } from '../../application/notify/list-notifications.usecase'
import { type FlowLine, type StationTicket } from '../../application/dispatch/dispatch-map.usecase'
import { type SlaPauseReport } from '../../application/sla/list-sla-pauses.usecase'
import { type AdminOverviewData } from '../../application/admin/get-admin-overview.usecase'
import { type AnalyticsData } from '../../application/admin/get-analytics.usecase'
import { type AuditPage } from '../../application/admin/search-audit.usecase'
import { TOOL, type Filters, type Intent } from '../intent/types'
import { type Block, type TicketRowVM } from './answer'

type ToolIntent = Extract<Intent, { kind: 'tool' }>

const AUDIT_LIMIT = 8
const ROW_LIMIT = 30

function rowVM(r: TicketView): TicketRowVM {
  return { code: r.code, flow: r.flow, status: r.status, priority: r.priority, unseen: r.unseen }
}

/** Lọc hậu-kỳ trên field TicketView có sẵn. Overdue cần SLA (không có ở list) →
 *  chưa lọc, chỉ ghi chú để không hứa hão. */
function applyFilters(rows: TicketView[], f?: Filters): { rows: TicketView[]; note?: string } {
  let out = rows
  if (f?.flow) out = out.filter((r) => r.flow === f.flow)
  if (f?.status) out = out.filter((r) => r.status === f.status)
  if (f?.openOnly === true) out = out.filter((r) => !isTerminal(r.status as TicketStatus))
  if (f?.urgent) out = out.filter((r) => r.priority !== 'normal')
  const note = f?.overdue
    ? 'Danh sách này chưa lọc theo trễ hạn — mở chi tiết từng hồ sơ để xem SLA.'
    : undefined
  return { rows: out, note }
}

/** Bảng hồ sơ, cắt trần ROW_LIMIT để payload không phình với trạm/đóng đông. */
function listOrEmpty(rows: TicketRowVM[], empty: string, note?: string): Block[] {
  if (!rows.length) return [{ type: 'empty', text: empty }]
  const shown = rows.slice(0, ROW_LIMIT)
  const capped = rows.length > shown.length ? `Hiển thị ${ROW_LIMIT}/${rows.length} hồ sơ.` : undefined
  const merged = [note, capped].filter(Boolean).join(' ') || undefined
  return [{ type: 'ticketList', rows: shown, note: merged }]
}

export function renderTool(intent: ToolIntent, out: unknown): Block[] {
  switch (intent.tool) {
    case TOOL.MyTickets: {
      const { rows, note } = applyFilters(out as TicketView[], intent.filters)
      return listOrEmpty(rows.map(rowVM), 'Bạn không có hồ sơ nào khớp.', note)
    }
    case TOOL.ClosedLookup:
      return listOrEmpty((out as TicketView[]).map(rowVM), 'Không có hồ sơ đã đóng nào khớp.')

    case TOOL.TicketDetail: {
      const d = out as TicketDetail
      return [
        {
          type: 'ticketDetail',
          code: d.code,
          flow: d.flow,
          status: d.status,
          priority: d.priority,
          overdueDays: d.overdueDays,
          paused: d.paused,
          // Hồ sơ đóng không có SLA → tránh render pill "trong hạn" bịa (review P2).
          isClosed: d.isClosed,
          documentType: d.documentType,
        },
      ]
    }
    case TOOL.WhatsNext: {
      const d = out as TicketDetail
      const actions = d.actions.map((a) => ({ label: a.label, toStatus: a.toStatus }))
      if (!actions.length) return [{ type: 'text', text: `Hồ sơ ${d.code ?? ''} hiện không có bước nào cho bạn.` }]
      return [{ type: 'actions', code: d.code, status: d.status, actions }]
    }
    case TOOL.Notifications: {
      const nl = out as NotificationList
      const unreadOnly = intent.args.unreadOnly === true
      const items = (unreadOnly ? nl.items.filter((i) => !i.read) : nl.items).map((i) => ({
        code: i.code,
        kind: i.kind,
        createdAt: i.createdAt,
        read: i.read,
      }))
      if (!items.length) {
        return [{ type: 'empty', text: unreadOnly ? 'Không có thông báo chưa đọc.' : 'Bạn chưa có thông báo nào.' }]
      }
      return [{ type: 'notifications', items, unread: nl.unread }]
    }

    case TOOL.Workbox:
      return listOrEmpty(out as TicketRowVM[], 'Bàn của bạn đang trống — không có việc cần xử lý.')

    case TOOL.StationTickets: {
      const rows = (out as StationTicket[]).map((t) => ({
        code: t.code,
        flow: t.flow,
        status: String(intent.args.status ?? ''),
        contractor: t.contractor,
        overdueDays: t.overdueDays,
      }))
      return listOrEmpty(rows, 'Không có hồ sơ nào ở bước này.')
    }

    case TOOL.DispatchMap: {
      const lines = out as FlowLine[]
      if (!lines.length) return [{ type: 'empty', text: 'Không có tuyến nào trong phạm vi của bạn.' }]
      return [
        {
          type: 'stats',
          title: 'Bản đồ tuyến',
          items: lines.map((l) => ({
            label: l.flow,
            value: `${l.total} hồ sơ (trễ ${l.stations.reduce((n, s) => n + s.overdueCount, 0)})`,
          })),
        },
      ]
    }

    case TOOL.Paused: {
      const rep = out as SlaPauseReport
      if (!rep.open.length) return [{ type: 'empty', text: 'Không có hồ sơ nào đang tạm dừng SLA.' }]
      return [
        {
          type: 'lines',
          title: `${rep.open.length} hồ sơ đang tạm dừng SLA`,
          items: rep.open.map((p) => ({
            code: p.code,
            primary: p.status,
            secondary: `${p.pausedByName} · ${p.pausedDays} ngày${p.stale ? ' · để lâu' : ''}`,
          })),
        },
      ]
    }

    case TOOL.Overview: {
      const o = out as AdminOverviewData
      return [
        {
          type: 'stats',
          title: 'Tổng quan hệ thống',
          items: [
            { label: 'Đang chạy', value: o.runningTotal },
            { label: 'Trễ hạn', value: o.overdueTotal },
            { label: 'Tạm dừng SLA', value: o.pausedTotal },
            { label: 'Thao tác hôm nay', value: o.auditToday },
            { label: 'Người dùng', value: o.users.total },
            { label: 'Email chờ gửi', value: o.mailPending },
          ],
        },
      ]
    }

    case TOOL.Analytics: {
      const a = out as AnalyticsData
      const blocks: Block[] = [
        {
          type: 'stats',
          title: `Thống kê (${a.granularity === 'week' ? 'theo tuần' : 'theo tháng'})`,
          items: [{ label: 'Số hồ sơ đang trễ (top)', value: a.topOverdue.length }],
        },
      ]
      if (a.topOverdue.length) {
        blocks.push({
          type: 'ticketList',
          rows: a.topOverdue.map((t) => ({
            code: t.code,
            flow: t.flow,
            status: t.status,
            overdueDays: t.overdueDays,
          })),
          note: 'Xem đầy đủ ở màn Thống kê của Console.',
        })
      }
      return blocks
    }

    case TOOL.Audit: {
      const p = out as AuditPage
      if (!p.events.length) return [{ type: 'empty', text: 'Không có bản ghi nhật ký nào khớp.' }]
      return [
        {
          type: 'lines',
          title: `Nhật ký gần đây (${p.total} bản ghi)`,
          items: p.events.slice(0, AUDIT_LIMIT).map((e) => ({
            code: e.code,
            primary: e.action,
            secondary: `${e.actorName} · ${e.occurredAt.slice(0, 10)}`,
          })),
        },
      ]
    }

    default:
      return [{ type: 'empty', text: 'Tính năng chưa hỗ trợ.' }]
  }
}
