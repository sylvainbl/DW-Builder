import type { ArmyUnit, Glossary, NamedValue, Unit, UnitConfig, Weapon } from '../types/index'
import { getFactionSpecialRules } from './factionSpecialRules'
import { getEffectiveGeneratorSelection, getSelectedOptionRuleEffects, getSelectedRemovedWeaponNames } from './optionRuleEffects'
import { getVisibleSrsSquadrons } from './srs'

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

function getDisplayedWeapon(unit: Unit, weapon: Weapon, weaponIndex: number, config: UnitConfig): Weapon {
    const selectedName = config.hardpointSelections[weaponIndex] ?? weapon.name
    const options = weapon.slot ? unit.hardpoint_options?.[weapon.slot] ?? [] : []
    return options.find((option) => option.name === selectedName) ?? weapon
}

function addSrsProperties(ruleNames: Record<GlossaryCategory, Set<string>>, unit: Unit) {
    for (const squadron of getVisibleSrsSquadrons(unit)) {
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
        const generatorSelection = getEffectiveGeneratorSelection(unit, config, entry.config)
        if (generatorSelection) {
            ruleNames.systems.add(generatorSelection.generatorName)
        }

        addNamedValues(ruleNames.systems, getFactionSpecialRules(unit, generatorSelection?.generatorName ?? null))

        const removedWeaponNames = getSelectedRemovedWeaponNames(unit, config, entry.config)
        unit.weapons.forEach((weapon, weaponIndex) => {
            if (removedWeaponNames.has(weapon.name)) return
            if (generatorSelection?.weaponIndex === weaponIndex) return
            addNamedValues(ruleNames.qualities, getDisplayedWeapon(unit, weapon, weaponIndex, config).qualities)
        })

        const optionRuleEffects = getSelectedOptionRuleEffects(unit, config, entry.config)
        addNamedValues(ruleNames.properties, optionRuleEffects.properties)
        addNamedValues(ruleNames.systems, optionRuleEffects.systems)
        addNamedValues(ruleNames.qualities, optionRuleEffects.qualities)
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
