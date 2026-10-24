import type {
    ArmyBattlefleet,
    ArmyList,
    ArmyUnit,
    BattlefleetDefinition,
    BattlefleetType,
    BattlefleetElement,
    BattlefleetIssue,
    BattlefleetRequirement,
    Unit,
} from '../types/index'
import { getEffectiveGeneratorSelections, getSelectedTags } from './optionRuleEffects.ts'
import {
    getAttachmentEligibilityFailure,
    getAttachmentKeyword,
    getAttachmentModelLimitForUnit,
    getMinimumModelsForAttachment,
    hasAttachmentProperty,
} from './attachments.ts'

function normalizeTrait(value: string): string {
    return value.trim().toLowerCase()
}

function getUnitTraits(unit: Unit, entry?: ArmyUnit): Set<string> {
    const tags = entry ? getSelectedTags(unit, entry.models[0]?.config ?? entry.config, entry.config) : unit.tags
    const factionTraits = unit.faction_id === 'union' ? [] : [unit.faction_id, unit.faction]
    return new Set(
        [...factionTraits, unit.name, unit.sub_name, unit.role, ...tags]
            .filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0)
            .map(normalizeTrait),
    )
}

function getPotentialUnitTraits(unit: Unit): Set<string> {
    const tags = [...unit.tags]
    for (const option of unit.options_and_upgrades) {
        for (const tag of option.adds_tags ?? []) {
            if (!tags.includes(tag)) tags.push(tag)
        }
    }
    const factionTraits = unit.faction_id === 'union' ? [] : [unit.faction_id, unit.faction]
    return new Set(
        [...factionTraits, unit.name, unit.sub_name, unit.role, ...tags]
            .filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0)
            .map(normalizeTrait),
    )
}

function hasTrait(unit: Unit, trait: string, entry?: ArmyUnit): boolean {
    return getUnitTraits(unit, entry).has(normalizeTrait(trait))
}

function unitMatchesRequirement(unit: Unit, requirement: BattlefleetRequirement, entry?: ArmyUnit): boolean {
    if (requirement.unitIds?.includes(entry?.unitId ?? unit.id)) return true
    if (!requirement.all?.length && !requirement.any?.length) return false
    const traits = getUnitTraits(unit, entry)
    const hasAll = (requirement.all ?? []).every((trait) => traits.has(normalizeTrait(trait)))
    const hasAny = !requirement.any || requirement.any.some((trait) => traits.has(normalizeTrait(trait)))

    return hasAll && hasAny
}

function matchesRequirement(entry: ArmyUnit, unit: Unit, requirement: BattlefleetRequirement): boolean {
    return unitMatchesRequirement(unit, requirement, entry)
}

function matchesElement(entry: ArmyUnit, unit: Unit, element: BattlefleetElement): boolean {
    return element.requirements.some((requirement) => matchesRequirement(entry, unit, requirement))
}

export function getMatchingBattlefleetElement(
    definition: BattlefleetDefinition,
    entry: ArmyUnit,
    unit: Unit,
): BattlefleetElement | null {
    return definition.elements.find((element) => matchesElement(entry, unit, element)) ?? null
}

function potentialUnitMatchesRequirement(unit: Unit, requirement: BattlefleetRequirement): boolean {
    if (requirement.unitIds?.includes(unit.id)) return true
    if (!requirement.all?.length && !requirement.any?.length) return false
    const traits = getPotentialUnitTraits(unit)
    const hasAll = (requirement.all ?? []).every((trait) => traits.has(normalizeTrait(trait)))
    const hasAny = !requirement.any || requirement.any.some((trait) => traits.has(normalizeTrait(trait)))

    return hasAll && hasAny
}

function unitPotentiallyMatchesBattlefleetElement(definition: BattlefleetDefinition, unit: Unit): boolean {
    return definition.elements.some((element) =>
        element.requirements.some((requirement) => potentialUnitMatchesRequirement(unit, requirement)),
    )
}

function passesCategoricalSpecialRules(definition: BattlefleetDefinition, unit: Unit): boolean {
    const rules = definition.specialRules ?? []
    if (
        rules.includes('empire-airborne-only') &&
        (!hasTrait(unit, 'Airborne') || hasTrait(unit, 'Surface') || hasTrait(unit, 'Underwater'))
    ) {
        return false
    }
    if (
        rules.includes('empire-underwater-only') &&
        (!hasTrait(unit, 'Underwater') || hasTrait(unit, 'Surface') || hasTrait(unit, 'Airborne'))
    ) {
        return false
    }
    return true
}

export function canUnitJoinBattlefleetDefinition(definition: BattlefleetDefinition, unit: Unit): boolean {
    return unitPotentiallyMatchesBattlefleetElement(definition, unit) && passesCategoricalSpecialRules(definition, unit)
}

function flattenUnits(entries: ArmyUnit[]): ArmyUnit[] {
    return entries.flatMap((entry) => [entry, ...flattenUnits(entry.attachedUnits ?? [])])
}

