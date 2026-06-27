import type { ArmyList, ArmyUnit, Glossary, Unit } from '../types/index'

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

export function resolveArmyUnit(
    armyUnit: ArmyUnit,
    units: Unit[],
): { unit: Unit; totalPoints: number } | null {
    const unit = units.find((item) => item.id === armyUnit.unitId)
    if (!unit) {
        return null
    }

    const basePoints = unit.point_cost_per_model * armyUnit.quantity
    const optionsPoints = armyUnit.options.reduce((sum, option) => {
        const optionDef = unit.options_and_upgrades.find((item) => item.tag === option.tag)
        if (!optionDef || optionDef.cost_per_unit === null) {
            return sum
        }
        return sum + option.quantity * optionDef.cost_per_unit
    }, 0)

    return { unit, totalPoints: basePoints + optionsPoints }
}

export function getTotalPoints(store: { currentList: ArmyList | null; units: Unit[] }) {
    if (!store.currentList) {
        return 0
    }
    return store.currentList.units.reduce((sum, armyUnit) => {
        const resolved = resolveArmyUnit(armyUnit, store.units)
        return sum + (resolved?.totalPoints ?? 0)
    }, 0)
}

export function getTotalVPR(store: { currentList: ArmyList | null; units: Unit[] }) {
    if (!store.currentList) {
        return 0
    }
    return store.currentList.units.reduce((sum, armyUnit) => {
        const unit = store.units.find((item) => item.id === armyUnit.unitId)
        if (!unit) {
            return sum
        }
        return sum + unit.vpr * armyUnit.quantity
    }, 0)
}

export function getActiveRules(
    currentList: ArmyList,
    units: Unit[],
    glossary: Glossary,
): { category: 'properties' | 'systems' | 'qualities'; name: string; entry: { summary: string; full: string } }[] {
    const rulesMap = new Map<string, { category: 'properties' | 'systems' | 'qualities'; name: string; entry: { summary: string; full: string } }>()

    currentList.units.forEach((armyUnit) => {
        const unit = units.find((item) => item.id === armyUnit.unitId)
        if (!unit) {
            return
        }

        unit.properties.forEach((property) => {
            const entry = glossary.properties[property.name]
            if (entry) {
                rulesMap.set(`${property.name}|properties`, {
                    category: 'properties',
                    name: property.name,
                    entry,
                })
            }
        })
        unit.systems.forEach((system) => {
            const entry = glossary.systems[system.name]
            if (entry) {
                rulesMap.set(`${system.name}|systems`, {
                    category: 'systems',
                    name: system.name,
                    entry,
                })
            }
        })
        unit.weapons.forEach((weapon) => {
            weapon.qualities.forEach((quality) => {
                const entry = glossary.qualities[quality.name]
                if (entry) {
                    rulesMap.set(`${quality.name}|qualities`, {
                        category: 'qualities',
                        name: quality.name,
                        entry,
                    })
                }
            })
        })
    })

    return Array.from(rulesMap.values())
}
