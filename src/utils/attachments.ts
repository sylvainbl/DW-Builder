import type { Unit } from '../types/index'

const POSITIONAL_TRAITS = new Set(['surface', 'airborne', 'underwater'])

export function getMinimumModelsForUnit(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

export function getMaximumModelsForUnit(unit: Unit): number {
    return Math.max(getMinimumModelsForUnit(unit), unit.max ?? (typeof unit.models === 'number' ? unit.models : getMinimumModelsForUnit(unit)))
}

export function getAttachmentKeyword(unit: Unit): string | null {
    const attachmentProperty = unit.properties.find((property) => property.name === 'Attachment')
    return attachmentProperty?.detail ?? (unit.attachment?.parent_traits.length ? unit.attachment.parent_traits.join(', ') : null)
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
}

function getUnitTraits(unit: Unit, tags: string[] = unit.tags): string[] {
    return [unit.name, unit.sub_name, unit.role, ...tags].map((trait) => trait.toLowerCase())
}

type AttachmentRequirement = string[]

function parseAttachmentRequirement(rawRequirement: string): AttachmentRequirement[] {
    return rawRequirement
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => part
            .split('/')
            .map((option) => option.trim())
            .filter(Boolean))
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

function parentMatchesTrait(parentTraits: string[], requiredTrait: string): boolean {
    const normalized = requiredTrait.toLowerCase()
    if (parentTraits.includes(normalized)) return true
    const words = normalized.split(/\s+/).filter(Boolean)
    return words.length > 1 && words.every((word) => parentTraits.includes(word))
}

function hasMatchingPositionalTrait(attachmentTags: string[], parentTags: string[]): boolean {
    const attachmentPositions = getPositionalTraits(attachmentTags)
    const parentPositions = getPositionalTraits(parentTags)
    if (attachmentPositions.length === 0 || parentPositions.length === 0) return false
    return attachmentPositions.some((trait) => parentPositions.includes(trait))
}

export function canAttachToParent(
    attachment: Unit,
    parent: Unit,
    tags: { attachmentTags?: string[]; parentTags?: string[] } = {},
): boolean {
    if (attachment.faction_id !== parent.faction_id || attachment.id === parent.id) return false
    const attachmentTags = tags.attachmentTags ?? attachment.tags
    const parentTags = tags.parentTags ?? parent.tags
    if (!hasMatchingPositionalTrait(attachmentTags, parentTags)) return false
    const requirements = getAttachmentRequirements(attachment)
    if (requirements.length === 0) return false
    const parentTraits = getUnitTraits(parent, parentTags)
    return requirements.every((requirement) => (
        requirement.some((requiredTrait) => parentMatchesTrait(parentTraits, requiredTrait))
    ))
}
