import { create } from 'zustand'
import type { ArmyList, ArmyUnit, Faction, Generator, Unit } from '../types/index'
import { loadSavedLists, saveList, deleteList as deleteSavedList } from '../utils/localStorage'
import { uuid } from '../utils/uuid'

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

    currentList: ArmyList | null
    createNewList: (factionId: string, name: string) => void
    addUnitToList: (unitId: string) => void
    removeUnitFromList: (instanceId: string) => void
    updateUnitQuantity: (instanceId: string, qty: number) => void
    setHardpoint: (instanceId: string, slot: string, weaponName: string) => void
    setOption: (instanceId: string, tag: string, quantity: number) => void

    savedLists: ArmyList[]
    saveCurrentList: () => void
    loadList: (listId: string) => void
    deleteList: (listId: string) => void
}

function initialHardpoints(unit: Unit) {
    return unit.weapons
        .filter((weapon) => typeof weapon.slot === 'string')
        .map((weapon) => ({ slot: weapon.slot as string, weaponName: weapon.name }))
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
            set({ factions, glossary, generators, units, dataLoaded: true, savedLists: loadSavedLists() })
        } catch {
            set({ dataLoaded: true, savedLists: loadSavedLists() })
        }
    },

    selectedFactionId: null,
    setSelectedFactionId: (id) => set({ selectedFactionId: id, searchQuery: '', selectedRoles: [], selectedUnitId: null }),

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
    setSelectedUnitId: (id) => set({ selectedUnitId: id }),

    currentList: null,
    createNewList: (factionId, name) => {
        const list: ArmyList = {
            id: uuid(),
            name,
            faction_id: factionId,
            units: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }
        set({ currentList: list })
    },

    addUnitToList: (unitId) => {
        const unit = get().units.find((item) => item.id === unitId)
        if (!unit) return
        const currentList = get().currentList
        if (!currentList) return

        const newUnit: ArmyUnit = {
            instanceId: uuid(),
            unitId,
            quantity: 1,
            hardpoints: initialHardpoints(unit),
            options: unit.options_and_upgrades.map((option) => ({ tag: option.tag, quantity: 0 })),
        }

        set({ currentList: { ...currentList, units: [...currentList.units, newUnit], updatedAt: new Date().toISOString() } })
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
        })
    },

    updateUnitQuantity: (instanceId, qty) => {
        const currentList = get().currentList
        if (!currentList) return
        set({
            currentList: {
                ...currentList,
                units: currentList.units.map((unit) =>
                    unit.instanceId === instanceId
                        ? { ...unit, quantity: Math.max(1, qty) }
                        : unit,
                ),
                updatedAt: new Date().toISOString(),
            },
        })
    },

    setHardpoint: (instanceId, slot, weaponName) => {
        const currentList = get().currentList
        if (!currentList) return
        set({
            currentList: {
                ...currentList,
                units: currentList.units.map((unit) =>
                    unit.instanceId === instanceId
                        ? {
                            ...unit,
                            hardpoints: unit.hardpoints.map((hardpoint) =>
                                hardpoint.slot === slot
                                    ? { ...hardpoint, weaponName }
                                    : hardpoint,
                            ),
                        }
                        : unit,
                ),
                updatedAt: new Date().toISOString(),
            },
        })
    },

    setOption: (instanceId, tag, quantity) => {
        const currentList = get().currentList
        if (!currentList) return
        set({
            currentList: {
                ...currentList,
                units: currentList.units.map((unit) =>
                    unit.instanceId === instanceId
                        ? {
                            ...unit,
                            options: unit.options.map((option) =>
                                option.tag === tag ? { ...option, quantity } : option,
                            ),
                        }
                        : unit,
                ),
                updatedAt: new Date().toISOString(),
            },
        })
    },

    savedLists: loadSavedLists(),
    saveCurrentList: () => {
        const currentList = get().currentList
        if (!currentList) return
        saveList(currentList)
        set({ savedLists: loadSavedLists() })
    },
    loadList: (listId) => {
        const savedLists = loadSavedLists()
        const target = savedLists.find((list) => list.id === listId)
        if (!target) return
        set({ currentList: target })
    },
    deleteList: (listId) => {
        deleteSavedList(listId)
        set({ savedLists: loadSavedLists() })
    },
}))