function findUnit(units: Unit[], entry: ArmyUnit): Unit | null {
    return units.find((unit) => unit.id === entry.unitId) ?? null
}

const battlefleetRoleOrder = ['Flagship', 'Line', 'Patrol', 'Support', 'Scout', 'Logistical']
const EMPIRE_TIANLONG_UNIT_ID = 'empire_tianlong_draconic_colossus'
const EMPIRE_DRAGONS_WRATH_RULE = 'empire-tianlong-flagship-no-doctrine'
const EMPIRE_GWISIN_BATTLEFLEET_ID = 'empire-gwisin-silent-strike'
const EMPIRE_ZHANMADAO_BATTLEFLEET_ID = 'empire-zhanmadao'
const EMPIRE_KAGUTSUCHI_MAGMA_RULE = 'empire-kagutsuchi-magma-flagship'
const MAGMA_GENERATOR_NAMES = new Set(['Magma Cast Generator', 'Magma Tower Generator'])
const CROWN_ADVENTURER_UNIT_ID = 'crown_adventurer'
const CROWN_PALASHI_UNIT_ID = 'crown_palashi'
const COMMONWEALTH_AKULA_UNIT_ID = 'commonwealth_akula'
const UKRAINIAN_AKULA_FLAGSHIP_RULE = 'ukrainian-akula-flagship'

function battlefleetRoleRank(unit: Unit | null): number {
    const index = unit ? battlefleetRoleOrder.indexOf(unit.role) : -1
    return index === -1 ? battlefleetRoleOrder.length : index
}

export function isUkrainianAkulaFlagship(
    definition: BattlefleetDefinition | null | undefined,
    entries: ArmyUnit[],
    entry: ArmyUnit | null | undefined,
): boolean {
    if (
        !definition?.specialRules?.includes(UKRAINIAN_AKULA_FLAGSHIP_RULE) ||
        !entry ||
        entry.unitId !== COMMONWEALTH_AKULA_UNIT_ID
    )
        return false
    return entries.find((candidate) => candidate.unitId === COMMONWEALTH_AKULA_UNIT_ID)?.instanceId === entry.instanceId
}

export function sortBattlefleetEntries(entries: ArmyUnit[], units: Unit[]): ArmyUnit[] {
    return entries
        .map((entry, index) => ({ entry, index, rank: battlefleetRoleRank(findUnit(units, entry)) }))
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ entry }) => entry)
}

function unitLabel(units: Unit[], entry: ArmyUnit): string {
    return findUnit(units, entry)?.name ?? entry.unitId
}

function battlefleetLabel(battlefleet: ArmyBattlefleet, definition?: BattlefleetDefinition): string {
    const typeName = definition?.name || battlefleet.name || battlefleet.definitionId
    return battlefleet.customName ? `${typeName} (${battlefleet.customName})` : typeName
}

export function isBattlefleetAvailableForFaction(
    definition: BattlefleetDefinition,
    factionId: string | null | undefined,
): boolean {
    if (!factionId) return false
    return definition.faction_id === factionId || definition.mercenary === true
}

export function isMercenaryInForce(
    definition: BattlefleetDefinition,
    forceFactionId: string | null | undefined,
): boolean {
    return Boolean(forceFactionId && definition.mercenary && definition.faction_id !== forceFactionId)
}

export function getBattlefleetForceType(
    definition: BattlefleetDefinition,
    forceFactionId: string | null | undefined,
): BattlefleetType {
    return isMercenaryInForce(definition, forceFactionId) ? 'specialist' : definition.type
}

function getMainstayClasses(definition: BattlefleetDefinition, entries: ArmyUnit[]): Set<string> {
    const classNames = new Set((definition.mainstayClassNames ?? []).map(normalizeTrait))
    for (const additional of definition.additionalMainstays ?? []) {
        const hasFlagship = entries.some((entry) => additional.flagshipUnitIds.includes(entry.unitId))
        if (hasFlagship) {
            additional.classNames.forEach((className) => classNames.add(normalizeTrait(className)))
        }
    }
    return classNames
}

