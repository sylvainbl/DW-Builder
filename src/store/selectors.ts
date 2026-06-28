import type { Generator, Unit } from '../types/index'

export function getGeneratorsForFaction(generators: Record<string, Generator[]>, factionId: string): Generator[] {
    return generators[factionId] ?? []
}

export function getFilteredUnits(
    store: {
        units: Unit[]
        selectedFactionId: string | null
        searchQuery: string
        selectedRoles: string[]
    },
): Unit[] {
    const query = store.searchQuery.trim().toLowerCase()
    return store.units.filter((unit) => {
        if (store.selectedFactionId && unit.faction_id !== store.selectedFactionId) {
            return false
        }

        const textMatch = [unit.name, unit.sub_name, ...unit.tags]
            .some((part) => part.toLowerCase().includes(query))

        const roleMatch =
            store.selectedRoles.length === 0 || store.selectedRoles.includes(unit.role)

        return query.length === 0 ? roleMatch : textMatch && roleMatch
    })
}
