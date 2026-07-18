import type { Unit } from '../types/index'

export function isUnitSelectable(unit: Pick<Unit, 'point_cost_per_model'>): boolean {
    return unit.point_cost_per_model != null
}

export function formatUnitPointCost(unit: Pick<Unit, 'point_cost_per_model'>): string {
    return isUnitSelectable(unit) ? `${unit.point_cost_per_model} pts` : 'Unavailable'
}

export function unitCanTakeGenerator(unit: Unit): boolean {
    const hasGeneratorOption = unit.options_and_upgrades.some(
        (option) =>
            option.tag === 'GENERATOR' ||
            option.tag === 'TRIDENT_GENERATOR' ||
            option.tag === 'GUARDIAN_GENERATOR' ||
            option.tag === 'ADDITIONAL_GUARDIAN_GENERATOR' ||
            option.tag === 'FREYA_ARRAY' ||
            option.tag === 'MAGMA_CAST_GENERATOR' ||
            option.tag === 'EMPIRE_FREE_GENERATOR' ||
            option.tag === 'FREE_GENERATOR' ||
            option.generator_replaces_weapon === true,
    )
    return hasGeneratorOption
}
