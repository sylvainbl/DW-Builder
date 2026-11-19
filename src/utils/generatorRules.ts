import type { Generator, Unit, UnitConfig } from '../types/index'

export function getWeaponGeneratorLimit(unit: Unit, weaponIndex: number): number {
    const slot = unit.weapons[weaponIndex]?.slot
    if (unit.faction_id !== 'imperium') return 1
    return Math.max(
        0,
        ...unit.options_and_upgrades
            .filter(
                (option) =>
                    option.generator_replaces_weapon === true &&
                    (option.tag === 'GENERATOR' ? slot === 'H' : option.tag === 'FREYA_ARRAY' && slot === 'L'),
            )
            .map((option) => option.max ?? 1),
    )
}

export function withUnitWeaponGeneratorSelection(
    unit: Unit | undefined,
    config: UnitConfig,
    selection: UnitConfig['generatorSelection'],
    removedWeaponIndex?: number,
): UnitConfig {
    if (!unit || unit.faction_id !== 'imperium') return withWeaponGeneratorSelection(config, selection)
    const existing = config.generatorSelections ?? (config.generatorSelection ? [config.generatorSelection] : [])
    const index = selection?.weaponIndex ?? removedWeaponIndex
    const kept = existing.filter((item) => item.weaponIndex !== index)
    if (selection) {
        const slot = unit.weapons[selection.weaponIndex]?.slot
        if (
            kept.filter((item) => unit.weapons[item.weaponIndex]?.slot === slot).length >=
                getWeaponGeneratorLimit(unit, selection.weaponIndex) ||
            kept.some((item) => item.generatorName === selection.generatorName)
        )
            return config
        kept.push(selection)
    }
    const hardpointSelections = { ...config.hardpointSelections }
    if (selection) delete hardpointSelections[selection.weaponIndex]
    return {
        ...config,
        orbatVersion: '4.01 BETA',
        hardpointSelections,
        generatorSelection: null,
        generatorSelections: kept,
    }
}

export function canSelectGeneratorInSlot(
    selections: NonNullable<UnitConfig['generatorSelections']>,
    slotIndex: number,
    generatorName: string,
): boolean {
    return !selections.some((selection, index) => index !== slotIndex && selection.generatorName === generatorName)
}

export function getGeneratorChoicesForSlot(
    choices: Generator[],
    selections: NonNullable<UnitConfig['generatorSelections']>,
    slotIndex: number,
): Generator[] {
    return choices.filter((generator) => canSelectGeneratorInSlot(selections, slotIndex, generator.name))
}

export function withWeaponGeneratorSelection(
    config: UnitConfig,
    selection: UnitConfig['generatorSelection'],
): UnitConfig {
    const hardpointSelections = { ...config.hardpointSelections }
    if (selection) delete hardpointSelections[selection.weaponIndex]

    return {
        ...config,
        generatorSelection: selection,
        generatorSelections: undefined,
        hardpointSelections,
    }
}
