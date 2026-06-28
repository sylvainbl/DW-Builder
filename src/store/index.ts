import { create } from 'zustand'
import type { ArmyList, ArmyUnit, Faction, Generator, Unit, UnitConfig } from '../types/index'
import { loadListsFromStorage, saveListsToStorage } from '../utils/localStorage'
import { computeTotalPoints, updateListUnit } from '../utils/pointsCalc'
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
    renameList: (listId: string, newName: string) => void
    persistLists: () => void

    addUnitToCurrentList: (unitId: string) => void
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

function normalizeLists(lists: ArmyList[], units: Unit[]): ArmyList[] {
    return lists.map((list) => ({
        ...list,
        units: list.units.map((entry) => {
            const unit = units.find((item) => item.id === entry.unitId)
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
            return {
                instanceId: entry.instanceId,
                unitId: entry.unitId,
                config,
                totalPoints: unit ? computeTotalPoints(unit, config) : entry.totalPoints ?? 0,
            }
        }),
    }))
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
        const newEntry: ArmyUnit = {
            instanceId: uuid(),
            unitId,
            config: cloneConfig(config),
            totalPoints: computeTotalPoints(unit, config),
        }
        set({
            currentList: {
                ...state.currentList,
                units: [...state.currentList.units, newEntry],
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
                units: currentList.units.filter((unit) => unit.instanceId !== instanceId),
                updatedAt: new Date().toISOString(),
            },
            selectedListInstanceId: get().selectedListInstanceId === instanceId ? null : get().selectedListInstanceId,
        })
        get().persistLists()
    },
    selectListUnit: (instanceId) => {
        const state = get()
        const entry = state.currentList?.units.find((unit) => unit.instanceId === instanceId)
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
