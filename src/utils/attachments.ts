import type { OptionUpgrade, Unit } from '../types/index'

const POSITIONAL_TRAITS = new Set(['surface', 'airborne', 'airship', 'rotorcraft', 'underwater'])
const POSITIONAL_TRAIT_ALIASES: Record<string, string> = {
    airship: 'airborne',
    rotorcraft: 'airborne',
}

export function getMinimumModelsForUnit(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

export function getMaximumModelsForUnit(unit: Unit): number {
    return Math.max(
        getMinimumModelsForUnit(unit),
        unit.max ?? (typeof unit.models === 'number' ? unit.models : getMinimumModelsForUnit(unit)),
    )
}

export function isAttachmentOption(option: Pick<OptionUpgrade, 'attachment_unit_ids'>): boolean {
    return (option.attachment_unit_ids?.length ?? 0) > 0
}

export function getAttachmentKeyword(unit: Unit): string | null {
    const attachmentProperty = unit.properties.find((property) => property.name === 'Attachment')
    return (
        attachmentProperty?.detail ??
        (unit.attachment?.parent_traits.length ? unit.attachment.parent_traits.join(', ') : null)
    )
}

export function hasAttachmentProperty(unit: Unit): boolean {
    return unit.properties.some((property) => property.name === 'Attachment') || unit.attachment != null
}

export function getAttachmentModelLimitForUnit(unit: Unit): number {
    if (unit.attachment?.max_models != null) return unit.attachment.max_models
    if (getAttachmentKeyword(unit)) return getMinimumModelsForUnit(unit)
    return getMaximumModelsForUnit(unit)
}

export function getPositionalTraits(tags: string[]): string[] {
    return tags
        .map((tag) => tag.toLowerCase())
        .filter((tag) => POSITIONAL_TRAITS.has(tag))
        .map((tag) => POSITIONAL_TRAIT_ALIASES[tag] ?? tag)
}

function getUnitTraits(unit: Unit, tags: string[] = unit.tags): string[] {
    return [unit.name, unit.sub_name, unit.role, ...tags]
        .filter((trait): trait is string => typeof trait === 'string' && trait.trim().length > 0)
        .map((trait) => trait.toLowerCase())
}

type AttachmentRequirement = string[]

function parseAttachmentRequirement(rawRequirement: string): AttachmentRequirement[] {
    return rawRequirement
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) =>
            part
                .split('/')
                .map((option) => option.trim())
                .filter(Boolean),
        )
        .filter((options) => options.length > 0)
}

function getAttachmentRequirements(unit: Unit): AttachmentRequirement[] {
    if (unit.attachment?.parent_traits.length) {
        return unit.attachment.parent_traits.flatMap(parseAttachmentRequirement)
    }
    const keyword = getAttachmentKeyword(unit)
    if (!keyword) return []
    return parseAttachmentRequirement(keyword)
}

function getParentAttachmentTargetIds(parent: Unit): Set<string> {
    return new Set(
        parent.options_and_upgrades
            .filter((option) => option.max !== 0)
            .flatMap((option) => option.attachment_unit_ids ?? []),
    )
}

function parentMatchesTrait(parentTraits: string[], requiredTrait: string): boolean {
    const normalized = requiredTrait.toLowerCase()
    if (parentTraits.includes(normalized)) return true
    const words = normalized.split(/\s+/).filter(Boolean)
    return words.length > 1 && words.every((word) => parentTraits.includes(word))
}

function parentMatchesExplicitEligibility(attachment: Unit, parent: Unit, parentTraits: string[]): boolean | null {
    const branches = attachment.attachment?.eligibility?.anyOf
    if (!branches?.length) return null

    return branches.some((branch) => {
        const tagMatch = branch.allOfTags?.every((tag) => parentMatchesTrait(parentTraits, tag)) ?? true
        const unitMatch = branch.parentUnitIds?.includes(parent.id) ?? true
        return tagMatch && unitMatch
    })
}

function hasMatchingPositionalTrait(attachmentTags: string[], parentTags: string[]): boolean {
    const attachmentPositions = getPositionalTraits(attachmentTags)
    const parentPositions = getPositionalTraits(parentTags)
    if (attachmentPositions.length === 0 || parentPositions.length === 0) return false
    return attachmentPositions.some((trait) => parentPositions.includes(trait))
}

export type AttachmentEligibilityFailure =
    'different-faction' | 'same-unit' | 'parent-is-attachment' | 'positional-trait' | 'parent-option' | 'parent-traits'

export function getAttachmentEligibilityFailure(
    attachment: Unit,
    parent: Unit,
    tags: { attachmentTags?: string[]; parentTags?: string[] } = {},
): AttachmentEligibilityFailure | null {
    if (attachment.faction_id !== parent.faction_id) return 'different-faction'
    if (attachment.id === parent.id) return 'same-unit'
    if (hasAttachmentProperty(parent)) return 'parent-is-attachment'
    const attachmentTags = tags.attachmentTags ?? attachment.tags
    const parentTags = tags.parentTags ?? parent.tags
    if (!hasMatchingPositionalTrait(attachmentTags, parentTags)) return 'positional-trait'
    const parentAttachmentTargetIds = getParentAttachmentTargetIds(parent)
    if (parentAttachmentTargetIds.size > 0 && !parentAttachmentTargetIds.has(attachment.id)) return 'parent-option'
    const parentTraits = getUnitTraits(parent, parentTags)
    const explicitEligibility = parentMatchesExplicitEligibility(attachment, parent, parentTraits)
    if (explicitEligibility != null) return explicitEligibility ? null : 'parent-traits'
    const requirements = getAttachmentRequirements(attachment)
    if (requirements.length === 0) return 'parent-traits'
    return requirements.every((requirement) =>
        requirement.some((requiredTrait) => parentMatchesTrait(parentTraits, requiredTrait)),
    )
        ? null
        : 'parent-traits'
}

export function canAttachToParent(
    attachment: Unit,
    parent: Unit,
    tags: { attachmentTags?: string[]; parentTags?: string[] } = {},
): boolean {
    return getAttachmentEligibilityFailure(attachment, parent, tags) == null
}
