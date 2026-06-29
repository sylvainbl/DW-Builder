import type { Unit } from '../types/index'

export function unitCanTakeGenerator(unit: Unit): boolean {
    const hasGeneratorOption = unit.options_and_upgrades.some((option) => (
        option.tag === 'GENERATOR'
        || option.tag === 'TRIDENT_GENERATOR'
        || option.tag === 'GUARDIAN_GENERATOR'
        || option.tag === 'ADDITIONAL_GUARDIAN_GENERATOR'
        || option.tag === 'FREYA_ARRAY'
        || option.tag === 'MAGMA_CAST_GENERATOR'
        || option.tag === 'EMPIRE_FREE_GENERATOR'
    ))
    // TODO: when GENERATOR_MULTIPLE is implemented, also allow multiple generators for units tagged with GENERATOR_MULTIPLE.
    return hasGeneratorOption
}
