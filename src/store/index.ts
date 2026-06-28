import { create } from 'zustand'
import type { ArmyList, ArmyUnit, Faction, Generator, Unit, UnitConfig } from '../types/index'
import { loadListsFromStorage, saveListsToStorage } from '../utils/localStorage'
import { computeArmyUnitTotal, computeTotalPoints, updateListUnit } from '../utils/pointsCalc'
import { uuid } from '../utils/uuid'

const emptyUnitConfig: UnitConfig = {
    hardpointSelections: {},
    generatorSelection: null,
    optionQuantities: {},
}

interface AppStore {
    factions: Faction[]
    units: Unit[]
    glossary: Record<string, Record<string, string>> | null
    generators: Record<string, Generator[]>
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

    setHardpointSelection: (weaponIndex: number, weaponName: string) => void
    setGeneratorSelection: (selection: UnitConfig['generatorSelection']) => void
    setOptionQuantity: (tag: string, quantity: number) => void
    resetActiveUnitConfig: () => void
}

function cloneConfig(config: UnitConfig): UnitConfig {
    return structuredClone(config)
}

function makeArmyUnit(unit: Unit, config: UnitConfig = emptyUnitConfig): ArmyUnit {
    const entry: ArmyUnit = {
        instanceId: uuid(),
        unitId: unit.id,
        config: cloneConfig(config),
        totalPoints: computeTotalPoints(unit, config),
    }
    return entry
}

function normalizeArmyUnit(entry: ArmyUnit, units: Unit[]): ArmyUnit | null {
    const unit = units.find((item) => item.id === entry.unitId)
    if (!unit) return null
    const legacy = entry as ArmyUnit & {
        hardpoints?: { slot: string; weaponName: string }[]
        options?: { tag: string; quantity: number }[]
        generator?: Generator | null
    }
    const config: UnitConfig = entry.config ?? {
        hardpointSelections: {},
        generatorSelection: legacy.generator
            ? { weaponIndex: 0, generatorName: legacy.generator.name, generatorCost: legacy.generator.point_cost }
            : null,
        optionQuantities: Object.fromEntries((legacy.options ?? []).map((option) => [option.tag, option.quantity])),
    }
    const normalized: ArmyUnit = {
        instanceId: entry.instanceId,
        unitId: entry.unitId,
        config,
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

export const useAppStore = create<AppStore>((set, get) => ({
    factions: [],
    units: [],
    glossary: null,
    generators: {},
    dataLoaded: false,
    loadData: async () => {
        try {
            const [factionsRes, glossaryRes, generatorsRes, unitsRes] = await Promise.all([
                fetch('/data/factions.json'),
                fetch('/data/glossary.json'),
                fetch('/data/generators.json'),
                fetch('/data/units-index.json'),
            ])
            const [factions, glossary, generators, units] = await Promise.all([
                factionsRes.json(),
                glossaryRes.json(),
                generatorsRes.json(),
                unitsRes.json(),
            ])
            const savedLists = normalizeLists(loadListsFromStorage(), units)
            set({ factions, glossary, generators, units, dataLoaded: true, savedLists })
        } catch {
            set({ dataLoaded: true, savedLists: loadListsFromStorage() })
        }
    },

    selectedFactionId: null,
    setSelectedFactionId: (id) => set({ selectedFactionId: id, searchQuery: '', selectedRoles: [], selectedUnitId: null, selectedListInstanceId: null }),

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
    setSelectedUnitId: (id) => set({ selectedUnitId: id, selectedListInstanceId: null, activeUnitConfig: cloneConfig(emptyUnitConfig) }),
    selectedListInstanceId: null,
    setSelectedListInstanceId: (id) => set({ selectedListInstanceId: id }),

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
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        })
    },
    closeList: () => {
        get().persistLists()
        set({ currentList: null, selectedListInstanceId: null })
    },
    deleteList: (listId) => {
        const currentList = get().currentList
        set((state) => ({
            savedLists: state.savedLists.filter((list) => list.id !== listId),
            currentList: currentList?.id === listId ? null : currentList,
            selectedListInstanceId: currentList?.id === listId ? null : state.selectedListInstanceId,
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
        const config = unitId === state.selectedUnitId ? state.activeUnitConfig : emptyUnitConfig
        const attachment = makeArmyUnit(unit, config)
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
        })
        get().persistLists()
    },
    selectListUnit: (instanceId) => {
        const state = get()
        const entry = state.currentList ? findArmyUnit(state.currentList.units, instanceId) : null
        if (!entry) return
        set({
            selectedUnitId: entry.unitId,
            selectedListInstanceId: instanceId,
            activeUnitConfig: cloneConfig(entry.config),
        })
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
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units)
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
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units)
                    : state.currentList,
            }
        })
        get().persistLists()
    },
    setOptionQuantity: (tag, quantity) => {
        set((state) => {
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
                    ? updateListUnit(state.currentList, state.selectedListInstanceId, newConfig, state.units)
                    : state.currentList,
            }
        })
        get().persistLists()
    },
    resetActiveUnitConfig: () => set({ activeUnitConfig: cloneConfig(emptyUnitConfig) }),
}))
