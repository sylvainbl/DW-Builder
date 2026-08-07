import type { Generator, UnitConfig } from '../types/index'

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
