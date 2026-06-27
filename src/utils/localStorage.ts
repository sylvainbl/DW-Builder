import type { ArmyList } from '../types/index'

const STORAGE_KEY = 'dw-builder-lists'

export function loadSavedLists(): ArmyList[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) {
            return []
        }
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
            return []
        }
        return parsed
    } catch {
        return []
    }
}

export function saveList(list: ArmyList): void {
    try {
        const existing = loadSavedLists()
        const updated = existing.filter((item) => item.id !== list.id)
        updated.push(list)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
        // ignore storage errors
    }
}

export function deleteList(id: string): void {
    try {
        const existing = loadSavedLists()
        const updated = existing.filter((item) => item.id !== id)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
        // ignore storage errors
    }
}
