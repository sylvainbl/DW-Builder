import type { NamedValue, OptionUpgrade, Unit, UnitConfig } from '../types/index'
import { isUnitLevelOption } from './pointsCalc'

export interface OptionRuleEffects {
    properties: NamedValue[]
    systems: NamedValue[]
    qualities: NamedValue[]
}

export function formatOptionName(option: Pick<OptionUpgrade, 'tag'> & { display_name?: string }): string {
    return option.display_name
        ?? option.tag
            .split('_')
            .filter(Boolean)
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ')
}

export function emptyOptionRuleEffects(): OptionRuleEffects {
    return {
        properties: [],
        systems: [],
        qualities: [],
    }
}

function optionConfig(option: OptionUpgrade, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): UnitConfig {
    return isUnitLevelOption(option.tag) && unitConfig ? unitConfig : modelConfig
}

function addNamedValues(target: NamedValue[], values: NamedValue[] | undefined) {
    for (const value of values ?? []) {
        target.push(value)
    }
}

export function getSelectedOptionRuleEffects(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): OptionRuleEffects {
    const effects = emptyOptionRuleEffects()

    for (const option of unit.options_and_upgrades) {
        const quantity = optionConfig(option, modelConfig, unitConfig).optionQuantities[option.tag] ?? 0
        if (quantity <= 0) continue

        addNamedValues(effects.properties, option.adds_properties)
        addNamedValues(effects.systems, option.adds_systems)
        addNamedValues(effects.qualities, option.adds_qualities)
    }

    return effects
}

export function getSelectedRemovedWeaponNames(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): Set<string> {
    const removedWeapons = new Set<string>()

    for (const option of unit.options_and_upgrades) {
        const quantity = optionConfig(option, modelConfig, unitConfig).optionQuantities[option.tag] ?? 0
        if (quantity <= 0) continue

        for (const weaponName of option.removes_weapons ?? []) {
            removedWeapons.add(weaponName)
        }
    }

    return removedWeapons
}

export function mergeNamedValues(...groups: NamedValue[][]): NamedValue[] {
    const seen = new Set<string>()
    const merged: NamedValue[] = []

    for (const group of groups) {
        for (const value of group) {
            const key = `${value.name}:${value.value ?? ''}:${value.detail ?? ''}`
            if (seen.has(key)) continue
            seen.add(key)
            merged.push(value)
        }
    }

    return merged
}
