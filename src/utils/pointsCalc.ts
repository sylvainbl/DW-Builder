import type { ArmyList, Unit, UnitConfig } from '../types/index'

export function computeTotalPoints(unit: Unit, config: UnitConfig): number {
    let total = unit.point_cost_per_model

    if (config.generatorSelection) {
        total += config.generatorSelection.generatorCost
    }

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || option.tag === 'GENERATOR') continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += quantity * option.cost_per_unit
    }

    return total
}

export function updateListUnit(list: ArmyList, instanceId: string, newConfig: UnitConfig, allUnits: Unit[]): ArmyList {
    return {
        ...list,
        units: list.units.map((entry) => {
            if (entry.instanceId !== instanceId) return entry
            const unit = allUnits.find((item) => item.id === entry.unitId)
            return {
                ...entry,
                config: structuredClone(newConfig),
                totalPoints: unit ? computeTotalPoints(unit, newConfig) : entry.totalPoints,
            }
        }),
        updatedAt: new Date().toISOString(),
    }
}
