import type { ArmyUnit, Glossary, NamedValue, OptionUpgrade, Unit, UnitConfig, Weapon } from '../types/index'
import { getFactionSpecialRules } from './factionSpecialRules'
import { isUnitLevelOption } from './pointsCalc'

export type GlossaryCategory = 'systems' | 'properties' | 'qualities'

export interface ListGlossaryRule {
    name: string
    text: string | null
}

export type ListGlossary = Record<GlossaryCategory, ListGlossaryRule[]>

const categories: GlossaryCategory[] = ['systems', 'properties', 'qualities']

function emptyRuleSets(): Record<GlossaryCategory, Set<string>> {
    return {
        systems: new Set<string>(),
        properties: new Set<string>(),
        qualities: new Set<string>(),
    }
}

function addNamedValues(target: Set<string>, values: NamedValue[] | undefined) {
    for (const value of values ?? []) {
        target.add(value.name)
    }
}

function optionConfig(entry: ArmyUnit, modelConfig: UnitConfig, option: OptionUpgrade): UnitConfig {
    return isUnitLevelOption(option.tag) ? entry.config : modelConfig
}

function addOptionChoiceRules(ruleNames: Record<GlossaryCategory, Set<string>>, choice: unknown) {
    if (typeof choice !== 'object' || choice === null) return

    const structuredChoice = choice as {
        adds_systems?: NamedValue[]
        adds_properties?: NamedValue[]
        adds_qualities?: NamedValue[]
    }
    addNamedValues(ruleNames.systems, structuredChoice.adds_systems)
    addNamedValues(ruleNames.properties, structuredChoice.adds_properties)
    addNamedValues(ruleNames.qualities, structuredChoice.adds_qualities)
}

function getDisplayedWeapon(unit: Unit, weapon: Weapon, weaponIndex: number, config: UnitConfig): Weapon {
    const selectedName = config.hardpointSelections[weaponIndex] ?? weapon.name
    const options = weapon.slot ? unit.hardpoint_options?.[weapon.slot] ?? [] : []
    return options.find((option) => option.name === selectedName) ?? weapon
}

function addSrsProperties(ruleNames: Record<GlossaryCategory, Set<string>>, unit: Unit) {
    const srsProperty = unit.properties.find((property) => property.name === 'SRS')
    const srsTypeNames = srsProperty?.detail
        ?.split(/[,/]/)
        .map((name) => name.trim())
        .filter(Boolean) ?? []
    const visibleSquadrons = unit.short_range_squadrons?.filter((squadron) => (
        srsTypeNames.length === 0 || srsTypeNames.includes(squadron.name)
    )) ?? []

    for (const squadron of visibleSquadrons) {
        addNamedValues(ruleNames.properties, squadron.properties)
    }
}

function addEntryRules(ruleNames: Record<GlossaryCategory, Set<string>>, entry: ArmyUnit, unitsById: Map<string, Unit>) {
    const unit = unitsById.get(entry.unitId)
    if (!unit) return

    addNamedValues(ruleNames.properties, unit.properties)
    addNamedValues(ruleNames.systems, unit.systems)
    addSrsProperties(ruleNames, unit)

    const modelConfigs = entry.models.length > 0
        ? entry.models.map((model) => model.config)
        : [entry.config]

    for (const config of modelConfigs) {
        if (config.generatorSelection) {
            ruleNames.systems.add(config.generatorSelection.generatorName)
        }

        addNamedValues(ruleNames.systems, getFactionSpecialRules(unit, config.generatorSelection?.generatorName ?? null))

        unit.weapons.forEach((weapon, weaponIndex) => {
            if (config.generatorSelection?.weaponIndex === weaponIndex) return
            addNamedValues(ruleNames.qualities, getDisplayedWeapon(unit, weapon, weaponIndex, config).qualities)
        })

        for (const option of unit.options_and_upgrades) {
            const quantity = optionConfig(entry, config, option).optionQuantities[option.tag] ?? 0
            if (quantity <= 0) continue
            for (const choice of option.choices ?? []) {
                addOptionChoiceRules(ruleNames, choice)
            }
        }
    }

    for (const attachment of entry.attachedUnits ?? []) {
        addEntryRules(ruleNames, attachment, unitsById)
    }
}

export function getListGlossary(entries: ArmyUnit[], units: Unit[], glossary: Glossary | null): ListGlossary {
    const unitsById = new Map(units.map((unit) => [unit.id, unit]))
    const ruleNames = emptyRuleSets()

    for (const entry of entries) {
        addEntryRules(ruleNames, entry, unitsById)
    }

    return Object.fromEntries(categories.map((category) => [
        category,
        Array.from(ruleNames[category])
            .sort((a, b) => a.localeCompare(b))
            .map((name) => ({
                name,
                text: glossary?.[category]?.[name] ?? null,
            })),
    ])) as ListGlossary
}

export function getListGlossaryCount(glossary: ListGlossary): number {
    return categories.reduce((sum, category) => sum + glossary[category].length, 0)
}
