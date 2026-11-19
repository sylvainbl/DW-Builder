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
    const retiredImperium: Record<string, string> = {
        imperium_elector_battleship_sekundar_configuration: 'imperium_elector_battleship_primar_configuration',
        imperium_sms_brandenburg: 'imperium_elector_battleship_primar_configuration',
        imperium_nachtsturm_flak_frigate: 'imperium_arminius_frigate',
        imperium_toten_heavy_destroyer: 'imperium_sigimer_destroyer',
        imperium_malus_flak_destroyer: 'imperium_sigimer_destroyer',
    }
    if (retiredImperium[id]) return retiredImperium[id]
    if (id === 'commonwealth_morozko') return 'commonwealth_norilsk'
    if (id.startsWith('Alliance_')) return `alliance_${id.slice('Alliance_'.length)}`
    if (id.startsWith('Crown_')) return `crown_${id.slice('Crown_'.length)}`
    if (id.startsWith('Imperium_')) return normalizeLegacyUnitId(`imperium_${id.slice('Imperium_'.length)}`)
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
    if (normalizedUnitId.startsWith('imperium_')) {
        if (config.orbatVersion !== '4.01 BETA') {
            const prussian = [
                'arminius_frigate',
                'augustus_bombardment_cruiser',
                'blucher_cruiser',
                'konrad_support_carrier',
                'reiter_flak_cruiser',
                'schaumburg_escort_cruiser',
                'sigimer_destroyer',
            ].some((suffix) => normalizedUnitId === `imperium_${suffix}`)
            const subfaction = [
                'imperium_nachtsturm_flak_frigate',
                'imperium_toten_heavy_destroyer',
                'imperium_volsung_cruiser',
            ].includes(unitId)
                ? 'TEUTONIC'
                : prussian
                  ? 'PRUSSIAN'
                  : unitId === 'imperium_fenrir_submarine'
                    ? 'SCANDINAVIAN'
                    : unitId === 'imperium_maximilian_aerial_linebreaker'
                      ? 'BAVARIAN'
                      : null
            if (
                subfaction &&
                !Object.keys(config.optionQuantities).some(
                    (tag) => tag.startsWith('IMPERIUM_SUBFACTION_') && config.optionQuantities[tag],
                )
            )
                config = {
                    ...config,
                    optionQuantities: { ...config.optionQuantities, [`IMPERIUM_SUBFACTION_${subfaction}`]: 1 },
                }
            const renameWeapon = (name: string) =>
                name
                    .replace('Advanced Sturmbringer', 'Sturmbringer')
                    .replace('Auto-Targeting', 'Auto-Targetting')
                    .replace('Voltaic Gun Battery', 'Voltgun Battery')
                    .replace('Guided Erderschutterer Rocket Battery', 'Guided Light Erderschütterer Rockets')
                    .replace('Erderschutterer Rocket Battery', 'Light Erderschütterer Rockets')
                    .replace('Stromschlag Rocket Battery', 'Heavy Erderschütterer Rockets')
                    .replace('Nassau Heavy Bombard', 'Bertha Heavy Bombard')
                    .replace('Super Heavy Bombardment Array', 'Super Heavy Gustav Array')
                    .replace('Super Heavy Voltaic Array', 'Super Heavy Voltgun Array')
            const newIndex = (index: number) => {
                if (normalizedUnitId === 'imperium_elector_battleship_primar_configuration')
                    return index === 3 ? 4 : index === 4 ? 3 : index
                if (normalizedUnitId === 'imperium_stark_imperium_skyfortress' && index === 3) return 2
                if (normalizedUnitId === 'imperium_kriegsturm_assault_airship' && index === 0) return 1
                return index
            }
            config = {
                ...config,
                orbatVersion: '4.01 BETA',
                hardpointSelections: Object.fromEntries(
                    Object.entries(config.hardpointSelections).map(([index, name]) => [
                        newIndex(Number(index)),
                        renameWeapon(name),
                    ]),
                ),
                generatorSelection: config.generatorSelection
                    ? { ...config.generatorSelection, weaponIndex: newIndex(config.generatorSelection.weaponIndex) }
                    : null,
                ...(config.generatorSelections
                    ? {
                          generatorSelections: config.generatorSelections.map((selection) => ({
                              ...selection,
                              weaponIndex: newIndex(selection.weaponIndex),
                          })),
                      }
                    : {}),
            }
        }
        const quantities = { ...config.optionQuantities }
        if (
            [config, ...modelConfigs].some(
                (item) =>
                    (item.optionQuantities.FLAGSHIP_VARIANT ?? item.optionQuantities.IMPERIUM_FLAGSHIP_VARIANT ?? 0) >
                    0,
            )
        ) {
            quantities.IMPERIUM_FLAGSHIP_VARIANT = 1
            delete quantities.FLAGSHIP_VARIANT
        }
        const models = [config, ...modelConfigs]
        if (
            models.some(
                (item) =>
                    (item.optionQuantities.DEFENSIVE_MINES ?? item.optionQuantities.IMPERIUM_DEFENSIVE_MINES ?? 0) > 0,
            )
        ) {
            quantities.IMPERIUM_DEFENSIVE_MINES = 1
            delete quantities.DEFENSIVE_MINES
        }
        if (models.some((item) => (item.optionQuantities.TEUTONIC_VARIANT ?? 0) > 0)) {
            quantities.IMPERIUM_SUBFACTION_TEUTONIC = 1
            delete quantities.IMPERIUM_SUBFACTION_PRUSSIAN
            delete quantities.IMPERIUM_SUBFACTION_BAVARIAN
            if (modelConfigs.length > 0) delete quantities.TEUTONIC_VARIANT
        }
        const doctrine = config.fleetDoctrineSelection
        config = {
            ...config,
            optionQuantities: quantities,
            fleetDoctrineSelection: doctrine
                ? {
                      ...doctrine,
                      doctrineName:
                          doctrine.doctrineName === 'Chain of Command' ? 'Peerless Discipline' : doctrine.doctrineName,
                      doctrineCost: doctrine.doctrineName === 'Flotilla of Iron' ? 35 : doctrine.doctrineCost,
                  }
                : null,
        }
    }
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
    if (!unitId.startsWith('crown_') && !unitId.startsWith('commonwealth_') && !unitId.startsWith('imperium_'))
        return config
    const quantities = { ...config.optionQuantities }
    delete quantities.DEFENSIVE_MINES
    delete quantities.CROWN_DEFENSIVE_MINES
    delete quantities.COMMONWEALTH_DEFENSIVE_MINES
    delete quantities.IMPERIUM_DEFENSIVE_MINES
    if (unitId.startsWith('imperium_')) {
        delete quantities.TEUTONIC_VARIANT
        delete quantities.IMPERIUM_FLAGSHIP_VARIANT
        for (const tag of Object.keys(quantities)) if (tag.startsWith('IMPERIUM_SUBFACTION_')) delete quantities[tag]
    }
    return { ...config, optionQuantities: quantities }
}