function solveElementCounts(
    definition: BattlefleetDefinition,
    entries: ArmyUnit[],
    units: Unit[],
): { valid: boolean; counts: Record<string, number>; unassigned: ArmyUnit[] } {
    const initialCounts = Object.fromEntries(definition.elements.map((element) => [element.id, 0]))
    const candidates = entries.map((entry) => {
        const unit = findUnit(units, entry)
        return {
            entry,
            elements: unit ? definition.elements.filter((element) => matchesElement(entry, unit, element)) : [],
        }
    })

    const unassigned = candidates
        .filter((candidate) => candidate.elements.length === 0)
        .map((candidate) => candidate.entry)
    if (unassigned.length > 0) {
        return { valid: false, counts: initialCounts, unassigned }
    }

    const ordered = [...candidates].sort((a, b) => a.elements.length - b.elements.length)
    const search = (index: number, counts: Record<string, number>): Record<string, number> | null => {
        if (index >= ordered.length) {
            const hasMinimums = definition.elements.every((element) => (counts[element.id] ?? 0) >= element.min)
            return hasMinimums ? { ...counts } : null
        }

        const candidate = ordered[index]
        if (!candidate) return null
        for (const element of candidate.elements) {
            const currentCount = counts[element.id] ?? 0
            if (currentCount >= element.max) continue
            counts[element.id] = currentCount + 1
            const result = search(index + 1, counts)
            if (result) return result
            counts[element.id] = currentCount
        }

        return null
    }

    const validCounts = search(0, { ...initialCounts })
    if (validCounts) return { valid: true, counts: validCounts, unassigned: [] }

    const greedyCounts = { ...initialCounts }
    const greedyUnassigned: ArmyUnit[] = []
    for (const candidate of candidates) {
        const element = candidate.elements.find((item) => (greedyCounts[item.id] ?? 0) < item.max)
        if (element) {
            greedyCounts[element.id] = (greedyCounts[element.id] ?? 0) + 1
        } else {
            greedyUnassigned.push(candidate.entry)
        }
    }

    return { valid: false, counts: greedyCounts, unassigned: greedyUnassigned }
}

function validateDuplicateClasses(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const mainstayClasses = getMainstayClasses(definition, entries)
    const classCounts = new Map<string, { label: string; standalone: number; attachments: number }>()
    const exemptBarbudosFlagshipIds = new Set(['alliance_francisco', 'alliance_salvador'])
    let barbudosFlagshipExemptionUsed = false
    let ukrainianAkulaFlagshipExemptionUsed = false

    const countEntry = (entry: ArmyUnit, field: 'standalone' | 'attachments') => {
        const unit = findUnit(units, entry)
        if (!unit) return
        const key = normalizeTrait(unit.name)
        const current = classCounts.get(key) ?? { label: unit.name, standalone: 0, attachments: 0 }
        classCounts.set(key, { ...current, [field]: current[field] + 1 })
    }

    const countAttachments = (parent: ArmyUnit) => {
        for (const attachment of parent.attachedUnits ?? []) {
            if (attachment.generatedByOption) continue
            countEntry(attachment, 'attachments')
            countAttachments(attachment)
        }
    }

    for (const entry of entries) {
        const unit = findUnit(units, entry)
        if (!unit) continue
        if (
            definition.specialRules?.includes('barbudos-cruiser-flagship') &&
            exemptBarbudosFlagshipIds.has(unit.id) &&
            !barbudosFlagshipExemptionUsed
        ) {
            barbudosFlagshipExemptionUsed = true
            continue
        }
        if (
            definition.specialRules?.includes(UKRAINIAN_AKULA_FLAGSHIP_RULE) &&
            unit.id === COMMONWEALTH_AKULA_UNIT_ID &&
            !ukrainianAkulaFlagshipExemptionUsed
        ) {
            ukrainianAkulaFlagshipExemptionUsed = true
            continue
        }
        countEntry(entry, 'standalone')
    }
    entries.forEach(countAttachments)

    for (const [className, { label, standalone, attachments }] of classCounts) {
        const isDragonWrathTianlong =
            definition.specialRules?.includes(EMPIRE_DRAGONS_WRATH_RULE) && className === normalizeTrait('Tianlong')
        if (isDragonWrathTianlong) {
            if (standalone + attachments > 2) {
                issues.push({
                    severity: 'error',
                    battlefleetInstanceId: battlefleet.instanceId,
                    message: `${battlefleet.name} has ${standalone} standalone and ${attachments} Attachment ${label} units; Dragon's Wrath allows up to two Tianlong units per Battlefleet.`,
                })
            }
            continue
        }

        const limit = mainstayClasses.has(className) ? 2 : 1
        if (standalone > limit || attachments > limit) {
            const limitText = mainstayClasses.has(className)
                ? 'Mainstay Classes allow at most two standalone units and two Attachments'
                : 'Duplicate Classes allow at most one standalone unit and one Attachment'
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleet.name} has ${standalone} standalone and ${attachments} Attachment ${label} units; ${limitText} per Battlefleet.`,
            })
        }
    }

    return issues
}

function attachmentFailureMessage(
    failure: NonNullable<ReturnType<typeof getAttachmentEligibilityFailure>>,
    attachment: Unit,
    parent: Unit,
): string {
    switch (failure) {
        case 'different-faction':
            return `${attachment.name} and its Parent Unit ${parent.name} must come from the same ORBAT.`
        case 'same-unit':
            return `${attachment.name} cannot be attached to another ${parent.name} unit.`
        case 'parent-is-attachment':
            return `${parent.name} has the Attachment (${getAttachmentKeyword(parent) ?? 'X'}) property and cannot be a Parent Unit.`
        case 'positional-trait':
            return `${attachment.name} must have the same Positional Trait as its Parent Unit ${parent.name}.`
        case 'parent-option':
            return `${parent.name} does not have an option allowing ${attachment.name} as an Attachment.`
        case 'parent-traits':
            return `${parent.name} does not have the Trait(s) required by ${attachment.name}'s Attachment (${getAttachmentKeyword(attachment) ?? 'X'}) property.`
    }
}

