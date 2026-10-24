import type { UnitConfig } from '../types/index'

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
    if (id === 'commonwealth_morozko') return 'commonwealth_norilsk'
    if (id.startsWith('Alliance_')) return `alliance_${id.slice('Alliance_'.length)}`
    if (id.startsWith('Crown_')) return `crown_${id.slice('Crown_'.length)}`
    if (id.startsWith('Imperium_')) return `imperium_${id.slice('Imperium_'.length)}`
    if (id.startsWith('Empire_')) return `empire_${id.slice('Empire_'.length)}`
    return id
}

export function migrateCommonwealthConfig(unitId: string, config: UnitConfig): UnitConfig {
    if (unitId.startsWith('commonwealth_') && config.optionQuantities.DEFENSIVE_MINES) {
        const { DEFENSIVE_MINES: mines, ...quantities } = config.optionQuantities
        config = { ...config, optionQuantities: { ...quantities, COMMONWEALTH_DEFENSIVE_MINES: mines } }
    }
    if (unitId !== 'commonwealth_morozko') return config
    const { KHATANGA_BREACHING_DRILL: drill, ...quantities } = config.optionQuantities
    return {
        ...config,
        optionQuantities: {
            ...quantities,
            CRYO_GENERATOR: 1,
            COMMONWEALTH_SUBFACTION_RUSSIAN: 1,
            ...(drill ? { SEMYENOV_ASSAULT_BORE: 1 } : {}),
        },
    }
}

export function migrateOrbatConfig(unitId: string, config: UnitConfig, modelConfigs: UnitConfig[] = []): UnitConfig {
    config = migrateCommonwealthConfig(unitId, config)
    const normalizedUnitId = normalizeLegacyUnitId(unitId)
    const faction = normalizedUnitId.startsWith('crown_')
        ? 'CROWN'
        : normalizedUnitId.startsWith('commonwealth_')
          ? 'COMMONWEALTH'
          : null
    if (!faction) return config
    const tag = `${faction}_DEFENSIVE_MINES`
    const hasMines = [config, ...modelConfigs].some(
        (item) => (item.optionQuantities.DEFENSIVE_MINES ?? 0) > 0 || (item.optionQuantities[tag] ?? 0) > 0,
    )
    if (!hasMines) return config
    const quantities = { ...config.optionQuantities }
    delete quantities.DEFENSIVE_MINES
    return { ...config, optionQuantities: { ...quantities, [tag]: 1 } }
}

export function clearOrbatModelMines(unitId: string, config: UnitConfig): UnitConfig {
    if (!unitId.startsWith('crown_') && !unitId.startsWith('commonwealth_')) return config
    const quantities = { ...config.optionQuantities }
    delete quantities.DEFENSIVE_MINES
    delete quantities.CROWN_DEFENSIVE_MINES
    delete quantities.COMMONWEALTH_DEFENSIVE_MINES
    return { ...config, optionQuantities: quantities }
}
