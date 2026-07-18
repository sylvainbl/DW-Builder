import type { ArmyUnit, Unit, UnitConfig } from '../types/index'
import {
    getEffectiveGeneratorSelections,
    getSelectedOptionRuleEffects,
    SYSTEM_GENERATOR_WEAPON_INDEX,
} from './optionRuleEffects'

const CROWN_FACTION_ID = 'crown'
const GUARDIAN_GENERATOR_NAME = 'Guardian Generator'
const GUARDIAN_SURGE_NAME = 'Guardian Surge'

export function isCrownFaction(factionId: string | null | undefined): boolean {
    return factionId === CROWN_FACTION_ID
}

function selectedGuardianGeneratorValue(unit: Unit, weaponIndex: number): number {
    if (weaponIndex === SYSTEM_GENERATOR_WEAPON_INDEX) return 1
    const slot = unit.weapons[weaponIndex]?.slot
    if (slot === 'H') return 2
    return 1
}

export function computeModelGuardianPool(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): number {
    if (!isCrownFaction(unit.faction_id)) return 0

    const effects = getSelectedOptionRuleEffects(unit, modelConfig, unitConfig)
    const nativeGuardianPool = unit.systems
        .filter((system) => system.name === GUARDIAN_GENERATOR_NAME && !effects.removedSystems.has(system.name))
        .reduce((sum, system) => sum + (system.value ?? 0), 0)
    const selectedGuardianPool = getEffectiveGeneratorSelections(unit, modelConfig, unitConfig)
        .filter((selection) => selection.generatorName === GUARDIAN_GENERATOR_NAME)
        .reduce((sum, selection) => sum + selectedGuardianGeneratorValue(unit, selection.weaponIndex), 0)

    return nativeGuardianPool + selectedGuardianPool
}

export function computeModelGuardianSurge(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): number {
    if (!isCrownFaction(unit.faction_id)) return 0

    const effects = getSelectedOptionRuleEffects(unit, modelConfig, unitConfig)
    return unit.systems
        .filter((system) => system.name === GUARDIAN_SURGE_NAME && !effects.removedSystems.has(system.name))
        .reduce((sum, system) => sum + (system.value ?? 0), 0)
}

export function computeArmyUnitGuardianPool(entry: ArmyUnit, allUnits: Unit[]): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownGuardianPool = unit
        ? entry.models.reduce((sum, model) => sum + computeModelGuardianPool(unit, model.config, entry.config), 0)
        : 0
    const attachmentGuardianPool = (entry.attachedUnits ?? []).reduce(
        (sum, attachment) => sum + computeArmyUnitGuardianPool(attachment, allUnits),
        0,
    )

    return ownGuardianPool + attachmentGuardianPool
}

export function computeArmyUnitGuardianSurge(entry: ArmyUnit, allUnits: Unit[]): number {
    const unit = allUnits.find((item) => item.id === entry.unitId)
    const ownGuardianSurge = unit
        ? entry.models.reduce((sum, model) => sum + computeModelGuardianSurge(unit, model.config, entry.config), 0)
        : 0
    const attachmentGuardianSurge = (entry.attachedUnits ?? []).reduce(
        (sum, attachment) => sum + computeArmyUnitGuardianSurge(attachment, allUnits),
        0,
    )

    return ownGuardianSurge + attachmentGuardianSurge
}

export function computeEntriesGuardianPool(entries: ArmyUnit[], allUnits: Unit[]): number {
    return entries.reduce((sum, entry) => sum + computeArmyUnitGuardianPool(entry, allUnits), 0)
}

export function computeEntriesGuardianSurge(entries: ArmyUnit[], allUnits: Unit[]): number {
    return entries.reduce((sum, entry) => sum + computeArmyUnitGuardianSurge(entry, allUnits), 0)
}