function validateAttachmentRelations(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []

    const visit = (parentEntry: ArmyUnit, parentIsAttachment: boolean) => {
        const parent = findUnit(units, parentEntry)
        const attachments = (parentEntry.attachedUnits ?? []).filter((attachment) => !attachment.generatedByOption)
        if (!parent || attachments.length === 0) return

        if (parentIsAttachment || hasAttachmentProperty(parent)) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: parentEntry.instanceId,
                message: parentIsAttachment
                    ? `${parent.name} is fielded as an Attachment and cannot be a Parent Unit.`
                    : `${parent.name} has the Attachment (${getAttachmentKeyword(parent) ?? 'X'}) property and cannot be a Parent Unit.`,
            })
        }
        if (attachments.length > 1) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: parentEntry.instanceId,
                message: `${parent.name} has ${attachments.length} Attachments; a Parent Unit can only have one.`,
            })
        }

        const parentTags = getSelectedTags(
            parent,
            parentEntry.models[0]?.config ?? parentEntry.config,
            parentEntry.config,
        )
        for (const attachmentEntry of attachments) {
            const attachment = findUnit(units, attachmentEntry)
            if (!attachment) continue
            const minimumModels = getMinimumModelsForAttachment(attachment)
            const maximumModels = getAttachmentModelLimitForUnit(attachment)
            if (attachmentEntry.models.length < minimumModels || attachmentEntry.models.length > maximumModels) {
                issues.push({
                    severity: 'error',
                    battlefleetInstanceId: battlefleet.instanceId,
                    unitInstanceId: attachmentEntry.instanceId,
                    message: `${attachment.name} has ${attachmentEntry.models.length} models as an Attachment; allowed ${minimumModels === maximumModels ? minimumModels : `${minimumModels}-${maximumModels}`}.`,
                })
            }
            const attachmentTags = getSelectedTags(
                attachment,
                attachmentEntry.models[0]?.config ?? attachmentEntry.config,
                attachmentEntry.config,
            )
            const failure = getAttachmentEligibilityFailure(attachment, parent, { attachmentTags, parentTags })
            if (failure && failure !== 'parent-is-attachment') {
                issues.push({
                    severity: 'error',
                    battlefleetInstanceId: battlefleet.instanceId,
                    unitInstanceId: attachmentEntry.instanceId,
                    message: attachmentFailureMessage(failure, attachment, parent),
                })
            }
            visit(attachmentEntry, true)
        }
    }

    entries.forEach((entry) => visit(entry, false))
    return issues
}

