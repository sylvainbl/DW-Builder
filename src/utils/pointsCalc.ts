import type { ArmyList, ArmyUnit, Unit, UnitConfig } from '../types/index'

export function isUnitLevelOption(tag: string): boolean {
    return tag === 'ESCORT'
}

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

export function computeModelPoints(unit: Unit, config: UnitConfig): number {
    let total = unit.point_cost_per_model ?? 0

    if (config.generatorSelection) {
        total += config.generatorSelection.generatorCost
    }

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || option.tag === 'GENERATOR' || isUnitLevelOption(option.tag)) continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += quantity * option.cost_per_unit
    }

    return total
}

function computeUnitLevelPoints(unit: Unit, config: UnitConfig): number {
    let total = 0

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || !isUnitLevelOption(option.tag)) continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += quantity * option.cost_per_unit
    }

    return total
}

export function computeArmyUnitTotal(entry: ArmyUnit, allUnits: Unit[]): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownTotal = unit
        ? computeUnitLevelPoints(unit, entry.config) + entry.models.reduce((sum, model) => sum + computeModelPoints(unit, model.config), 0)
        : entry.totalPoints
    const attachmentsTotal = (entry.attachedUnits ?? [])
        .reduce((sum, attachment) => sum + computeArmyUnitTotal(attachment, allUnits), 0)
    return ownTotal + attachmentsTotal
}

function updateEntry(entry: ArmyUnit, instanceId: string, newConfig: UnitConfig, allUnits: Unit[], modelId?: string): ArmyUnit {
    if (entry.instanceId === instanceId) {
        const updated = {
            ...entry,
            config: modelId ? entry.config : structuredClone(newConfig),
            models: modelId
                ? entry.models.map((model) => (
                    model.modelId === modelId ? { ...model, config: structuredClone(newConfig) } : model
                ))
                : entry.models,
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, allUnits),
        }
    }

    const attachedUnits = entry.attachedUnits?.map((attachment) => updateEntry(attachment, instanceId, newConfig, allUnits, modelId))
    const updated = attachedUnits ? { ...entry, attachedUnits } : entry
    return {
        ...updated,
        totalPoints: computeArmyUnitTotal(updated, allUnits),
    }
}

export function updateListUnit(list: ArmyList, instanceId: string, newConfig: UnitConfig, allUnits: Unit[], modelId?: string): ArmyList {
    return {
        ...list,
        units: list.units.map((entry) => updateEntry(entry, instanceId, newConfig, allUnits, modelId)),
        updatedAt: new Date().toISOString(),
    }
}
