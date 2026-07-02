import type { ArmyList, ArmyUnit, OptionUpgrade, Unit, UnitConfig } from '../types/index'
import { isUnitLevelOption } from './optionConfig'
import { getEffectiveGeneratorSelections } from './optionRuleEffects'

export { isUnitLevelOption } from './optionConfig'

const CHITA_SWARM_BATTLEFLEET_ID = 'empire-chita-swarm'
const CHITA_SWARM_FIRST_ESCORT_COST = 5

export interface PointsContext {
    battlefleets?: ArmyList['battlefleets']
}

export function hasChitaSwarmEscortDiscount(entry: ArmyUnit, context?: PointsContext): boolean {
    const battlefleet = context?.battlefleets?.find((item) => item.instanceId === entry.battlefleetInstanceId)
    return battlefleet?.definitionId === CHITA_SWARM_BATTLEFLEET_ID
}

export function computeOptionPoints(option: OptionUpgrade, quantity: number, discountFirstEscort = false): number | null {
    if (option.cost_per_unit === null) return null
    if (discountFirstEscort && option.tag === 'ESCORT' && quantity > 0) {
        return CHITA_SWARM_FIRST_ESCORT_COST + (quantity - 1) * option.cost_per_unit
    }
    return quantity * option.cost_per_unit
}

export function computeTotalPoints(unit: Unit, config: UnitConfig): number {
    let total = unit.point_cost_per_model ?? 0

    total += getEffectiveGeneratorSelections(unit, config).reduce((sum, generator) => sum + generator.generatorCost, 0)

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || option.tag === 'GENERATOR' || option.tag === 'MAGMA_CAST_GENERATOR') continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += computeOptionPoints(option, quantity) ?? 0
    }

    return total
}

export function computeModelPoints(unit: Unit, config: UnitConfig, unitConfig?: UnitConfig | null): number {
    let total = unit.point_cost_per_model ?? 0

    total += getEffectiveGeneratorSelections(unit, config, unitConfig).reduce((sum, generator) => sum + generator.generatorCost, 0)

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || option.tag === 'GENERATOR' || option.tag === 'MAGMA_CAST_GENERATOR' || isUnitLevelOption(option.tag)) continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += computeOptionPoints(option, quantity) ?? 0
    }

    return total
}

function computeUnitLevelPoints(unit: Unit, config: UnitConfig, discountFirstEscort: boolean): number {
    let total = 0

    if (config.fleetDoctrineSelection) {
        total += config.fleetDoctrineSelection.doctrineCost
    }

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit === null || !isUnitLevelOption(option.tag)) continue
        const quantity = config.optionQuantities[option.tag] ?? 0
        total += computeOptionPoints(option, quantity, discountFirstEscort) ?? 0
    }

    return total
}

export function computeArmyUnitTotal(entry: ArmyUnit, allUnits: Unit[], context?: PointsContext): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownTotal = unit
        ? computeUnitLevelPoints(unit, entry.config, hasChitaSwarmEscortDiscount(entry, context))
            + entry.models.reduce((sum, model) => sum + computeModelPoints(unit, model.config, entry.config), 0)
        : entry.totalPoints
    const attachmentsTotal = (entry.attachedUnits ?? [])
        .reduce((sum, attachment) => sum + computeArmyUnitTotal(attachment, allUnits, context), 0)
    return ownTotal + attachmentsTotal
}

export function computeArmyUnitVpr(entry: ArmyUnit, allUnits: Unit[]): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownTotal = unit ? entry.models.length * unit.vpr : 0
    const attachmentsTotal = (entry.attachedUnits ?? [])
        .reduce((sum, attachment) => sum + computeArmyUnitVpr(attachment, allUnits), 0)
    return ownTotal + attachmentsTotal
}

export function computeEntriesVpr(entries: ArmyUnit[], allUnits: Unit[]): number {
    return entries.reduce((sum, entry) => sum + computeArmyUnitVpr(entry, allUnits), 0)
}

export function updateArmyUnitTotals(entries: ArmyUnit[], allUnits: Unit[], context?: PointsContext): ArmyUnit[] {
    return entries.map((entry) => {
        const attachedUnits = entry.attachedUnits ? updateArmyUnitTotals(entry.attachedUnits, allUnits, context) : undefined
        const updated = attachedUnits ? { ...entry, attachedUnits } : entry
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, allUnits, context),
        }
    })
}

function updateEntry(entry: ArmyUnit, instanceId: string, newConfig: UnitConfig, allUnits: Unit[], context: PointsContext, modelId?: string): ArmyUnit {
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
            totalPoints: computeArmyUnitTotal(updated, allUnits, context),
        }
    }

    const attachedUnits = entry.attachedUnits?.map((attachment) => updateEntry(attachment, instanceId, newConfig, allUnits, context, modelId))
    const updated = attachedUnits ? { ...entry, attachedUnits } : entry
    return {
        ...updated,
        totalPoints: computeArmyUnitTotal(updated, allUnits, context),
    }
}

export function updateListUnit(list: ArmyList, instanceId: string, newConfig: UnitConfig, allUnits: Unit[], modelId?: string): ArmyList {
    return {
        ...list,
        units: list.units.map((entry) => updateEntry(entry, instanceId, newConfig, allUnits, list, modelId)),
        updatedAt: new Date().toISOString(),
    }
}
