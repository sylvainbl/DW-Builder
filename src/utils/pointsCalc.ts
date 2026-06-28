import type { ArmyList, ArmyUnit, Unit, UnitConfig } from '../types/index'

export function computeTotalPoints(unit: Unit, config: UnitConfig): number {
    let total = unit.point_cost_per_model ?? 0

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

export function computeArmyUnitTotal(entry: ArmyUnit, allUnits: Unit[]): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownTotal = unit ? computeTotalPoints(unit, entry.config) : entry.totalPoints
    const attachmentsTotal = (entry.attachedUnits ?? [])
        .reduce((sum, attachment) => sum + computeArmyUnitTotal(attachment, allUnits), 0)
    return ownTotal + attachmentsTotal
}

function updateEntry(entry: ArmyUnit, instanceId: string, newConfig: UnitConfig, allUnits: Unit[]): ArmyUnit {
    if (entry.instanceId === instanceId) {
        const updated = {
            ...entry,
            config: structuredClone(newConfig),
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, allUnits),
        }
    }

    const attachedUnits = entry.attachedUnits?.map((attachment) => updateEntry(attachment, instanceId, newConfig, allUnits))
    const updated = attachedUnits ? { ...entry, attachedUnits } : entry
    return {
        ...updated,
        totalPoints: computeArmyUnitTotal(updated, allUnits),
    }
}

export function updateListUnit(list: ArmyList, instanceId: string, newConfig: UnitConfig, allUnits: Unit[]): ArmyList {
    return {
        ...list,
        units: list.units.map((entry) => updateEntry(entry, instanceId, newConfig, allUnits)),
        updatedAt: new Date().toISOString(),
    }
}
