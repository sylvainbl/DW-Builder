import { create } from 'zustand'
import type { ArmyBattlefleet, ArmyList, ArmyModel, ArmyUnit, BattlefleetDefinition, Faction, FleetDoctrine, Generator, Unit, UnitConfig } from '../types/index'
import { loadListsFromStorage, saveListsToStorage } from '../utils/localStorage'
import { computeArmyUnitTotal, isUnitLevelOption, updateListUnit } from '../utils/pointsCalc'
import { uuid } from '../utils/uuid'

const emptyUnitConfig: UnitConfig = {
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities: {},
}

interface AppStore {
    factions: Faction[]
    units: Unit[]
    glossary: Record<string, Record<string, string>> | null
    generators: Record<string, Generator[]>
    fleetDoctrines: Record<string, FleetDoctrine[]>
    battlefleetDefinitions: BattlefleetDefinition[]
    dataLoaded: boolean
    loadData: () => Promise<void>

    selectedFactionId: string | null
    setSelectedFactionId: (id: string | null) => void

    searchQuery: string
    setSearchQuery: (q: string) => void
    selectedRoles: string[]
    toggleRoleFilter: (role: string) => void

    selectedUnitId: string | null
    setSelectedUnitId: (id: string | null) => void
    selectedListInstanceId: string | null
    setSelectedListInstanceId: (id: string | null) => void
    selectedBattlefleetInstanceId: string | null
    selectBattlefleet: (instanceId: string | null) => void
    selectedModelId: string | null

    currentList: ArmyList | null
    savedLists: ArmyList[]
    activeUnitConfig: UnitConfig

    createList: (name: string, factionId: string) => void
    openList: (listId: string) => void
    closeList: () => void
    deleteList: (listId: string) => void
    importList: (list: ArmyList) => void
    renameList: (listId: string, newName: string) => void
    persistLists: () => void

    addUnitToCurrentList: (unitId: string) => void
    addAttachmentToListUnit: (parentInstanceId: string, unitId: string) => void
    removeUnitFromList: (instanceId: string) => void
    addBattlefleetToCurrentList: (definitionId: string) => void
    removeBattlefleetFromCurrentList: (battlefleetInstanceId: string) => void
    setUnitBattlefleet: (instanceId: string, battlefleetInstanceId: string | null) => void
    selectListUnit: (instanceId: string) => void
    selectModel: (modelId: string) => void
    addModelToListUnit: (instanceId: string) => void
    removeModelFromListUnit: (instanceId: string, modelId: string) => void

    setHardpointSelection: (weaponIndex: number, weaponName: string) => void
    setGeneratorSelection: (selection: UnitConfig['generatorSelection']) => void
    setFleetDoctrineSelection: (selection: UnitConfig['fleetDoctrineSelection']) => void
    setOptionQuantity: (tag: string, quantity: number) => void
}

