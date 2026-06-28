import type { ArmyList, ArmyUnit, Unit, UnitConfig } from '../types/index'
import { computeTotalPoints } from './pointsCalc'
import { uuid } from './uuid'

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
        format: 'dw-builder-list-v2',
        name: list.name,
        faction: list.faction_id,
        totalPoints: list.units.reduce((sum, unit) => sum + unit.totalPoints, 0),
        list,
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

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isUnitConfig(value: unknown): value is UnitConfig {
    if (!isObject(value)) return false
    const generatorSelection = value.generatorSelection
    return (
        isObject(value.hardpointSelections) &&
        (generatorSelection === null || isObject(generatorSelection)) &&
        isObject(value.optionQuantities)
    )
}

function isArmyListLike(value: unknown): value is ArmyList {
    return (
        isObject(value) &&
        typeof value.id === 'string' &&
        typeof value.name === 'string' &&
        typeof value.faction_id === 'string' &&
        Array.isArray(value.units) &&
        typeof value.createdAt === 'string' &&
        typeof value.updatedAt === 'string'
    )
}

function normalizeImportedList(list: ArmyList, units: Unit[]): ArmyList {
    const now = new Date().toISOString()
    const entries: ArmyUnit[] = list.units.flatMap((entry) => {
        const unit = units.find((item) => item.id === entry.unitId)
        if (!unit || !isUnitConfig(entry.config)) return []
        return [{
            instanceId: uuid(),
            unitId: unit.id,
            config: structuredClone(entry.config),
            totalPoints: computeTotalPoints(unit, entry.config),
        }]
    })

    return {
        id: uuid(),
        name: list.name || 'Imported list',
        faction_id: list.faction_id,
        units: entries,
        createdAt: now,
        updatedAt: now,
    }
}

export function parseImportedList(data: unknown, units: Unit[]): ArmyList | null {
    if (!isObject(data)) return null

    const nestedList = data.list
    if (isArmyListLike(nestedList)) {
        return normalizeImportedList(nestedList, units)
    }

    if (!Array.isArray(data.units) || typeof data.name !== 'string' || typeof data.faction !== 'string') {
        return null
    }

    const now = new Date().toISOString()
    const entries: ArmyUnit[] = data.units.flatMap((entry) => {
        if (!isObject(entry) || typeof entry.name !== 'string' || !isUnitConfig(entry.config)) return []
        const unit = units.find((item) => item.faction_id === data.faction && item.name === entry.name)
        if (!unit) return []
        return [{
            instanceId: uuid(),
            unitId: unit.id,
            config: structuredClone(entry.config),
            totalPoints: computeTotalPoints(unit, entry.config),
        }]
    })

    return {
        id: uuid(),
        name: data.name,
        faction_id: data.faction,
        units: entries,
        createdAt: now,
        updatedAt: now,
    }
}
