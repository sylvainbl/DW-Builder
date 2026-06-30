import type { Unit } from '../types/index'

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

function getUnitTraits(unit: Unit): string[] {
    return [unit.name, unit.sub_name, unit.role, ...unit.tags].map((trait) => trait.toLowerCase())
}

function getAttachmentRequirements(unit: Unit): string[] {
    if (unit.attachment?.parent_traits.length) return unit.attachment.parent_traits
    const keyword = getAttachmentKeyword(unit)
    if (!keyword) return []
    return keyword
        .split(',')
        .flatMap((part) => part.trim().split(/\s+/))
        .map((part) => part.trim())
        .filter(Boolean)
}

function parentMatchesTrait(parentTraits: string[], requiredTrait: string): boolean {
    const normalized = requiredTrait.toLowerCase()
    if (parentTraits.includes(normalized)) return true
    const words = normalized.split(/\s+/).filter(Boolean)
    return words.length > 1 && words.every((word) => parentTraits.includes(word))
}

export function canAttachToParent(attachment: Unit, parent: Unit): boolean {
    if (attachment.faction_id !== parent.faction_id || attachment.id === parent.id) return false
    const requirements = getAttachmentRequirements(attachment)
    if (requirements.length === 0) return false
    const parentTraits = getUnitTraits(parent)
    return requirements.every((requiredTrait) => parentMatchesTrait(parentTraits, requiredTrait))
}
