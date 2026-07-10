import type { Generator, UnitConfig } from '../types/index'

export const REPEATABLE_GENERATOR_NAMES = new Set(['Entropic Generator'])

export function canSelectGeneratorInSlot(
    selections: NonNullable<UnitConfig['generatorSelections']>,
    slotIndex: number,
    generatorName: string,
): boolean {
    return REPEATABLE_GENERATOR_NAMES.has(generatorName)
        || !selections.some((selection, index) => index !== slotIndex && selection.generatorName === generatorName)
}

export function getGeneratorChoicesForSlot(
    choices: Generator[],
    selections: NonNullable<UnitConfig['generatorSelections']>,
    slotIndex: number,
): Generator[] {
    return choices.filter((generator) => canSelectGeneratorInSlot(selections, slotIndex, generator.name))
}
