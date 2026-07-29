import type { OptionUpgrade, Unit } from '../types/index'

export function isUnitSelectable(unit: Pick<Unit, 'point_cost_per_model'>): boolean {
    return unit.point_cost_per_model != null
}

export function formatUnitPointCost(unit: Pick<Unit, 'point_cost_per_model'>): string {
    return isUnitSelectable(unit) ? `${unit.point_cost_per_model} pts` : 'Unavailable'
}

function grantsGeneratorAccess(option: OptionUpgrade): boolean {
    return (
        option.tag === 'GENERATOR' ||
        option.tag === 'TRIDENT_GENERATOR' ||
        option.tag === 'GUARDIAN_GENERATOR' ||
        option.tag === 'ADDITIONAL_GUARDIAN_GENERATOR' ||
        option.tag === 'FREYA_ARRAY' ||
        option.tag === 'MAGMA_CAST_GENERATOR' ||
        option.tag === 'EMPIRE_FREE_GENERATOR' ||
        option.tag === 'FREE_GENERATOR' ||
        option.generator_replaces_weapon === true
    )
}

export function isGeneratorOption(option: OptionUpgrade): boolean {
    return grantsGeneratorAccess(option) || option.generator_replaces_weapon === false
}

export function unitCanTakeGenerator(unit: Unit): boolean {
    return unit.options_and_upgrades.some(grantsGeneratorAccess)
}
