import type { NamedValue, OptionUpgrade, Unit, UnitConfig } from '../types/index'
import { isUnitLevelOption } from './optionConfig'

export const SYSTEM_GENERATOR_WEAPON_INDEX = -1

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

function isOptionSelected(option: OptionUpgrade, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): boolean {
    return (optionConfig(option, modelConfig, unitConfig).optionQuantities[option.tag] ?? 0) > 0
}

export function getSelectedRemovedWeaponNames(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): Set<string> {
    const removedWeapons = new Set<string>()

    for (const option of unit.options_and_upgrades) {
        if (!isOptionSelected(option, modelConfig, unitConfig)) continue

        for (const weaponName of option.removes_weapons ?? []) {
            removedWeapons.add(weaponName)
        }
        for (const slot of option.removes_weapon_slots ?? []) {
            unit.weapons
                .filter((weapon) => weapon.slot === slot)
                .forEach((weapon) => removedWeapons.add(weapon.name))
        }
    }

    return removedWeapons
}

export function isWeaponRemovedBySelectedOptions(unit: Unit, weaponIndex: number, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): boolean {
    const weapon = unit.weapons[weaponIndex]
    return Boolean(weapon && getSelectedRemovedWeaponNames(unit, modelConfig, unitConfig).has(weapon.name))
}

export function unitUsesSystemGeneratorMount(unit: Unit): boolean {
    return unit.options_and_upgrades.some((option) => option.generator_replaces_weapon === false)
}

export function getEffectiveGeneratorSelection(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): UnitConfig['generatorSelection'] {
    const selection = modelConfig.generatorSelection
    if (!selection) return null
    const effectiveSelection = unitUsesSystemGeneratorMount(unit)
        ? { ...selection, weaponIndex: SYSTEM_GENERATOR_WEAPON_INDEX }
        : selection
    if (effectiveSelection.weaponIndex === SYSTEM_GENERATOR_WEAPON_INDEX) return effectiveSelection
    return isWeaponRemovedBySelectedOptions(unit, effectiveSelection.weaponIndex, modelConfig, unitConfig) ? null : effectiveSelection
}

export function getSelectedTags(unit: Unit, modelConfig: UnitConfig, unitConfig?: UnitConfig | null): string[] {
    const tags = unit.tags.filter((tag) => (
        !unit.options_and_upgrades.some((option) => (
            isOptionSelected(option, modelConfig, unitConfig)
            && (option.removes_tags ?? []).includes(tag)
        ))
    ))

    for (const option of unit.options_and_upgrades) {
        if (!isOptionSelected(option, modelConfig, unitConfig)) continue
        for (const tag of option.adds_tags ?? []) {
            if (!tags.includes(tag)) tags.push(tag)
        }
    }

    return tags
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
