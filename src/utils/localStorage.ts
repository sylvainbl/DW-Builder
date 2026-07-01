import type { ArmyBattlefleet, ArmyList, ArmyModel, ArmyUnit, Unit, UnitConfig } from '../types/index'
import { computeArmyUnitTotal, updateArmyUnitTotals } from './pointsCalc'
import { uuid } from './uuid'

const STORAGE_KEY = 'dw-builder-lists-v1'
const LEGACY_STORAGE_KEY = 'dw-builder-lists'
const emptyUnitConfig: UnitConfig = {
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities: {},
}

function normalizeFactionId(id: string): string {
    if (id === 'Alliance') return 'alliance'
    if (id === 'Crown') return 'crown'
    if (id === 'Imperium') return 'imperium'
    if (id === 'Empire') return 'empire'
    return id
}

function normalizeUnitId(id: string): string {
    if (id.startsWith('Alliance_')) return `alliance_${id.slice('Alliance_'.length)}`
    if (id.startsWith('Crown_')) return `crown_${id.slice('Crown_'.length)}`
    if (id.startsWith('Imperium_')) return `imperium_${id.slice('Imperium_'.length)}`
    if (id.startsWith('Empire_')) return `empire_${id.slice('Empire_'.length)}`
    return id
}

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
        format: 'dw-builder-list-v3',
        name: list.name,
        faction: list.faction_id,
        totalPoints: list.units.reduce((sum, unit) => sum + unit.totalPoints, 0),
        battlefleets: list.battlefleets ?? [],
        list,
        units: list.units.map((entry) => {
            const unit = units.find((item) => item.id === entry.unitId)
            return {
                name: unit?.name ?? entry.unitId,
                customName: entry.customName,
                role: unit?.role,
                points: entry.totalPoints,
                battlefleetInstanceId: entry.battlefleetInstanceId ?? null,
                config: entry.config,
                models: entry.models,
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
    const generatorSelections = value.generatorSelections
    const fleetDoctrineSelection = value.fleetDoctrineSelection
    return (
        isObject(value.hardpointSelections) &&
        (generatorSelection === null || isObject(generatorSelection)) &&
        (generatorSelections === undefined || Array.isArray(generatorSelections)) &&
        (fleetDoctrineSelection === undefined || fleetDoctrineSelection === null || isObject(fleetDoctrineSelection)) &&
        isObject(value.optionQuantities)
    )
}

function normalizeUnitConfig(config: UnitConfig): UnitConfig {
    return {
        ...structuredClone(emptyUnitConfig),
        ...config,
        generatorSelections: config.generatorSelections,
        fleetDoctrineSelection: config.fleetDoctrineSelection ?? null,
    }
}

function minimumModels(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

function maximumModels(unit: Unit): number {
    return Math.max(minimumModels(unit), unit.max ?? (typeof unit.models === 'number' ? unit.models : minimumModels(unit)))
}

function makeImportedModels(unit: Unit, config: UnitConfig, models: unknown): ArmyModel[] {
    const importedModels = Array.isArray(models)
        ? models.flatMap((model) => (
            isObject(model) && isUnitConfig(model.config)
                ? [{
                    modelId: uuid(),
                    customName: typeof model.customName === 'string' && model.customName.trim().length > 0
                        ? model.customName.trim()
                        : undefined,
                    config: normalizeUnitConfig(model.config),
                }]
                : []
        ))
        : []
    const normalized = (importedModels.length > 0 ? importedModels : [{ modelId: uuid(), config: normalizeUnitConfig(config) }])
        .slice(0, maximumModels(unit))
    while (normalized.length < minimumModels(unit)) {
        normalized.push({ modelId: uuid(), config: structuredClone(emptyUnitConfig) })
    }
    return normalized
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

function normalizeImportedBattlefleets(value: unknown): ArmyBattlefleet[] {
    if (!Array.isArray(value)) return []
    return value.flatMap((battlefleet) => {
        if (!isObject(battlefleet) || typeof battlefleet.definitionId !== 'string') return []
        return [{
            instanceId: typeof battlefleet.instanceId === 'string' ? battlefleet.instanceId : uuid(),
            definitionId: battlefleet.definitionId,
            name: typeof battlefleet.name === 'string' && battlefleet.name.trim().length > 0
                ? battlefleet.name
                : battlefleet.definitionId,
            customName: typeof battlefleet.customName === 'string' && battlefleet.customName.trim().length > 0
                ? battlefleet.customName.trim()
                : undefined,
        }]
    })
}

function normalizeImportedEntry(entry: ArmyUnit, units: Unit[]): ArmyUnit[] {
    const unitId = normalizeUnitId(entry.unitId)
    const unit = units.find((item) => item.id === unitId)
    if (!unit || !isUnitConfig(entry.config)) return []
    const normalized: ArmyUnit = {
        instanceId: uuid(),
        unitId,
        customName: typeof entry.customName === 'string' && entry.customName.trim().length > 0
            ? entry.customName.trim()
            : undefined,
        battlefleetInstanceId: typeof entry.battlefleetInstanceId === 'string' ? entry.battlefleetInstanceId : null,
        config: normalizeUnitConfig(entry.config),
        models: makeImportedModels(unit, entry.config, entry.models),
        totalPoints: 0,
        attachedUnits: (entry.attachedUnits ?? []).flatMap((attachment) => normalizeImportedEntry(attachment, units)),
    }
    normalized.totalPoints = computeArmyUnitTotal(normalized, units)
    return [normalized]
}

function normalizeImportedList(list: ArmyList, units: Unit[]): ArmyList {
    const now = new Date().toISOString()
    const entries = list.units.flatMap((entry) => normalizeImportedEntry(entry, units))
    const battlefleets = normalizeImportedBattlefleets(list.battlefleets)
    const normalizedList = {
        id: uuid(),
        name: list.name || 'Imported list',
        faction_id: normalizeFactionId(list.faction_id),
        battlefleets,
        units: entries,
        createdAt: now,
        updatedAt: now,
    }

    return {
        ...normalizedList,
        units: updateArmyUnitTotals(normalizedList.units, units, normalizedList),
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
    const factionId = normalizeFactionId(data.faction)
    const battlefleets = normalizeImportedBattlefleets(data.battlefleets)
    const entries: ArmyUnit[] = data.units.flatMap((entry) => {
        if (!isObject(entry) || typeof entry.name !== 'string' || !isUnitConfig(entry.config)) return []
        const unit = units.find((item) => item.faction_id === factionId && item.name === entry.name)
        if (!unit) return []
        const normalized: ArmyUnit = {
            instanceId: uuid(),
            unitId: unit.id,
            customName: typeof entry.customName === 'string' && entry.customName.trim().length > 0
                ? entry.customName.trim()
                : undefined,
            battlefleetInstanceId: typeof entry.battlefleetInstanceId === 'string' ? entry.battlefleetInstanceId : null,
            config: normalizeUnitConfig(entry.config),
            models: makeImportedModels(unit, entry.config, entry.models),
            totalPoints: 0,
        }
        normalized.totalPoints = computeArmyUnitTotal(normalized, units)
        return [normalized]
    })
    const normalizedList = {
        id: uuid(),
        name: data.name,
        faction_id: factionId,
        battlefleets,
        units: entries,
        createdAt: now,
        updatedAt: now,
    }

    return {
        ...normalizedList,
        units: updateArmyUnitTotals(normalizedList.units, units, normalizedList),
    }
}
