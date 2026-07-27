export function selectStoredListsValue(current: string | null, legacy: string | null): string | null {
    return current !== null ? current : legacy
}

export function normalizeLegacyFactionId(id: string): string {
    if (id === 'Alliance') return 'alliance'
    if (id === 'Crown') return 'crown'
    if (id === 'Imperium') return 'imperium'
    if (id === 'Empire') return 'empire'
    if (id === 'Enlighted' || id === 'enlighted' || id === 'Enlightened') return 'enlightened'
    return id
}

export function normalizeLegacyUnitId(id: string): string {
    if (id.startsWith('Alliance_')) return `alliance_${id.slice('Alliance_'.length)}`
    if (id.startsWith('Crown_')) return `crown_${id.slice('Crown_'.length)}`
    if (id.startsWith('Imperium_')) return `imperium_${id.slice('Imperium_'.length)}`
    if (id.startsWith('Empire_')) return `empire_${id.slice('Empire_'.length)}`
    return id
}
