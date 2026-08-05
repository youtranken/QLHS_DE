import { PRIORITY, type Priority } from '@qlhs/contracts'

/** Urgent floats highest, then Rush, then Normal; ties break oldest-first. */
const PRIORITY_RANK: Record<Priority, number> = {
  [PRIORITY.Urgent]: 0,
  [PRIORITY.Rush]: 1,
  [PRIORITY.Normal]: 2,
}

export interface PoolItem {
  priority: Priority
  statusEnteredAt: Date
}

export function sortPool<T extends PoolItem>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.statusEnteredAt.getTime() - b.statusEnteredAt.getTime(),
  )
}