function cloneConfig(config: UnitConfig): UnitConfig {
    return structuredClone(config)
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

function normalizeConfig(config: Partial<UnitConfig> | null | undefined): UnitConfig {
    return {
        ...cloneConfig(emptyUnitConfig),
        ...config,
        hardpointSelections: config?.hardpointSelections ?? {},
        generatorSelection: config?.generatorSelection ?? null,
        fleetDoctrineSelection: config?.fleetDoctrineSelection ?? null,
        optionQuantities: config?.optionQuantities ?? {},
    }
}

function getMinimumModels(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

function getMaximumModels(unit: Unit): number {
    return Math.max(getMinimumModels(unit), unit.max ?? (typeof unit.models === 'number' ? unit.models : getMinimumModels(unit)))
}

function makeModel(config: UnitConfig = emptyUnitConfig): ArmyModel {
    return {
        modelId: uuid(),
        config: cloneConfig(config),
    }
}

function makeModels(unit: Unit, firstConfig: UnitConfig = emptyUnitConfig): ArmyModel[] {
    const modelCount = getMinimumModels(unit)
    return Array.from({ length: modelCount }, (_, index) => makeModel(index === 0 ? firstConfig : emptyUnitConfig))
}

function makeArmyUnit(unit: Unit, config: UnitConfig = emptyUnitConfig, battlefleetInstanceId: string | null = null): ArmyUnit {
    const entry: ArmyUnit = {
        instanceId: uuid(),
        unitId: unit.id,
        battlefleetInstanceId,
        config: cloneConfig(emptyUnitConfig),
        models: makeModels(unit, config),
        totalPoints: 0,
    }
    entry.totalPoints = computeArmyUnitTotal(entry, [unit])
    return entry
}

function makeBattlefleet(definition: BattlefleetDefinition, existingBattlefleets: ArmyBattlefleet[] = []): ArmyBattlefleet {
    const existingCount = existingBattlefleets.filter((battlefleet) => battlefleet.definitionId === definition.id).length
    return {
        instanceId: uuid(),
        definitionId: definition.id,
        name: existingCount === 0 ? definition.name : `${definition.name} ${existingCount + 1}`,
    }
}

function makeDefaultBattlefleets(factionId: string, definitions: BattlefleetDefinition[]): ArmyBattlefleet[] {
    const defaultDefinition = definitions.find((definition) => definition.faction_id === factionId && definition.type === 'main' && !definition.legendary)
        ?? definitions.find((definition) => definition.faction_id === factionId && definition.type === 'main')
    return defaultDefinition ? [makeBattlefleet(defaultDefinition)] : []
}

function getAttachmentModelLimit(unit: Unit): number {
    return unit.attachment?.max_models ?? getMaximumModels(unit)
}

function countAttachedModels(entries: ArmyUnit[], unitId: string): number {
    return entries.reduce((sum, entry) => sum + (entry.unitId === unitId ? entry.models.length : 0), 0)
}

function normalizeArmyUnit(entry: ArmyUnit, units: Unit[]): ArmyUnit | null {
    const unitId = normalizeUnitId(entry.unitId)
    const unit = units.find((item) => item.id === unitId)
    if (!unit) return null
    const legacy = entry as ArmyUnit & {
        hardpoints?: { slot: string; weaponName: string }[]
        options?: { tag: string; quantity: number }[]
        generator?: Generator | null
    }
    const config = normalizeConfig(entry.config ?? {
        hardpointSelections: {},
        generatorSelection: legacy.generator
            ? { weaponIndex: 0, generatorName: legacy.generator.name, generatorCost: legacy.generator.point_cost }
            : null,
        fleetDoctrineSelection: null,
        optionQuantities: Object.fromEntries((legacy.options ?? []).map((option) => [option.tag, option.quantity])),
    })
    const legacyModels = (entry as ArmyUnit & { models?: ArmyModel[] }).models
    const models = Array.isArray(legacyModels) && legacyModels.length > 0
        ? legacyModels.map((model) => ({
            modelId: model.modelId ?? uuid(),
            config: normalizeConfig(model.config),
        })).slice(0, getMaximumModels(unit))
        : makeModels(unit, config)
    while (models.length < getMinimumModels(unit)) {
        models.push(makeModel())
    }
    const normalized: ArmyUnit = {
        instanceId: entry.instanceId,
        unitId,
        config: cloneConfig(config),
        models,
        totalPoints: 0,
        attachedUnits: entry.attachedUnits?.flatMap((attachment) => {
            const normalizedAttachment = normalizeArmyUnit(attachment, units)
            return normalizedAttachment ? [normalizedAttachment] : []
        }),
        battlefleetInstanceId: typeof entry.battlefleetInstanceId === 'string' ? entry.battlefleetInstanceId : null,
    }
    normalized.totalPoints = computeArmyUnitTotal(normalized, units)
    return normalized
}

function normalizeBattlefleets(list: ArmyList, definitions: BattlefleetDefinition[]): ArmyBattlefleet[] {
    const factionId = normalizeFactionId(list.faction_id)
    const validDefinitionIds = new Set(definitions.filter((definition) => definition.faction_id === factionId).map((definition) => definition.id))
    return (list.battlefleets ?? []).flatMap((battlefleet) => {
        if (!validDefinitionIds.has(battlefleet.definitionId)) return []
        return [{
            instanceId: battlefleet.instanceId ?? uuid(),
            definitionId: battlefleet.definitionId,
            name: battlefleet.name || definitions.find((definition) => definition.id === battlefleet.definitionId)?.name || battlefleet.definitionId,
        }]
    })
}

function isUnitIndexManifest(value: unknown): value is { files: string[] } {
    return (
        typeof value === 'object'
        && value !== null
        && Array.isArray((value as { files?: unknown }).files)
        && (value as { files: unknown[] }).files.every((file) => typeof file === 'string')
    )
}

async function loadUnitsFromIndex(unitsIndex: unknown): Promise<Unit[]> {
    if (Array.isArray(unitsIndex)) return unitsIndex as Unit[]
    if (!isUnitIndexManifest(unitsIndex)) return []

    const responses = await Promise.all(unitsIndex.files.map((file) => fetch(`/data/${file}`)))
    const groups = await Promise.all(responses.map((response) => response.json() as Promise<Unit[]>))
    return groups.flat()
}

function normalizeLists(lists: ArmyList[], units: Unit[], definitions: BattlefleetDefinition[]): ArmyList[] {
    return lists.map((list) => ({
        ...list,
        faction_id: normalizeFactionId(list.faction_id),
        battlefleets: normalizeBattlefleets(list, definitions),
        units: list.units.flatMap((entry) => {
            const normalizedEntry = normalizeArmyUnit(entry, units)
            return normalizedEntry ? [normalizedEntry] : []
        }),
    }))
}

function findArmyUnit(entries: ArmyUnit[], instanceId: string): ArmyUnit | null {
    for (const entry of entries) {
        if (entry.instanceId === instanceId) return entry
        const nested = findArmyUnit(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

function findParentOfAttachment(entries: ArmyUnit[], instanceId: string): ArmyUnit | null {
    for (const entry of entries) {
        if ((entry.attachedUnits ?? []).some((attachment) => attachment.instanceId === instanceId)) return entry
        const nested = findParentOfAttachment(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

function removeArmyUnit(entries: ArmyUnit[], instanceId: string, units: Unit[]): ArmyUnit[] {
    return entries
        .filter((entry) => entry.instanceId !== instanceId)
        .map((entry) => {
            const updated = {
                ...entry,
                attachedUnits: removeArmyUnit(entry.attachedUnits ?? [], instanceId, units),
            }
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units),
            }
        })
}

function attachArmyUnit(entries: ArmyUnit[], parentInstanceId: string, attachment: ArmyUnit, units: Unit[]): ArmyUnit[] {
    return entries.map((entry) => {
        if (entry.instanceId === parentInstanceId) {
            const updated = {
                ...entry,
                attachedUnits: [...(entry.attachedUnits ?? []), attachment],
            }
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units),
            }
        }
        const updated = {
            ...entry,
            attachedUnits: attachArmyUnit(entry.attachedUnits ?? [], parentInstanceId, attachment, units),
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, units),
        }
    })
}

function updateArmyUnitModels(entries: ArmyUnit[], instanceId: string, units: Unit[], updater: (entry: ArmyUnit, unit: Unit) => ArmyUnit): ArmyUnit[] {
    return entries.map((entry) => {
        const unit = units.find((item) => item.id === entry.unitId)
        if (entry.instanceId === instanceId && unit) {
            const updated = updater(entry, unit)
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units),
            }
        }
        const updated = {
            ...entry,
            attachedUnits: updateArmyUnitModels(entry.attachedUnits ?? [], instanceId, units, updater),
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, units),
        }
    })
}

