import type { ArmyUnit, NamedValue, Unit, UnitConfig } from '../types/index'
import { getEffectiveGeneratorSelections, getSelectedOptionRuleEffects } from './optionRuleEffects'

type SystemRuleTrigger = {
    factionId: string
    systemName: string
    specialRuleName: string
    threshold?: 'unitContains' | 'halfModels'
}

const systemRuleTriggers: SystemRuleTrigger[] = [
    {
        factionId: 'commonwealth',
        systemName: 'Cryo Generator',
        specialRuleName: 'Cryogenic Blast',
    },
    {
        factionId: 'empire',
        systemName: 'Great Wall Generator',
        specialRuleName: 'Great Walls',
    },
    {
        factionId: 'empire',
        systemName: 'Interphase Generator',
        specialRuleName: 'Interphasing',
        threshold: 'halfModels',
    },
    {
        factionId: 'empire',
        systemName: 'Magma Cast Generator',
        specialRuleName: 'Magma Casting',
    },
]

function specialRule(trigger: SystemRuleTrigger): NamedValue {
    return {
        name: trigger.specialRuleName,
        value: null,
        detail: 'Special Rule',
    }
}

function getMinimumModelCount(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

function getModelSystemNames(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): Set<string> {
    const effects = getSelectedOptionRuleEffects(unit, modelConfig, unitConfig)
    return new Set([
        ...unit.systems
            .filter((system) => !effects.removedSystems.has(system.name))
            .map((system) => system.name),
        ...getEffectiveGeneratorSelections(unit, modelConfig, unitConfig).map((selection) => selection.generatorName),
        ...effects.systems.map((system) => system.name),
    ])
}

export function getFactionSpecialRules(
    unit: Unit,
    selectedGeneratorName: string | string[] | null,
    removedSystemNames: Set<string> = new Set<string>(),
): NamedValue[] {
    const selectedGeneratorNames = Array.isArray(selectedGeneratorName)
        ? selectedGeneratorName
        : selectedGeneratorName ? [selectedGeneratorName] : []
    const nativeSystemNames = new Set(unit.systems
        .filter((system) => !removedSystemNames.has(system.name))
        .map((system) => system.name))
    const systemNames = new Set([
        ...nativeSystemNames,
        ...selectedGeneratorNames,
    ])
    const modelCount = getMinimumModelCount(unit)

    return systemRuleTriggers
        .filter((trigger) => {
            if (trigger.factionId !== unit.faction_id || !systemNames.has(trigger.systemName)) return false
            if (trigger.threshold !== 'halfModels') return true
            const equippedModelCount = nativeSystemNames.has(trigger.systemName)
                ? modelCount
                : selectedGeneratorNames.includes(trigger.systemName) ? 1 : 0
            return equippedModelCount >= Math.ceil(modelCount / 2)
        })
        .map(specialRule)
}

export function getModelFactionSpecialRules(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): NamedValue[] {
    const systemNames = getModelSystemNames(unit, modelConfig, unitConfig)
    return systemRuleTriggers
        .filter((trigger) => trigger.factionId === unit.faction_id && systemNames.has(trigger.systemName))
        .map(specialRule)
}

export function getArmyUnitFactionSpecialRules(unit: Unit, entry: ArmyUnit): NamedValue[] {
    const modelSystemNames = entry.models.length > 0
        ? entry.models.map((model) => getModelSystemNames(unit, model.config, entry.config))
        : [getModelSystemNames(unit, entry.config, entry.config)]
    const modelCount = modelSystemNames.length

    return systemRuleTriggers
        .filter((trigger) => {
            if (trigger.factionId !== unit.faction_id) return false
            const equippedModelCount = modelSystemNames.filter((systemNames) => systemNames.has(trigger.systemName)).length
            if (trigger.threshold === 'halfModels') return equippedModelCount >= Math.ceil(modelCount / 2)
            return equippedModelCount > 0
        })
        .map(specialRule)
}
