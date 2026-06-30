import type { ShortRangeSquadron, Unit } from '../types/index'

function singularizeLastWord(value: string): string {
    const words = value.split(' ')
    const lastWord = words.at(-1)
    if (!lastWord || lastWord.length <= 3) return value

    if (lastWord.endsWith('ies')) {
        words[words.length - 1] = `${lastWord.slice(0, -3)}y`
    } else if (lastWord.endsWith('s')) {
        words[words.length - 1] = lastWord.slice(0, -1)
    }

    return words.join(' ')
}

function normalizeSrsTypeName(value: string): string {
    return singularizeLastWord(
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim(),
    )
}

export function getSrsTypeNames(unit: Unit): string[] {
    const srsProperty = unit.properties.find((property) => property.name === 'SRS')
    return srsProperty?.detail
        ?.split(/[,/]/)
        .map((name) => name.trim())
        .filter(Boolean) ?? []
}

export function getVisibleSrsSquadrons(unit: Unit): ShortRangeSquadron[] {
    const srsTypeNames = getSrsTypeNames(unit)
    const normalizedTypes = new Set(srsTypeNames.map(normalizeSrsTypeName))

    return unit.short_range_squadrons?.filter((squadron) => (
        srsTypeNames.length === 0 || normalizedTypes.has(normalizeSrsTypeName(squadron.name))
    )) ?? []
}
