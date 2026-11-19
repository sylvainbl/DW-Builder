import type { OptionUpgrade, Unit, UnitConfig, Weapon, WeaponMatch } from '../types/index'

export function isUnitLevelOption(tag: string): boolean {
    return (
        tag === 'ESCORT' ||
        tag === 'JAPANESE_SUBCLASS' ||
        tag === 'EARTHSHAKER_CONSTRUCTION' ||
        tag === 'COMMONWEALTH_DEFENSIVE_MINES' ||
        tag === 'CROWN_DEFENSIVE_MINES' ||
        tag === 'IMPERIUM_DEFENSIVE_MINES' ||
        tag === 'IMPERIUM_FLAGSHIP_VARIANT' ||
        tag.startsWith('IMPERIUM_SUBFACTION_') ||
        tag.startsWith('COMMONWEALTH_SUBFACTION_') ||
        tag.startsWith('CROWN_SUBFACTION_')
    )
}

export function optionChoiceName(choice: unknown): string | null {
    if (typeof choice === 'string') return choice
    if (choice && typeof choice === 'object' && 'name' in choice && typeof choice.name === 'string') return choice.name
    return null
}

export function optionChoiceCost(choice: unknown): number | null {
    if (choice && typeof choice === 'object' && 'cost_per_unit' in choice && typeof choice.cost_per_unit === 'number') {
        return choice.cost_per_unit
    }
    return null
}

export function getOptionChoices(option: OptionUpgrade): unknown[] {
    if (Array.isArray(option.choices)) return option.choices
    if (typeof option.choices === 'string') return [option.choices]
    return []
}

export function getOptionChoiceNames(option: OptionUpgrade): string[] {
    return getOptionChoices(option).flatMap((choice) => {
        const name = optionChoiceName(choice)
        return name ? [name] : []
    })
}

export function isGeneratorHardpointsListChoice(name: string): boolean {
    const normalizedName = name.toLowerCase()
    return (
        normalizedName.includes('generator hardpoints list') ||
        normalizedName === 'generator hardpoint' ||
        normalizedName === 'generator hardpoints'
    )
}

export function matchesWeaponMatch(weapon: Weapon, match: WeaponMatch): boolean {
    return (
        weapon.name === match.name &&
        (match.arc === undefined || weapon.arc === match.arc) &&
        (match.slot === undefined || weapon.slot === match.slot)
    )
}

export function optionAllowsWeapon(option: OptionUpgrade, weapon: Weapon): boolean {
    return !option.generator_weapon_match || matchesWeaponMatch(weapon, option.generator_weapon_match)
}

export function normalizeGeneratorBackedOptionConfig(unit: Unit, config: UnitConfig): UnitConfig {
    const legacyOption = unit.options_and_upgrades.find(
        (option) =>
            option.generator_replaces_weapon === true &&
            option.generator_weapon_match &&
            (config.optionQuantities[option.tag] ?? 0) > 0,
    )
    if (!legacyOption) return config

    const choice = getOptionChoices(legacyOption).find((item) => {
        const name = optionChoiceName(item)
        return name != null && !isGeneratorHardpointsListChoice(name)
    })
    const generatorName = optionChoiceName(choice)
    const weaponIndex = unit.weapons.findIndex((weapon) =>
        matchesWeaponMatch(weapon, legacyOption.generator_weapon_match!),
    )
    const optionQuantities = { ...config.optionQuantities, [legacyOption.tag]: 0 }

    if (config.generatorSelection || !generatorName || weaponIndex < 0) {
        return { ...config, optionQuantities }
    }

    return {
        ...config,
        optionQuantities,
        generatorSelection: {
            weaponIndex,
            generatorName,
            generatorCost: optionChoiceCost(choice) ?? legacyOption.cost_per_unit ?? 0,
        },
        generatorSelections: undefined,
    }
}
