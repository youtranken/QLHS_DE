/** Zero-dep toast bus. Components call `toast.ok/err/info/action`; a single
 *  <ToastHost/> (mounted once at the app root) subscribes and renders the stack.
 *  Deliberately module-level (not context) so any module — not just React
 *  components — can raise a toast without prop-drilling. */

export interface ToastAction {
  label: string
  run: () => void | Promise<void>
}

export interface ToastItem {
  id: number
  kind: 'ok' | 'err' | 'info'
  text: string
  action?: ToastAction
}

type Listener = (items: ToastItem[]) => void

let items: ToastItem[] = []
let seq = 0
const listeners = new Set<Listener>()
const timers = new Map<number, ReturnType<typeof setTimeout>>()

function emit(): void {
  for (const l of listeners) l(items)
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l)
  l(items)
  return () => {
    listeners.delete(l)
  }
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id)
  const tm = timers.get(id)
  if (tm) {
    clearTimeout(tm)
    timers.delete(id)
  }
  emit()
}

function push(item: Omit<ToastItem, 'id'>, ttlMs: number): number {
  const id = ++seq
  items = [...items, { ...item, id }]
  emit()
  timers.set(
    id,
    setTimeout(() => dismissToast(id), ttlMs),
  )
  return id
}

/** Undo-style toasts hold longer so the action stays reachable. */
export const toast = {
  ok: (text: string) => push({ kind: 'ok', text }, 3500),
  err: (text: string) => push({ kind: 'err', text }, 6000),
  info: (text: string) => push({ kind: 'info', text }, 4000),
  action: (text: string, action: ToastAction) => push({ kind: 'info', text, action }, 7000),
}