function validateFlagshipLimit(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const rawFlagshipCount = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Flagship') : false
    }).length
    const exemptTianlongCount = definition.specialRules?.includes(EMPIRE_DRAGONS_WRATH_RULE)
        ? Math.min(1, Math.max(0, entries.filter((entry) => entry.unitId === EMPIRE_TIANLONG_UNIT_ID).length - 1))
        : 0
    const exemptEastIndiaPalashiCount =
        definition.specialRules?.includes('east-india-palashi-line') &&
        entries.some((entry) => entry.unitId === CROWN_ADVENTURER_UNIT_ID)
            ? Math.min(1, entries.filter((entry) => entry.unitId === CROWN_PALASHI_UNIT_ID).length)
            : 0
    const allowsSecondFlagship = definition.specialRules?.some((rule) =>
        ['commonwealth-icemaker-restrictions', 'black-wolf-flagship-no-doctrine'].includes(rule),
    )
    const flagshipCount =
        rawFlagshipCount - exemptTianlongCount - exemptEastIndiaPalashiCount - (allowsSecondFlagship ? 1 : 0)

    if (flagshipCount <= 1) return []

    return [
        {
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} has ${flagshipCount} Flagship units; a Battlefleet can contain only one.`,
        },
    ]
}

function validateCommonwealthMainSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const hasPolishLithuanianFlagship = entries.some((entry) => {
        const unit = findUnit(units, entry)
        return unit ? ['Polish-Lithuanian', 'Airborne', 'Flagship'].every((tag) => hasTrait(unit, tag, entry)) : false
    })
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit && !hasTrait(unit, 'Flagship', entry)
    })
    const airborne = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit && hasTrait(unit, 'Airborne', entry)
    })
    const polishAirborne = airborne.filter((entry) => hasTrait(findUnit(units, entry)!, 'Polish-Lithuanian', entry))
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit && hasTrait(unit, 'Underwater', entry)
    }).length
    const issues: BattlefleetIssue[] = []
    if (
        hasPolishLithuanianFlagship
            ? polishAirborne.length > 4 || airborne.length - polishAirborne.length > 1
            : airborne.length > 1
    ) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} exceeds its Airborne limit (one unit, or up to four Polish-Lithuanian Airborne units with a Polish-Lithuanian Airborne Flagship; Flagships and Attachments are excluded).`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship.`,
        })
    }
    return issues
}

function validateAirborneUnderwaterLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Airborne unit, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateBlackWolfSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const underwaterCount = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length
    const requiredUnderwater = Math.ceil(entries.length / 2)

    if (entries.length > 0 && underwaterCount < requiredUnderwater) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} must have at least half of its units as Underwater units (${underwaterCount}/${requiredUnderwater}).`,
        })
    }

    for (const entry of entries) {
        const unit = findUnit(units, entry)
        if (unit && hasTrait(unit, 'Flagship') && entry.config.fleetDoctrineSelection) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${unit.name} cannot purchase a Fleet Doctrine while assigned as the ${battlefleet.name} Flagship.`,
            })
        }
    }

    return issues
}

function validateEastIndiaPrivateersSpecial(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const palashiCount = entries.filter((entry) => entry.unitId === CROWN_PALASHI_UNIT_ID).length
    if (palashiCount === 0) return []

    const hasAdventurer = entries.some((entry) => entry.unitId === CROWN_ADVENTURER_UNIT_ID)
    const hasOtherFlagship = entries.some((entry) => {
        const unit = findUnit(units, entry)
        return unit ? entry.unitId !== CROWN_ADVENTURER_UNIT_ID && hasTrait(unit, 'Flagship') : false
    })

    if (hasAdventurer && palashiCount > 1) {
        return [
            {
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleet.name} can include only one Palashi as a Line unit when Adventurer is its Flagship.`,
            },
        ]
    }

    if (!hasOtherFlagship || hasAdventurer) return []

    return [
        {
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include Palashi as a Line unit only when Adventurer is its Flagship.`,
        },
    ]
}

function validateFlagshipNoDoctrine(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Flagship') || !entry.config.fleetDoctrineSelection) return []
        return [
            {
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${unit.name} cannot purchase a Fleet Doctrine while assigned as the ${battlefleet.name} Flagship.`,
            },
        ]
    })
}

function validateEmpireMainLimit(battlefleet: ArmyBattlefleet, entries: ArmyUnit[], units: Unit[]): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 1) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most one Underwater unit, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateUnionMainstayExemptAirborneUnderwaterLimit(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
    maxAirborne: number,
    maxUnderwater: number,
): BattlefleetIssue[] {
    const mainstayClasses = getMainstayClasses(definition, entries)
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || hasTrait(unit, 'Flagship')) return false
        return !mainstayClasses.has(normalizeTrait(unit.name))
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > maxAirborne) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most ${maxAirborne === 1 ? 'one' : maxAirborne} Airborne unit${maxAirborne === 1 ? '' : 's'}, excluding Mainstay Classes, its Flagship, and Attachments.`,
        })
    }
    if (underwaterCount > maxUnderwater) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most ${maxUnderwater === 1 ? 'one' : maxUnderwater} Underwater unit${maxUnderwater === 1 ? '' : 's'}, excluding Mainstay Classes, its Flagship, and Attachments.`,
        })
    }
    return issues
}

function validateUnionManifestDestinyFlagship(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const validFlagshipIds = new Set(['union_america_special_operations_vessel', 'union_senator_command_cruiser'])
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Flagship') || validFlagshipIds.has(entry.unitId)) return []
        return [
            {
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${battlefleet.name} Flagship must be an America Special Operations Vessel or Senator Command Cruiser unit.`,
            },
        ]
    })
}

function validateEmpireChitaRestrictions(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 0) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} cannot include Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 4) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most four Underwater units, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateEmpireKagutsuchiLimit(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const countedEntries = entries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? !hasTrait(unit, 'Flagship') : false
    })
    const airborneCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Airborne') : false
    }).length
    const underwaterCount = countedEntries.filter((entry) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, 'Underwater') : false
    }).length

    const issues: BattlefleetIssue[] = []
    if (airborneCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Airborne units, excluding its Flagship and Attachments.`,
        })
    }
    if (underwaterCount > 2) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleet.name} can include at most two Underwater units, excluding its Flagship and Attachments.`,
        })
    }
    return issues
}

function validateEmpireAirborneOnly(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || (hasTrait(unit, 'Airborne') && !hasTrait(unit, 'Surface') && !hasTrait(unit, 'Underwater')))
            return []
        return [
            {
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${battlefleet.name} cannot include Surface or Underwater units.`,
            },
        ]
    })
}

