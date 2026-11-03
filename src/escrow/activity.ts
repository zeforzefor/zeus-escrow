import { useSyncExternalStore } from 'react'

export type ActivityStatus = 'pending' | 'success' | 'failed'

export interface ActivityEntry {
  hash: `0x${string}`
  label: string
  chainId: number
  account: string
  at: number
  status: ActivityStatus
  dealId?: string

  contract?: string
}

const KEY = 'zeus-escrow-activity-v1'
const MAX = 60

function load(): ActivityEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ActivityEntry[]) : []
  } catch {
    return []
  }
}

let entries: ActivityEntry[] = load()
const listeners = new Set<() => void>()

function commit(next: ActivityEntry[]) {
  entries = next.slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {

  }
  for (const listener of listeners) listener()
}

export function addActivity(entry: ActivityEntry) {
  commit([entry, ...entries.filter((e) => e.hash !== entry.hash)])
}

export function setActivityStatus(hash: string, status: ActivityStatus) {
  commit(entries.map((e) => (e.hash === hash ? { ...e, status } : e)))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useActivity(): ActivityEntry[] {
  return useSyncExternalStore(subscribe, () => entries)
}
