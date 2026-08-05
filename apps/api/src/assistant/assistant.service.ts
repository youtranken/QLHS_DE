import { Injectable } from '@nestjs/common'
import { resolveIntents, MAX_INTENTS } from './intent/resolve-intents'
import { defaultSuggestions } from './intent/suggestions'
import { type Chip, type Intent } from './intent/types'
import { ToolRegistry } from './tool-registry'
import { AssistantRateLimiter } from './rate-limiter'
import { type Caller } from './assistant-tool'
import { renderTool } from './render/render'
import { type AnswerPayload, type Block } from './render/answer'

export interface AssistantReply {
  answer: AnswerPayload
  suggestions: Chip[]
}

function errorBlock(intent: Extract<Intent, { kind: 'tool' }>, e: unknown): Block {
  if ((e as { code?: string })?.code === 'TicketNotFound') {
    const code = typeof intent.args.code === 'string' ? intent.args.code : ''
    return { type: 'empty', text: `Không tìm thấy hồ sơ ${code} (hoặc bạn không có quyền xem).` }
  }
  return { type: 'empty', text: 'Có lỗi khi tra cứu, bạn thử lại giúp mình nhé.' }
}

function dedupeChips(chips: Chip[]): Chip[] {
  const seen = new Set<string>()
  const out: Chip[] = []
  for (const c of chips) if (!seen.has(c.text)) { seen.add(c.text); out.push(c) }
  return out
}

/** Điều phối: tách nhiều ý → chạy tool (RBAC use-case) → render block. Một ý lỗi
 *  KHÔNG làm hỏng cả câu. Trần MAX_INTENTS đếm theo TOOL chạy (unknown/clarify vẫn
 *  hiện, không chiếm suất — review P1). Rate-limit theo user, theo số tool (D3). */
@Injectable()
export class AssistantService {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly limiter: AssistantRateLimiter,
  ) {}

  async ask(caller: Caller, text: string): Promise<AssistantReply> {
    const intents = resolveIntents(text, caller.activeRole, caller.roles)
    const runnable = intents.filter(
      (it): it is Extract<Intent, { kind: 'tool' }> => it.kind === 'tool',
    )
    const planned = Math.min(runnable.length, MAX_INTENTS)
    if (planned > 0 && !this.limiter.allow(caller.sub, planned)) {
      return {
        answer: { blocks: [{ type: 'empty', text: 'Bạn hỏi hơi nhanh — thử lại sau ít giây nhé.' }] },
        suggestions: dedupeChips(defaultSuggestions(caller.activeRole)),
      }
    }

    const blocks: Block[] = []
    const chips: Chip[] = []
    let ran = 0

    for (const it of intents) {
      if (it.kind === 'clarify') {
        blocks.push({ type: 'text', text: it.reason })
        chips.push(...it.suggestions)
        continue
      }
      if (it.kind === 'unknown') {
        blocks.push({ type: 'text', text: 'Mình chưa hiểu ý này — bạn thử một trong các gợi ý bên dưới.' })
        chips.push(...it.suggestions)
        continue
      }
      if (ran >= MAX_INTENTS) break
      ran++
      const tool = this.registry.find(it.tool)
      const allowed = caller.activeRole !== null && tool?.activeRoles.includes(caller.activeRole)
      if (!tool || !allowed) {
        blocks.push({ type: 'empty', text: 'Yêu cầu này ngoài quyền của vai hiện tại.' })
        chips.push(...defaultSuggestions(caller.activeRole))
        continue
      }
      try {
        blocks.push(...renderTool(it, await tool.run(it.args, caller)))
      } catch (e) {
        blocks.push(errorBlock(it, e))
      }
    }

    if (!blocks.length) {
      blocks.push({ type: 'text', text: 'Mình chưa hiểu ý bạn.' })
      chips.push(...defaultSuggestions(caller.activeRole))
    }
    return { answer: { blocks }, suggestions: dedupeChips(chips) }
  }
}
