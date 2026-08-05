import { useSyncExternalStore } from 'react'
import { setLocale } from './t'
import { en } from './en'
import { vi } from './vi'

export type Locale = 'vi' | 'en'
const KEY = 'qlhs-locale'

export function currentLocale(): Locale {
  return localStorage.getItem(KEY) === 'en' ? 'en' : 'vi'
}

/** Called once before first render (main.tsx). VI is the built-in default, so
 *  only 'en' needs an explicit swap. */
export function applyStartupLocale(): void {
  if (currentLocale() === 'en') setLocale(en, 'en-US')
}

// In-place language switch (no full-page reload → no white flash, no re-auth, no
// refetch). t() reads the module-level catalog at render time, so swapping it and
// bumping this version re-renders the whole tree from the new strings. No React
// component is memoized, so the single top-level subscription cascades everywhere.
let version = 0
const subscribers = new Set<() => void>()

function subscribe(cb: () => void): () => void {
  subscribers.add(cb)
  return () => {
    subscribers.delete(cb)
  }
}

/** Subscribe the app root to language changes; the returned value changes on switch. */
export function useLocaleVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}

export function switchLocale(next: Locale): void {
  if (next === currentLocale()) return
  localStorage.setItem(KEY, next)
  setLocale(next === 'en' ? en : vi, next === 'en' ? 'en-US' : 'vi-VN')
  version += 1
  for (const cb of subscribers) cb()
}
