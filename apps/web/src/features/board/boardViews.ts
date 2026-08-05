import { EMPTY_FILTER, type BoardFilter } from './boardFilter'

/** A named board-filter preset (FR #9 "saved views"). Persisted per browser in
 *  localStorage — no server round-trip, survives reloads. */
export interface SavedView {
  name: string
  filter: BoardFilter
}

const KEY = 'qlhs-board-views'

function coerce(raw: unknown): SavedView[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((v): v is SavedView => !!v && typeof (v as SavedView).name === 'string')
    .map((v) => ({ name: v.name, filter: { ...EMPTY_FILTER, ...v.filter } }))
}

export function loadViews(): SavedView[] {
  try {
    return coerce(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return []
  }
}

export function saveViews(views: SavedView[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(views))
  } catch {
    /* storage full / disabled — the in-memory list still works this session */
  }
}

/** Add or replace a view by (trimmed) name; returns a new array. Empty name → unchanged. */
export function upsertView(views: SavedView[], name: string, filter: BoardFilter): SavedView[] {
  const trimmed = name.trim()
  if (!trimmed) return views
  const rest = views.filter((v) => v.name !== trimmed)
  return [...rest, { name: trimmed, filter }]
}

export function removeView(views: SavedView[], name: string): SavedView[] {
  return views.filter((v) => v.name !== name)
}

/** A view is "active" when every facet equals the current filter. */
export function isViewActive(view: SavedView, filter: BoardFilter): boolean {
  const a = view.filter
  return (
    a.q.trim() === filter.q.trim() &&
    a.overOnly === filter.overOnly &&
    a.flow === filter.flow &&
    a.priority === filter.priority
  )
}
