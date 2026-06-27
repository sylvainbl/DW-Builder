import type { Unit } from '../types/index'

export function unitCanTakeGenerator(unit: Unit): boolean {
    const hasGeneratorOption = unit.options_and_upgrades.some((option) => option.tag === 'GENERATOR')
    // TODO: when GENERATOR_MULTIPLE is implemented, also allow multiple generators for units tagged with GENERATOR_MULTIPLE.
    return hasGeneratorOption
}
