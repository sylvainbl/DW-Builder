import { create } from 'zustand'
import type { ArmyList, ArmyModel, ArmyUnit, Faction, FleetDoctrine, Generator, Unit, UnitConfig } from '../types/index'
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

function makeArmyUnit(unit: Unit, config: UnitConfig = emptyUnitConfig): ArmyUnit {
    const entry: ArmyUnit = {
        instanceId: uuid(),
        unitId: unit.id,
        config: cloneConfig(emptyUnitConfig),
        models: makeModels(unit, config),
        totalPoints: 0,
    }
    entry.totalPoints = computeArmyUnitTotal(entry, [unit])
    return entry
}

function getAttachmentModelLimit(unit: Unit): number {
    return unit.attachment?.max_models ?? getMaximumModels(unit)
}

function countAttachedModels(entries: ArmyUnit[], unitId: string): number {
    return entries.reduce((sum, entry) => sum + (entry.unitId === unitId ? entry.models.length : 0), 0)
}

function normalizeArmyUnit(entry: ArmyUnit, units: Unit[]): ArmyUnit | null {
    const unit = units.find((item) => item.id === entry.unitId)
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
        unitId: entry.unitId,
        config: cloneConfig(config),
        models,
        totalPoints: 0,
        attachedUnits: entry.attachedUnits?.flatMap((attachment) => {
            const normalizedAttachment = normalizeArmyUnit(attachment, units)
            return normalizedAttachment ? [normalizedAttachment] : []
        }),
    }
    normalized.totalPoints = computeArmyUnitTotal(normalized, units)
    return normalized
}

function normalizeLists(lists: ArmyList[], units: Unit[]): ArmyList[] {
    return lists.map((list) => ({
        ...list,
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
    dataLoaded: false,
    loadData: async () => {
        try {
            const [factionsRes, glossaryRes, generatorsRes, fleetDoctrinesRes, unitsRes] = await Promise.all([
                fetch('/data/factions.json'),
                fetch('/data/glossary.json'),
                fetch('/data/generators.json'),
                fetch('/data/fleet-doctrines.json'),
                fetch('/data/units-index.json'),
            ])
            const [factions, glossary, generators, fleetDoctrines, units] = await Promise.all([
                factionsRes.json(),
                glossaryRes.json(),
                generatorsRes.json(),
                fleetDoctrinesRes.json(),
                unitsRes.json(),
            ])
            const savedLists = normalizeLists(loadListsFromStorage(), units)
            set({ factions, glossary, generators, fleetDoctrines, units, dataLoaded: true, savedLists })
        } catch {
            set({ dataLoaded: true, savedLists: loadListsFromStorage() })
        }
    },

    selectedFactionId: null,
    setSelectedFactionId: (id) => set({ selectedFactionId: id, searchQuery: '', selectedRoles: [], selectedUnitId: null, selectedListInstanceId: null, selectedModelId: null }),

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
    setSelectedUnitId: (id) => set({ selectedUnitId: id, selectedListInstanceId: null, selectedModelId: null, activeUnitConfig: cloneConfig(emptyUnitConfig) }),
    selectedListInstanceId: null,
    setSelectedListInstanceId: (id) => set({ selectedListInstanceId: id }),
    selectedModelId: null,

    currentList: null,
    savedLists: [],
    activeUnitConfig: emptyUnitConfig,

    createList: (name, factionId) => {
        const now = new Date().toISOString()
        const newList: ArmyList = {
            id: uuid(),
            name,
            faction_id: factionId,
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
        const newEntry = makeArmyUnit(unit, config)
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
        const attachment = makeArmyUnit(unit, config)
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
