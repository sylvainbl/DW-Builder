import type { Generator } from '../types/index'

export function getGeneratorsForFaction(generators: Record<string, Generator[]>, factionId: string): Generator[] {
    return generators[factionId] ?? []
}
