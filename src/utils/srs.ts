import type { NamedValue, ShortRangeSquadron, Unit } from '../types/index'

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
    const normalized = singularizeLastWord(
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim(),
    )

    if (normalized === 'talon autogyro') return 'talon rotor'

    return normalized
}

export function getSrsTypeNames(unit: Unit, properties: NamedValue[] = unit.properties): string[] {
    return properties
        .filter((property) => property.name === 'SRS' || property.name === 'Flight Deck')
        .flatMap(
            (property) =>
                property.detail
                    ?.split(/[,/]/)
                    .map((name) => name.trim())
                    .filter(Boolean) ?? [],
        )
}

export function getVisibleSrsSquadrons(unit: Unit, properties: NamedValue[] = unit.properties): ShortRangeSquadron[] {
    const srsTypeNames = getSrsTypeNames(unit, properties)
    const normalizedTypes = new Set(srsTypeNames.map(normalizeSrsTypeName))

    return (
        unit.short_range_squadrons?.filter(
            (squadron) => srsTypeNames.length === 0 || normalizedTypes.has(normalizeSrsTypeName(squadron.name)),
        ) ?? []
    )
}