export const useAppStore = create<AppStore>((set, get) => ({
    factions: [],
    units: [],
    glossary: null,
    generators: {},
    fleetDoctrines: {},
    battlefleetDefinitions: [],
    dataLoaded: false,
    loadData: async () => {
        try {
            const [factionsRes, glossaryRes, generatorsRes, fleetDoctrinesRes, battlefleetsRes, unitsRes] = await Promise.all([
                fetch('/data/factions.json'),
                fetch('/data/glossary.json'),
                fetch('/data/generators.json'),
                fetch('/data/fleet-doctrines.json'),
                fetch('/data/battlefleets.json'),
                fetch('/data/units-index.json'),
            ])
            const [factions, glossary, generators, fleetDoctrines, battlefleetDefinitions, units] = await Promise.all([
                factionsRes.json(),
                glossaryRes.json(),
                generatorsRes.json(),
                fleetDoctrinesRes.json(),
                battlefleetsRes.json(),
                unitsRes.json().then(loadUnitsFromIndex),
            ])
            const savedLists = normalizeLists(loadListsFromStorage(), units, battlefleetDefinitions)
            set({ factions, glossary, generators, fleetDoctrines, battlefleetDefinitions, units, dataLoaded: true, savedLists })
        } catch {
            set({ dataLoaded: true, savedLists: loadListsFromStorage() })
        }
    },

    selectedFactionId: null,
    setSelectedFactionId: (id) => set({ selectedFactionId: id, searchQuery: '', selectedRoles: [], selectedUnitId: null, selectedListInstanceId: null, selectedBattlefleetInstanceId: null, selectedModelId: null }),

    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    selectedRoles: [],
    toggleRoleFilter: (role) =>
        set((state) => ({
            selectedRoles: state.selectedRoles.includes(role)
                ? state.selectedRoles.filter((item) => item !== role)
                : [...state.selectedRoles, role],
        })),

    selectedUnitId: null,
    setSelectedUnitId: (id) => set({ selectedUnitId: id, selectedListInstanceId: null, selectedBattlefleetInstanceId: null, selectedModelId: null, activeUnitConfig: cloneConfig(emptyUnitConfig) }),
    selectedListInstanceId: null,
    setSelectedListInstanceId: (id) => set({ selectedListInstanceId: id }),
    selectedBattlefleetInstanceId: null,
    selectBattlefleet: (instanceId) => set({
        selectedBattlefleetInstanceId: instanceId,
        selectedUnitId: null,
        selectedListInstanceId: null,
        selectedModelId: null,
        activeUnitConfig: cloneConfig(emptyUnitConfig),
    }),
    selectedModelId: null,

    currentList: null,
    savedLists: [],
    activeUnitConfig: emptyUnitConfig,

    createList: (name, factionId) => {
        const now = new Date().toISOString()
        const battlefleets = makeDefaultBattlefleets(factionId, get().battlefleetDefinitions)
        const newList: ArmyList = {
            id: uuid(),
            name,
            faction_id: factionId,
            battlefleets,
            units: [],
            createdAt: now,
            updatedAt: now,
        }
        set((state) => ({
            savedLists: [...state.savedLists, newList],
            currentList: newList,
            selectedFactionId: factionId,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }))
        get().persistLists()
    },
    openList: (listId) => {
        const target = get().savedLists.find((list) => list.id === listId)
        if (!target) return
        set({
            currentList: structuredClone(target),
            selectedFactionId: target.faction_id,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        })
    },
    closeList: () => {
        get().persistLists()
        set({
            currentList: null,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        })
    },
    deleteList: (listId) => {
        const currentList = get().currentList
        const deletingCurrentList = currentList?.id === listId
        set((state) => ({
            savedLists: state.savedLists.filter((list) => list.id !== listId),
            currentList: deletingCurrentList ? null : currentList,
            selectedUnitId: deletingCurrentList ? null : state.selectedUnitId,
            selectedListInstanceId: deletingCurrentList ? null : state.selectedListInstanceId,
            selectedBattlefleetInstanceId: deletingCurrentList ? null : state.selectedBattlefleetInstanceId,
            selectedModelId: deletingCurrentList ? null : state.selectedModelId,
            activeUnitConfig: deletingCurrentList ? cloneConfig(emptyUnitConfig) : state.activeUnitConfig,
        }))
        get().persistLists()
    },
    importList: (list) => {
        set((state) => ({
            savedLists: [...state.savedLists.filter((item) => item.id !== list.id), list],
            currentList: list,
            selectedFactionId: list.faction_id,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }))
        get().persistLists()
    },
    renameList: (listId, newName) => {
        const trimmed = newName.trim()
        if (!trimmed) return
        set((state) => {
            const now = new Date().toISOString()
            const currentList = state.currentList?.id === listId
                ? { ...state.currentList, name: trimmed, updatedAt: now }
                : state.currentList
            return {
                currentList,
                savedLists: state.savedLists.map((list) => (
                    list.id === listId ? { ...(currentList ?? list), name: trimmed, updatedAt: now } : list
                )),
            }
        })
        get().persistLists()
    },
    persistLists: () => {
        const { savedLists, currentList } = get()
        const lists = currentList
            ? savedLists.map((list) => (list.id === currentList.id ? currentList : list))
            : savedLists
        saveListsToStorage(lists)
        set({ savedLists: lists })
    },

    addUnitToCurrentList: (unitId) => {
        const state = get()
        if (!state.currentList) return
        const unit = state.units.find((item) => item.id === unitId)
        if (!unit) return
        const config = unitId === state.selectedUnitId ? state.activeUnitConfig : emptyUnitConfig
        const onlyBattlefleet = state.currentList.battlefleets?.length === 1 ? state.currentList.battlefleets[0] : null
        const newEntry = makeArmyUnit(unit, config, onlyBattlefleet?.instanceId ?? null)
        set({
            currentList: {
                ...state.currentList,
                units: [...state.currentList.units, newEntry],
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    addAttachmentToListUnit: (parentInstanceId, unitId) => {
        const state = get()
        if (!state.currentList) return
        const unit = state.units.find((item) => item.id === unitId)
        if (!unit) return
        const parent = findArmyUnit(state.currentList.units, parentInstanceId)
        if (!parent) return
        if (parent.unitId === unit.id) return
        const usedModels = countAttachedModels(parent.attachedUnits ?? [], unitId)
        const remainingModels = getAttachmentModelLimit(unit) - usedModels
        if (remainingModels < getMinimumModels(unit)) return
        const config = unitId === state.selectedUnitId ? state.activeUnitConfig : emptyUnitConfig
        const attachment = makeArmyUnit(unit, config, parent.battlefleetInstanceId ?? null)
        attachment.models = attachment.models.slice(0, remainingModels)
        attachment.totalPoints = computeArmyUnitTotal(attachment, state.units)
        set({
            currentList: {
                ...state.currentList,
                units: attachArmyUnit(state.currentList.units, parentInstanceId, attachment, state.units),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    addBattlefleetToCurrentList: (definitionId) => {
        const state = get()
        if (!state.currentList) return
        const definition = state.battlefleetDefinitions.find((item) => item.id === definitionId && item.faction_id === state.currentList?.faction_id)
        if (!definition) return
        const battlefleets = [...(state.currentList.battlefleets ?? [])]
        if (definition.legendary && battlefleets.some((battlefleet) => battlefleet.definitionId === definition.id)) return
        const newBattlefleet = makeBattlefleet(definition, battlefleets)
        set({
            currentList: {
                ...state.currentList,
                battlefleets: [...battlefleets, newBattlefleet],
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    removeBattlefleetFromCurrentList: (battlefleetInstanceId) => {
        const state = get()
        if (!state.currentList) return
        set({
            currentList: {
                ...state.currentList,
                battlefleets: (state.currentList.battlefleets ?? []).filter((battlefleet) => battlefleet.instanceId !== battlefleetInstanceId),
                units: state.currentList.units.map((entry) => ({
                    ...entry,
                    battlefleetInstanceId: entry.battlefleetInstanceId === battlefleetInstanceId ? null : entry.battlefleetInstanceId,
                    attachedUnits: entry.attachedUnits?.map((attachment) => ({
                        ...attachment,
                        battlefleetInstanceId: attachment.battlefleetInstanceId === battlefleetInstanceId ? null : attachment.battlefleetInstanceId,
                    })),
                })),
                updatedAt: new Date().toISOString(),
            },
            selectedBattlefleetInstanceId: state.selectedBattlefleetInstanceId === battlefleetInstanceId ? null : state.selectedBattlefleetInstanceId,
        })
        get().persistLists()
    },
    setUnitBattlefleet: (instanceId, battlefleetInstanceId) => {
        const state = get()
        if (!state.currentList) return
        const battlefleetExists = battlefleetInstanceId == null || (state.currentList.battlefleets ?? []).some((battlefleet) => battlefleet.instanceId === battlefleetInstanceId)
        if (!battlefleetExists) return
        set({
            currentList: {
                ...state.currentList,
                units: updateArmyUnitModels(state.currentList.units, instanceId, state.units, (entry) => ({
                    ...entry,
                    battlefleetInstanceId,
                    attachedUnits: entry.attachedUnits?.map((attachment) => ({
                        ...attachment,
                        battlefleetInstanceId,
                    })),
                })),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    removeUnitFromList: (instanceId) => {
        const currentList = get().currentList
        if (!currentList) return
        set({
            currentList: {
                ...currentList,
                units: removeArmyUnit(currentList.units, instanceId, get().units),
                updatedAt: new Date().toISOString(),
            },
            selectedListInstanceId: get().selectedListInstanceId === instanceId ? null : get().selectedListInstanceId,
            selectedBattlefleetInstanceId: get().selectedListInstanceId === instanceId ? null : get().selectedBattlefleetInstanceId,
            selectedModelId: get().selectedListInstanceId === instanceId ? null : get().selectedModelId,
        })
        get().persistLists()
    },
    selectListUnit: (instanceId) => {
        const state = get()
        const entry = state.currentList ? findArmyUnit(state.currentList.units, instanceId) : null
        if (!entry) return
        const selectedModel = entry.models[0] ?? makeModel(entry.config)
        set({
            selectedUnitId: entry.unitId,
            selectedListInstanceId: instanceId,
            selectedBattlefleetInstanceId: null,
            selectedModelId: selectedModel.modelId,
            activeUnitConfig: cloneConfig(selectedModel.config),
        })
    },
    selectModel: (modelId) => {
        const state = get()
        const entry = state.currentList && state.selectedListInstanceId ? findArmyUnit(state.currentList.units, state.selectedListInstanceId) : null
        const model = entry?.models.find((item) => item.modelId === modelId)
        if (!model) return
        set({ selectedModelId: modelId, activeUnitConfig: cloneConfig(model.config) })
    },
    addModelToListUnit: (instanceId) => {
        const state = get()
        if (!state.currentList) return
        const entry = findArmyUnit(state.currentList.units, instanceId)
        const unit = entry ? state.units.find((item) => item.id === entry.unitId) : null
        if (!entry || !unit) return
        const parent = findParentOfAttachment(state.currentList.units, instanceId)
        const siblingModels = parent
            ? (parent.attachedUnits ?? [])
                .filter((attachment) => attachment.unitId === unit.id && attachment.instanceId !== instanceId)
                .reduce((sum, attachment) => sum + attachment.models.length, 0)
            : 0
        const maxModels = parent ? getAttachmentModelLimit(unit) - siblingModels : getMaximumModels(unit)
        if (entry.models.length >= maxModels) return
        const newModel = makeModel()
        const currentList = {
            ...state.currentList,
            units: updateArmyUnitModels(state.currentList.units, instanceId, state.units, (target) => ({
                ...target,
                models: [...target.models, newModel],
            })),
            updatedAt: new Date().toISOString(),
        }
        set({
            currentList,
            selectedModelId: newModel.modelId,
            activeUnitConfig: cloneConfig(newModel.config),
        })
        get().persistLists()
    },
    removeModelFromListUnit: (instanceId, modelId) => {
        const state = get()
        if (!state.currentList) return
        const entry = findArmyUnit(state.currentList.units, instanceId)
        const unit = entry ? state.units.find((item) => item.id === entry.unitId) : null
        if (!entry || !unit) return
        const minModels = getMinimumModels(unit)
        if (entry.models.length <= minModels) return
        const nextModels = entry.models.filter((model) => model.modelId !== modelId)
        const selectedModel = nextModels[0] ?? null
        const currentList = {
            ...state.currentList,
            units: updateArmyUnitModels(state.currentList.units, instanceId, state.units, (target) => ({
                ...target,
                models: target.models.filter((model) => model.modelId !== modelId),
            })),
            updatedAt: new Date().toISOString(),
        }
        set({
            currentList,
            selectedModelId: state.selectedModelId === modelId ? selectedModel?.modelId ?? null : state.selectedModelId,
            activeUnitConfig: state.selectedModelId === modelId && selectedModel ? cloneConfig(selectedModel.config) : state.activeUnitConfig,
        })
        get().persistLists()
    },

    setHardpointSelection: (weaponIndex, weaponName) => {
        set((state) => {
            const newConfig = {
                ...state.activeUnitConfig,
                hardpointSelections: {
                    ...state.activeUnitConfig.hardpointSelections,
                    [weaponIndex]: weaponName,
                },
                generatorSelection: state.activeUnitConfig.generatorSelection?.weaponIndex === weaponIndex
                    ? null
                    : state.activeUnitConfig.generatorSelection,
            }
            return {
                activeUnitConfig: newConfig,
                currentList: state.selectedListInstanceId && state.currentList
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units, state.selectedModelId ?? undefined)
                    : state.currentList,
            }
        })
        get().persistLists()
    },
    setGeneratorSelection: (selection) => {
        set((state) => {
            const hardpointSelections = { ...state.activeUnitConfig.hardpointSelections }
            if (selection) delete hardpointSelections[selection.weaponIndex]
            const newConfig = { ...state.activeUnitConfig, generatorSelection: selection, hardpointSelections }
            return {
                activeUnitConfig: newConfig,
                currentList: state.selectedListInstanceId && state.currentList
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units, state.selectedModelId ?? undefined)
                    : state.currentList,
            }
        })
        get().persistLists()
    },
    setFleetDoctrineSelection: (selection) => {
        set((state) => {
            if (!state.selectedListInstanceId || !state.currentList) return state
            const entry = findArmyUnit(state.currentList.units, state.selectedListInstanceId)
            if (!entry) return state
            const unitConfig = {
                ...entry.config,
                fleetDoctrineSelection: selection,
            }
            return {
                currentList: updateListUnit(state.currentList, state.selectedListInstanceId, unitConfig, state.units),
            }
        })
        get().persistLists()
    },
    setOptionQuantity: (tag, quantity) => {
        set((state) => {
            if (state.selectedListInstanceId && state.currentList && isUnitLevelOption(tag)) {
                const entry = findArmyUnit(state.currentList.units, state.selectedListInstanceId)
                if (!entry) return state
                const unitConfig = {
                    ...entry.config,
                    optionQuantities: {
                        ...entry.config.optionQuantities,
                        [tag]: Math.max(0, quantity),
                    },
                }
                return {
                    currentList: updateListUnit(state.currentList, state.selectedListInstanceId, unitConfig, state.units),
                }
            }
            const newConfig = {
                ...state.activeUnitConfig,
                optionQuantities: {
                    ...state.activeUnitConfig.optionQuantities,
                    [tag]: Math.max(0, quantity),
                },
            }
            return {
                activeUnitConfig: newConfig,
                currentList: state.selectedListInstanceId && state.currentList
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units, state.selectedModelId ?? undefined)
                    : state.currentList,
            }
        })
        get().persistLists()
    },
}))