function validateEmpireUnderwaterOnly(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || (hasTrait(unit, 'Underwater') && !hasTrait(unit, 'Surface') && !hasTrait(unit, 'Airborne')))
            return []
        return [
            {
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${battlefleet.name} cannot include Airborne or Surface units.`,
            },
        ]
    })
}

function validateEmpireTianlongNoDoctrine(battlefleet: ArmyBattlefleet, entries: ArmyUnit[]): BattlefleetIssue[] {
    return entries.flatMap((entry) =>
        entry.unitId === EMPIRE_TIANLONG_UNIT_ID && entry.config.fleetDoctrineSelection
            ? [
                  {
                      severity: 'error' as const,
                      battlefleetInstanceId: battlefleet.instanceId,
                      unitInstanceId: entry.instanceId,
                      message: `Tianlong Draconic Colossus cannot purchase a Fleet Doctrine while assigned to ${battlefleet.name}.`,
                  },
              ]
            : [],
    )
}

function unitHasMagmaGenerator(unit: Unit, entry: ArmyUnit): boolean {
    if (unit.systems.some((system) => MAGMA_GENERATOR_NAMES.has(system.name))) return true
    return entry.models.some((model) => {
        const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entry.config)
        return generatorSelections.some((generatorSelection) =>
            MAGMA_GENERATOR_NAMES.has(generatorSelection.generatorName),
        )
    })
}

function validateEmpireKagutsuchiMagmaFlagship(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return entries.flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Flagship') || unitHasMagmaGenerator(unit, entry)) return []
        return [
            {
                severity: 'error' as const,
                battlefleetInstanceId: battlefleet.instanceId,
                unitInstanceId: entry.instanceId,
                message: `${battlefleet.name} Flagship must have a Magma Cast Generator or Magma Tower Generator.`,
            },
        ]
    })
}

function validateSubfactionSelections(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    return flattenUnits(entries).flatMap((entry) => {
        const unit = findUnit(units, entry)
        if (
            !unit ||
            !unit.options_and_upgrades.some(
                (option) => option.mandatory && option.exclusive_group?.endsWith('_SUBFACTION'),
            )
        )
            return []
        const selected = unit.options_and_upgrades.filter(
            (option) =>
                option.mandatory &&
                option.exclusive_group?.endsWith('_SUBFACTION') &&
                (entry.config.optionQuantities[option.tag] ?? 0) > 0,
        )
        return selected.length === 1
            ? []
            : [
                  {
                      severity: 'error' as const,
                      battlefleetInstanceId: battlefleet.instanceId,
                      unitInstanceId: entry.instanceId,
                      message: `${unit.name} must choose exactly one ${unit.faction} subfaction for the entire unit.`,
                  },
              ]
    })
}

function validateCommonwealthSpecialist(
    rule: string,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const has = (entry: ArmyUnit, tag: string) => {
        const unit = findUnit(units, entry)
        return unit ? hasTrait(unit, tag, entry) : false
    }
    const report = (message: string, entry?: ArmyUnit) =>
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            ...(entry ? { unitInstanceId: entry.instanceId } : {}),
            message: `${battlefleet.name}: ${message}`,
        })
    if (rule === 'commonwealth-no-airborne') {
        for (const entry of flattenUnits(entries)) {
            if (has(entry, 'Airborne')) report('cannot contain Airborne units, including Attachments.', entry)
        }
    }
    if (rule === 'commonwealth-orlan-restrictions') {
        const counted = entries.filter((entry) => !has(entry, 'Flagship'))
        const qualifying = counted.filter((entry) => has(entry, 'Ekranoplan') || has(entry, 'Hovercraft'))
        if (qualifying.length < Math.ceil(counted.length / 2))
            report('at least half of non-Flagship, non-Attachment units must be Ekranoplan or Hovercraft.')
        if (flattenUnits(entries).filter((entry) => has(entry, 'Hovercraft')).length > 4)
            report('can contain at most four Hovercraft units.')
        for (const entry of flattenUnits(entries)) {
            if (has(entry, 'Polish-Lithuanian') && has(entry, 'Airborne'))
                report('cannot contain Polish-Lithuanian Airborne units.', entry)
        }
    }
    if (rule === 'commonwealth-icemaker-restrictions') {
        const flagships = entries.filter((entry) => has(entry, 'Flagship'))
        for (const entry of flagships.slice(1)) {
            if (entry.config.fleetDoctrineSelection)
                report('the second Flagship cannot purchase a Fleet Doctrine.', entry)
        }
        if (entries.filter((entry) => !has(entry, 'Flagship') && has(entry, 'Airborne')).length > 1)
            report('can contain at most one Airborne unit, excluding Flagships and Attachments.')
        for (const entry of flattenUnits(entries)) {
            const unit = findUnit(units, entry)
            const cryo = unit?.options_and_upgrades.find((option) => option.tag === 'CRYO_GENERATOR')
            if (cryo && entry.models.some((model) => (model.config.optionQuantities[cryo.tag] ?? 0) < 1))
                report('every applicable model must purchase its Cryo Generator upgrade.', entry)
        }
    }
    return issues
}

function validateSpecialRules(
    definition: BattlefleetDefinition,
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    for (const rule of definition.specialRules ?? []) {
        if (
            [
                'commonwealth-no-airborne',
                'commonwealth-orlan-restrictions',
                'commonwealth-icemaker-restrictions',
            ].includes(rule)
        ) {
            issues.push(...validateCommonwealthSpecialist(rule, battlefleet, entries, units))
        }
        if (rule === 'commonwealth-main-airborne-underwater-limit') {
            issues.push(...validateCommonwealthMainSpecial(battlefleet, entries, units))
        }
        if (rule === 'alliance-main-airborne-underwater-limit' || rule === 'airborne-underwater-limit') {
            issues.push(...validateAirborneUnderwaterLimit(battlefleet, entries, units))
        }
        if (
            rule === 'black-wolf-underwater-half' ||
            (rule === 'black-wolf-flagship-no-doctrine' &&
                !definition.specialRules?.includes('black-wolf-underwater-half'))
        ) {
            issues.push(...validateBlackWolfSpecial(battlefleet, entries, units))
        }
        if (rule === 'east-india-palashi-line') {
            issues.push(...validateEastIndiaPrivateersSpecial(battlefleet, entries, units))
        }
        if (
            rule === 'scions-flagship-no-doctrine' ||
            rule === 'sultanate-crimson-flagship-no-doctrine' ||
            rule === 'union-hec-flagship-no-doctrine'
        ) {
            issues.push(...validateFlagshipNoDoctrine(battlefleet, entries, units))
        }
        if (rule === 'empire-main-airborne-underwater-limit') {
            issues.push(...validateEmpireMainLimit(battlefleet, entries, units))
        }
        if (rule === 'union-main-airborne-underwater-limit') {
            issues.push(
                ...validateUnionMainstayExemptAirborneUnderwaterLimit(definition, battlefleet, entries, units, 2, 1),
            )
        }
        if (rule === 'union-airborne-underwater-limit') {
            issues.push(
                ...validateUnionMainstayExemptAirborneUnderwaterLimit(definition, battlefleet, entries, units, 1, 1),
            )
        }
        if (rule === 'union-manifest-flagship') {
            issues.push(...validateUnionManifestDestinyFlagship(battlefleet, entries, units))
        }
        if (rule === 'empire-chita-restrictions') {
            issues.push(...validateEmpireChitaRestrictions(battlefleet, entries, units))
        }
        if (rule === 'empire-kagutsuchi-airborne-underwater-limit') {
            issues.push(...validateEmpireKagutsuchiLimit(battlefleet, entries, units))
        }
        if (rule === EMPIRE_KAGUTSUCHI_MAGMA_RULE) {
            issues.push(...validateEmpireKagutsuchiMagmaFlagship(battlefleet, entries, units))
        }
        if (rule === 'empire-airborne-only') {
            issues.push(...validateEmpireAirborneOnly(battlefleet, entries, units))
        }
        if (rule === 'empire-underwater-only') {
            issues.push(...validateEmpireUnderwaterOnly(battlefleet, entries, units))
        }
        if (rule === 'empire-tianlong-flagship-no-doctrine') {
            issues.push(...validateEmpireTianlongNoDoctrine(battlefleet, entries))
        }
    }
    return issues
}

function validateBattlefleet(
    battlefleet: ArmyBattlefleet,
    definition: BattlefleetDefinition,
    entries: ArmyUnit[],
    units: Unit[],
): BattlefleetIssue[] {
    const issues: BattlefleetIssue[] = []
    const result = solveElementCounts(definition, entries, units)

    for (const entry of result.unassigned) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            unitInstanceId: entry.instanceId,
            message: `${unitLabel(units, entry)} does not match any element in ${battlefleetLabel(battlefleet, definition)}.`,
        })
    }

    for (const element of definition.elements) {
        const count = result.counts[element.id] ?? 0
        if (count < element.min) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleetLabel(battlefleet, definition)} needs ${element.name}; currently ${count}/${element.min}.`,
            })
        }
        if (count > element.max) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleetLabel(battlefleet, definition)} has too many units in ${element.name}; currently ${count}/${element.max}.`,
            })
        }
    }

    if (!result.valid && result.unassigned.length === 0) {
        issues.push({
            severity: 'error',
            battlefleetInstanceId: battlefleet.instanceId,
            message: `${battlefleetLabel(battlefleet, definition)} units cannot be arranged into the available element limits.`,
        })
    }

    issues.push(...validateFlagshipLimit(definition, battlefleet, entries, units))
    issues.push(...validateAttachmentRelations(battlefleet, entries, units))
    issues.push(...validateSubfactionSelections(battlefleet, entries, units))
    issues.push(...validateDuplicateClasses(definition, battlefleet, entries, units))
    issues.push(...validateSpecialRules(definition, battlefleet, entries, units))

    return issues
}

function validateUniqueUnits(list: ArmyList, units: Unit[]): BattlefleetIssue[] {
    const counts = new Map<string, { unit: Unit; count: number }>()
    for (const entry of flattenUnits(list.units)) {
        const unit = findUnit(units, entry)
        if (!unit || !hasTrait(unit, 'Unique')) continue
        const current = counts.get(unit.id) ?? { unit, count: 0 }
        counts.set(unit.id, { unit, count: current.count + 1 })
    }

    return [...counts.values()].flatMap(({ unit, count }) =>
        count > 1
            ? [
                  {
                      severity: 'error' as const,
                      message: `${unit.name} is Unique and can only be included once in a Force.`,
                  },
              ]
            : [],
    )
}

export function validateBattlefleetOrganisation(
    list: ArmyList | null,
    units: Unit[],
    definitions: BattlefleetDefinition[],
): BattlefleetIssue[] {
    if (!list) return []

    const issues: BattlefleetIssue[] = []
    const availableDefinitions = definitions.filter((definition) =>
        isBattlefleetAvailableForFaction(definition, list.faction_id),
    )
    const definitionById = new Map(availableDefinitions.map((definition) => [definition.id, definition]))
    const battlefleets = list.battlefleets ?? []

    if (battlefleets.length === 0) {
        issues.push({
            severity: 'error',
            message:
                list.units.length > 0
                    ? 'Add at least one Battlefleet and assign every unit to it.'
                    : 'A Force must contain at least one Main Battlefleet.',
        })
    }

    const knownBattlefleets = battlefleets.flatMap((battlefleet) => {
        const definition = definitionById.get(battlefleet.definitionId)
        if (!definition) {
            issues.push({
                severity: 'error',
                battlefleetInstanceId: battlefleet.instanceId,
                message: `${battlefleet.name} is not available in this faction ORBAT.`,
            })
            return []
        }
        return [{ battlefleet, definition }]
    })

    const hasEmpireZhanmadao = knownBattlefleets.some(
        ({ definition }) => definition.id === EMPIRE_ZHANMADAO_BATTLEFLEET_ID,
    )
    const mainCount = knownBattlefleets.filter(
        ({ definition }) => getBattlefleetForceType(definition, list.faction_id) === 'main',
    ).length
    const specialistCount = knownBattlefleets.filter(
        ({ definition }) =>
            getBattlefleetForceType(definition, list.faction_id) === 'specialist' &&
            !(
                definition.specialRules?.includes('mercenary-does-not-count') &&
                !isMercenaryInForce(definition, list.faction_id)
            ) &&
            !(definition.id === EMPIRE_GWISIN_BATTLEFLEET_ID && hasEmpireZhanmadao),
    ).length
    const mercenaryCount = knownBattlefleets.filter(({ definition }) =>
        isMercenaryInForce(definition, list.faction_id),
    ).length
    if (knownBattlefleets.length > 0 && mainCount === 0) {
        issues.push({ severity: 'error', message: 'A Force must contain at least one Main Battlefleet.' })
    }
    if (mercenaryCount > 1) {
        issues.push({
            severity: 'error',
            message: `A Force can contain only one Mercenary Battlefleet (${mercenaryCount} selected).`,
        })
    }
    if (specialistCount > mainCount) {
        issues.push({
            severity: 'error',
            message: `A Force cannot contain more Specialist Battlefleets than Main Battlefleets (${specialistCount}/${mainCount}).`,
        })
    }

    const legendaryCounts = new Map<string, { name: string; count: number }>()
    for (const { definition } of knownBattlefleets) {
        if (!definition.legendary) continue
        const current = legendaryCounts.get(definition.id) ?? { name: definition.name, count: 0 }
        legendaryCounts.set(definition.id, { ...current, count: current.count + 1 })
    }
    for (const { name, count } of legendaryCounts.values()) {
        if (count > 1) {
            issues.push({
                severity: 'error',
                message: `${name} is Legendary and can only be included once in a Force.`,
            })
        }
    }

    const battlefleetIds = new Set(battlefleets.map((battlefleet) => battlefleet.instanceId))
    for (const entry of list.units) {
        if (!entry.battlefleetInstanceId || !battlefleetIds.has(entry.battlefleetInstanceId)) {
            issues.push({
                severity: 'error',
                unitInstanceId: entry.instanceId,
                message: `${unitLabel(units, entry)} must be assigned to a Battlefleet.`,
            })
        }
    }

    for (const { battlefleet, definition } of knownBattlefleets) {
        const entries = list.units.filter((entry) => entry.battlefleetInstanceId === battlefleet.instanceId)
        issues.push(...validateBattlefleet(battlefleet, definition, entries, units))
    }

    issues.push(...validateUniqueUnits(list, units))

    return issues
}

export function getBattlefleetDefinitionsForFaction(
    definitions: BattlefleetDefinition[],
    factionId: string | null | undefined,
): BattlefleetDefinition[] {
    return factionId ? definitions.filter((definition) => isBattlefleetAvailableForFaction(definition, factionId)) : []
}
