import type {
    ArmyList,
    ArmyUnit,
    BattlefleetDefinition,
    BattlefleetEffect,
    BattlefleetRequirement,
    NamedValue,
    Unit,
} from '../types/index'
import { getConfiguredUnit, getSelectedTags, mergeNamedValues } from './optionRuleEffects.ts'
import { getAttachmentParentEffects } from './attachments.ts'

function normalizeTrait(value: string): string {
    return value.trim().toLowerCase()
}

function getUnitTraits(unit: Unit, entry?: ArmyUnit): Set<string> {
    const configured = entry ? getConfiguredUnit(unit, entry.models[0]?.config ?? entry.config, entry.config) : unit
    const tags = configured.tags
    const factionTraits = unit.faction_id === 'union' ? [] : [unit.faction_id, unit.faction]
    return new Set(
        [...factionTraits, unit.name, unit.sub_name, configured.role, ...tags]
            .filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0)
            .map(normalizeTrait),
    )
}

function unitMatchesRequirement(unit: Unit, requirement: BattlefleetRequirement, entry?: ArmyUnit): boolean {
    if (requirement.unitIds?.includes(entry?.unitId ?? unit.id)) return true
    if (!requirement.all?.length && !requirement.any?.length) return false
    const traits = getUnitTraits(unit, entry)
    const hasAll = (requirement.all ?? []).every((trait) => traits.has(normalizeTrait(trait)))
    const hasAny = !requirement.any || requirement.any.some((trait) => traits.has(normalizeTrait(trait)))

    return hasAll && hasAny
}

function effectAppliesToEntry(effect: BattlefleetEffect, unit: Unit, entry: ArmyUnit): boolean {
    return (
        !effect.requirements?.length ||
        effect.requirements.some((requirement) => unitMatchesRequirement(unit, requirement, entry))
    )
}

function isEntryInBattlefleetScope(
    effect: BattlefleetEffect,
    entry: ArmyUnit,
    sourceBattlefleetInstanceId: string,
): boolean {
    return effect.scope === 'force' || entry.battlefleetInstanceId === sourceBattlefleetInstanceId
}

function getBattlefleetEffectsForEntry(
    list: ArmyList | null | undefined,
    definitions: BattlefleetDefinition[],
    units: Unit[],
    entry: ArmyUnit | null | undefined,
): BattlefleetEffect[] {
    if (!list || !entry) return []
    const unit = units.find((item) => item.id === entry.unitId)
    if (!unit) return []
    const definitionById = new Map(definitions.map((definition) => [definition.id, definition]))

    const parentEffects = getAttachmentParentEffects(
        entry,
        units,
        getSelectedTags(unit, entry.models[0]?.config ?? entry.config, entry.config),
    )
    const effectiveUnit = { ...unit, tags: [...unit.tags, ...parentEffects.flatMap((effect) => effect.addTags ?? [])] }
    return [
        ...parentEffects,
        ...(list.battlefleets ?? []).flatMap((battlefleet) => {
            const definition = definitionById.get(battlefleet.definitionId)
            return (definition?.effects ?? []).filter(
                (effect) =>
                    isEntryInBattlefleetScope(effect, entry, battlefleet.instanceId) &&
                    effectAppliesToEntry(effect, effectiveUnit, entry),
            )
        }),
    ]
}

export function getBattlefleetAddedTags(
    list: ArmyList | null | undefined,
    definitions: BattlefleetDefinition[],
    units: Unit[],
    entry: ArmyUnit | null | undefined,
): string[] {
    const tags: string[] = []
    for (const effect of getBattlefleetEffectsForEntry(list, definitions, units, entry)) {
        for (const tag of effect.addTags ?? []) {
            if (!tags.includes(tag)) tags.push(tag)
        }
    }
    return tags
}

export function getBattlefleetAddedProperties(
    list: ArmyList | null | undefined,
    definitions: BattlefleetDefinition[],
    units: Unit[],
    entry: ArmyUnit | null | undefined,
): NamedValue[] {
    return mergeNamedValues(
        ...getBattlefleetEffectsForEntry(list, definitions, units, entry).map((effect) => effect.addProperties ?? []),
    )
}

export function getBattlefleetAddedSystems(
    list: ArmyList | null | undefined,
    definitions: BattlefleetDefinition[],
    units: Unit[],
    entry: ArmyUnit | null | undefined,
): NamedValue[] {
    return mergeNamedValues(
        ...getBattlefleetEffectsForEntry(list, definitions, units, entry).map((effect) => effect.addSystems ?? []),
    )
}
