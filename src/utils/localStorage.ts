import type { ArmyList, Unit } from '../types/index'

const STORAGE_KEY = 'dw-builder-lists-v1'
const LEGACY_STORAGE_KEY = 'dw-builder-lists'

function safeParseLists(raw: string | null): ArmyList[] {
    if (!raw) return []
    try {
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

export function loadListsFromStorage(): ArmyList[] {
    const current = safeParseLists(localStorage.getItem(STORAGE_KEY))
    if (current.length > 0) return current
    return safeParseLists(localStorage.getItem(LEGACY_STORAGE_KEY))
}

export function saveListsToStorage(lists: ArmyList[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lists))
    } catch {
        console.warn('Could not save lists to localStorage')
    }
}

export function downloadList(list: ArmyList, units: Unit[]) {
    const exportData = {
        name: list.name,
        faction: list.faction_id,
        totalPoints: list.units.reduce((sum, unit) => sum + unit.totalPoints, 0),
        units: list.units.map((entry) => {
            const unit = units.find((item) => item.id === entry.unitId)
            return {
                name: unit?.name ?? entry.unitId,
                role: unit?.role,
                points: entry.totalPoints,
                config: entry.config,
            }
        }),
        exportedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${list.name.replace(/\s+/g, '_')}.json`
    link.click()
    URL.revokeObjectURL(url)
}
