import { type Role } from '@qlhs/contracts'
import { resolveIntent } from './resolve-intent'
import { defaultSuggestions } from './suggestions'
import { TOOL, type Intent } from './types'

export const MAX_INTENTS = 4

// Dấu tách MẠNH (luôn tách): ; ? xuống-dòng, và từ chuyển-chủ-đề "còn".
// CHỈ dạng CÓ DẤU — "con"/"va"/"voi" không dấu là từ thường (con, va chạm, voi),
// nhận làm dấu tách sẽ cắt nhầm câu bình thường (review P2).
const STRONG_RE = /[;?\n]+|\s+còn\s+/giu
// Dấu tách YẾU: , và với and — chỉ tách khi hai vế ra HAI tool khác nhau (§4.1).
const WEAK_RE = /\s*,\s*|\s+(?:và|với|and)\s+/giu

function pieces(text: string, re: RegExp): string[] {
  return text.split(re).map((x) => x.trim()).filter(Boolean)
}

/** Có nên tách hai mảnh thành hai ý? Khác tool ⇒ có. Cùng tool ⇒ chỉ khi là
 *  chi-tiết/bước-tiếp với MÃ khác nhau (else = nhiều filter trên một truy vấn). */
function isSplit(a: Intent, b: Intent): boolean {
  if (a.kind !== 'tool' || b.kind !== 'tool') return false
  if (a.tool !== b.tool) return true
  if (a.tool === TOOL.TicketDetail || a.tool === TOOL.WhatsNext) return a.args.code !== b.args.code
  return false
}

function clausesFrom(text: string, activeRole: Role | null, roles: readonly Role[]): string[] {
  const out: string[] = []
  for (const seg of pieces(text, STRONG_RE)) {
    const frags = pieces(seg, WEAK_RE)
    let cur = frags[0] ?? ''
    for (let i = 1; i < frags.length; i++) {
      const frag = frags[i]
      if (!frag) continue
      const a = resolveIntent(cur, activeRole, roles)
      const b = resolveIntent(frag, activeRole, roles)
      if (isSplit(a, b)) {
        out.push(cur)
        cur = frag
      } else {
        cur = `${cur} ${frag}`
      }
    }
    if (cur.trim()) out.push(cur.trim())
  }
  return out.length ? out : [text.trim()]
}

/** Tách nhiều ý (deterministic) → giải từng ý; khử trùng; trần N=4; gộp all-unknown. */
export function resolveIntents(text: string, activeRole: Role | null, roles: readonly Role[]): Intent[] {
  const intents = clausesFrom(text, activeRole, roles).map((c) => resolveIntent(c, activeRole, roles))

  const seen = new Set<string>()
  const deduped: Intent[] = []
  for (const it of intents) {
    if (it.kind === 'tool') {
      const key = `${it.tool}:${JSON.stringify(it.args)}:${JSON.stringify(it.filters ?? {})}`
      if (seen.has(key)) continue
      seen.add(key)
    }
    deduped.push(it)
  }

  if (deduped.filter((i) => i.kind === 'tool').length > MAX_INTENTS) {
    return [
      {
        kind: 'clarify',
        reason: 'Bạn hỏi hơi nhiều ý một lúc — chọn một mục để bắt đầu.',
        suggestions: defaultSuggestions(activeRole),
      },
    ]
  }
  if (deduped.every((i) => i.kind === 'unknown')) {
    return [{ kind: 'unknown', suggestions: defaultSuggestions(activeRole) }]
  }
  return deduped
}
