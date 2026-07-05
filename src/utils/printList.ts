import type { ArmyBattlefleet, ArmyList, ArmyModel, ArmyUnit, BattlefleetDefinition, Glossary, NamedValue, OptionUpgrade, Unit, UnitConfig, Weapon } from '../types/index'
import { getBattlefleetAddedProperties, getBattlefleetAddedSystems } from './battlefleetEffects'
import { getBattlefleetForceType, isMercenaryInForce, sortBattlefleetEntries } from './battlefleets'
import { getFactionSpecialRules } from './factionSpecialRules'
import { formatOptionName, getEffectiveGeneratorSelections, getSelectedOptionRuleEffects, getSelectedRemovedWeaponNames, mergeNamedValues } from './optionRuleEffects'
import { computeModelPoints, computeOptionPoints, hasChitaSwarmEscortDiscount, type PointsContext } from './pointsCalc'
import { getVisibleSrsSquadrons } from './srs'

type RuleCategory = 'properties' | 'systems' | 'qualities'

interface RuleReference {
    category: RuleCategory
    name: string
    value?: number | null
}

interface PrintableModel {
    label: string
    points: number
    config: UnitConfig
}

interface PrintContext extends PointsContext {
    list: ArmyList
    battlefleetDefinitions: BattlefleetDefinition[]
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderMarkdown(text: string): string {
    return escapeHtml(text)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph
            .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/gs, '<em>$1</em>')
            .replace(/\n/g, '<br />'))
        .map((paragraph) => `<p>${paragraph}</p>`)
        .join('')
}

function formatRuleName(rule: NamedValue): string {
    const label = rule.value == null ? rule.name : `${rule.name} ${rule.value}`
    return rule.detail ? `${label} (${rule.detail})` : label
}

function formatValue(value: number | string | null | undefined): string {
    return value == null ? '-' : String(value)
}

function ruleKey(category: RuleCategory, name: string): string {
    return `${category}:${name}`
}

function addRule(ruleMap: Map<string, RuleReference>, category: RuleCategory, rule: NamedValue): void {
    ruleMap.set(ruleKey(category, rule.name), {
        category,
        name: rule.name,
        value: rule.value,
    })
}

function selectedWeapon(unit: Unit, model: ArmyModel, index: number, weapon: Weapon): Weapon {
    const selectedName = model.config.hardpointSelections[index] ?? weapon.name
    const options = weapon.slot && !weapon.hardpoint_locked ? unit.hardpoint_options?.[weapon.slot] ?? [] : []
    return options.find((option) => option.name === selectedName) ?? weapon
}

function optionRows(unit: Unit, config: UnitConfig, discountFirstEscort = false): Array<{ option: OptionUpgrade; quantity: number; points: number | null }> {
    return unit.options_and_upgrades.map((option) => {
        const quantity = config.optionQuantities[option.tag] ?? 0
        return {
            option,
            quantity,
            points: computeOptionPoints(option, quantity, discountFirstEscort),
        }
    })
}

function printableModels(unit: Unit, entry: ArmyUnit): PrintableModel[] {
    return entry.models.map((model, index) => ({
        label: model.customName?.trim() || `Model ${index + 1}`,
        points: computeModelPoints(unit, model.config, entry.config),
        config: model.config,
    }))
}

function collectRulesForModel(unit: Unit, model: ArmyModel, entryConfig: UnitConfig, ruleMap: Map<string, RuleReference>): void {
    const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entryConfig)
    for (const generatorSelection of generatorSelections) {
        addRule(ruleMap, 'systems', {
            name: generatorSelection.generatorName,
            value: null,
        })
    }

    const removedWeaponNames = getSelectedRemovedWeaponNames(unit, model.config, entryConfig)
    for (const weapon of unit.weapons) {
        if (removedWeaponNames.has(weapon.name)) continue
        const index = unit.weapons.indexOf(weapon)
        if (generatorSelections.some((generatorSelection) => generatorSelection.weaponIndex === index)) continue
        const displayWeapon = selectedWeapon(unit, model, index, weapon)
        for (const quality of displayWeapon.qualities) {
            addRule(ruleMap, 'qualities', quality)
        }
    }

    for (const squadron of visibleSrsSquadrons(unit)) {
        for (const property of squadron.properties) {
            addRule(ruleMap, 'properties', property)
        }
    }
}

function selectedModelRuleEffects(unit: Unit, entry: ArmyUnit): { properties: NamedValue[]; systems: NamedValue[]; qualities: NamedValue[]; removedProperties: Set<string>; removedSystems: Set<string> } {
    return entry.models.reduce((effects, model) => {
        const modelEffects = getSelectedOptionRuleEffects(unit, model.config, entry.config)
        for (const propertyName of modelEffects.removedProperties) {
            effects.removedProperties.add(propertyName)
        }
        for (const systemName of modelEffects.removedSystems) {
            effects.removedSystems.add(systemName)
        }
        return {
            properties: mergeNamedValues(effects.properties, modelEffects.properties),
            systems: mergeNamedValues(effects.systems, modelEffects.systems),
            qualities: mergeNamedValues(effects.qualities, modelEffects.qualities),
            removedProperties: effects.removedProperties,
            removedSystems: effects.removedSystems,
        }
    }, { properties: [], systems: [], qualities: [], removedProperties: new Set<string>(), removedSystems: new Set<string>() } as { properties: NamedValue[]; systems: NamedValue[]; qualities: NamedValue[]; removedProperties: Set<string>; removedSystems: Set<string> })
}

function displayedProperties(unit: Unit, entry: ArmyUnit, units: Unit[], context?: PrintContext): NamedValue[] {
    const effects = selectedModelRuleEffects(unit, entry)
    return mergeNamedValues(
        unit.properties.filter((property) => !effects.removedProperties.has(property.name)),
        effects.properties,
        getBattlefleetAddedProperties(context?.list, context?.battlefleetDefinitions ?? [], units, entry),
    )
}

function displayedSystems(unit: Unit, entry: ArmyUnit, units: Unit[], context?: PrintContext): NamedValue[] {
    const selectedGeneratorSystems = entry.models.flatMap((model) => {
        const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entry.config)
        return generatorSelections.map((generatorSelection) => ({ name: generatorSelection.generatorName, value: null }))
    })
    const factionSpecialRules = entry.models.flatMap((model) => {
        const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entry.config)
        return getFactionSpecialRules(unit, generatorSelections.map((selection) => selection.generatorName))
    })
    const effects = selectedModelRuleEffects(unit, entry)
    return mergeNamedValues(
        unit.systems.filter((system) => !effects.removedSystems.has(system.name)),
        selectedGeneratorSystems,
        effects.systems,
        factionSpecialRules,
        getBattlefleetAddedSystems(context?.list, context?.battlefleetDefinitions ?? [], units, entry),
    )
}

function collectRules(unit: Unit, entry: ArmyUnit, units: Unit[], ruleMap: Map<string, RuleReference>, context?: PrintContext): void {
    for (const model of entry.models) {
        const optionRuleEffects = getSelectedOptionRuleEffects(unit, model.config, entry.config)
        for (const property of unit.properties.filter((property) => !optionRuleEffects.removedProperties.has(property.name))) addRule(ruleMap, 'properties', property)
        for (const system of unit.systems.filter((system) => !optionRuleEffects.removedSystems.has(system.name))) addRule(ruleMap, 'systems', system)
        const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entry.config)
        for (const rule of getFactionSpecialRules(unit, generatorSelections.map((selection) => selection.generatorName))) {
            addRule(ruleMap, 'systems', rule)
        }
        collectRulesForModel(unit, model, entry.config, ruleMap)
        for (const property of optionRuleEffects.properties) addRule(ruleMap, 'properties', property)
        for (const system of optionRuleEffects.systems) addRule(ruleMap, 'systems', system)
        for (const quality of optionRuleEffects.qualities) addRule(ruleMap, 'qualities', quality)
    }
    for (const property of getBattlefleetAddedProperties(context?.list, context?.battlefleetDefinitions ?? [], units, entry)) addRule(ruleMap, 'properties', property)
    for (const system of getBattlefleetAddedSystems(context?.list, context?.battlefleetDefinitions ?? [], units, entry)) addRule(ruleMap, 'systems', system)
}

function renderRuleBadges(rules: NamedValue[], category: RuleCategory): string {
    if (rules.length === 0) return '<span class="muted">None</span>'
    return rules.map((rule) => `<span class="badge ${category}">${escapeHtml(formatRuleName(rule))}</span>`).join('')
}

function renderWeaponRows(unit: Unit, config: UnitConfig): string {
    const removedWeaponNames = getSelectedRemovedWeaponNames(unit, config)
    const generatorSelections = getEffectiveGeneratorSelections(unit, config)

    return unit.weapons.flatMap((weapon, index) => {
        if (removedWeaponNames.has(weapon.name)) return []
        const generatorSelection = generatorSelections.find((selection) => selection.weaponIndex === index) ?? null
        if (generatorSelection?.weaponIndex === index) {
            return [`
                <tr>
                    <td><strong>${escapeHtml(generatorSelection.generatorName)}</strong> <span class="muted">+${generatorSelection.generatorCost} pts</span></td>
                    <td class="center">-</td>
                    <td class="center">-</td>
                    <td class="center">-</td>
                    <td class="center">-</td>
                    <td>${renderRuleBadges([{ name: 'Generator', value: null }], 'systems')}</td>
                </tr>
            `]
        }

        const displayWeapon = selectedWeapon(unit, { modelId: '', config }, index, weapon)
        const displayArc = weapon.arc ?? displayWeapon.arc ?? '-'
        return [`
            <tr>
                <td><strong>${escapeHtml(displayWeapon.name)}</strong></td>
                <td class="center">${escapeHtml(displayArc)}</td>
                <td class="center">${escapeHtml(formatValue(displayWeapon.firepower.C))}</td>
                <td class="center">${escapeHtml(formatValue(displayWeapon.firepower.S))}</td>
                <td class="center">${escapeHtml(formatValue(displayWeapon.firepower.E))}</td>
                <td>${displayWeapon.qualities.length > 0 ? renderRuleBadges(displayWeapon.qualities, 'qualities') : '<span class="muted">-</span>'}</td>
            </tr>
        `]
    }).join('')
}

function renderWeaponsTable(unit: Unit, config: UnitConfig): string {
    if (unit.weapons.length === 0) return '<div class="empty compact">No weapons.</div>'

    return `
        <table class="profile-table weapon-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th class="center">Arc</th>
                    <th class="center">C</th>
                    <th class="center">S</th>
                    <th class="center">E</th>
                    <th>Rules</th>
                </tr>
            </thead>
            <tbody>${renderWeaponRows(unit, config)}</tbody>
        </table>
    `
}

function renderOptionRows(unit: Unit, config: UnitConfig, discountFirstEscort = false): string {
    const rows = optionRows(unit, config, discountFirstEscort)
    if (rows.length === 0) return '<div class="empty compact">No options.</div>'

    return `
        <table class="profile-table option-table">
            <thead>
                <tr>
                    <th>Option</th>
                    <th>Description</th>
                    <th class="center">Qty</th>
                    <th class="center">Max</th>
                    <th class="right">Points</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(({ option, quantity, points }) => `
                    <tr>
                        <td><strong>${escapeHtml(formatOptionName(option))}</strong></td>
                        <td>${escapeHtml(option.description)}</td>
                        <td class="center">${quantity}</td>
                        <td class="center">${option.max == null ? 'Unlimited' : option.max}</td>
                        <td class="right">${points == null ? '-' : `${points} pts`}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `
}

function visibleSrsSquadrons(unit: Unit) {
    const srsProperty = unit.properties.find((property) => property.name === 'SRS')
    const hasCarrierSrs = unit.properties.some((property) => property.name === 'Carrier' || property.name === 'Underwater Carrier')

    if (!hasCarrierSrs || !srsProperty) return []

    return getVisibleSrsSquadrons(unit)
}

function renderSrsTable(unit: Unit): string {
    const squadrons = visibleSrsSquadrons(unit)
    if (squadrons.length === 0) return ''

    return `
        <div class="profile-block">
            <h4>Short Range Squadrons</h4>
            <table class="profile-table srs-table">
                <thead>
                    <tr>
                        <th>Squadron Type</th>
                        <th class="center">Atk</th>
                        <th class="center">Int</th>
                        <th class="center">Spt</th>
                        <th class="center">Res</th>
                        <th>SRS Properties</th>
                    </tr>
                </thead>
                <tbody>
                    ${squadrons.map((squadron) => `
                        <tr>
                            <td><strong>${escapeHtml(squadron.name)}</strong></td>
                            <td class="center">${squadron.attack}</td>
                            <td class="center">${squadron.intercept}</td>
                            <td class="center">${squadron.support}</td>
                            <td class="center">${squadron.resilience}</td>
                            <td>${squadron.properties.length > 0 ? renderRuleBadges(squadron.properties, 'properties') : '<span class="muted">-</span>'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `
}

function renderModelSummary(unit: Unit, models: PrintableModel[]): string {
    return models.map((model) => {
        return `
            <div class="model-line">
                <div><strong>${escapeHtml(model.label)}</strong> <span class="muted">${model.points} pts</span></div>
                <div class="profile-block">
                    <h4>Weapons</h4>
                    ${renderWeaponsTable(unit, model.config)}
                </div>
                <div class="profile-block">
                    <h4>Options & Upgrades</h4>
                    ${renderOptionRows(unit, model.config)}
                </div>
            </div>
        `
    }).join('')
}

function renderEntry(entry: ArmyUnit, units: Unit[], ruleMap: Map<string, RuleReference>, nested = false, context?: PrintContext): string {
    const unit = units.find((item) => item.id === entry.unitId)
    if (!unit) {
        return `
            <article class="unit-card ${nested ? 'attachment' : ''}">
                <div class="unit-head">
                    <div>
                        <h3>${escapeHtml(entry.unitId)}</h3>
                        <div class="muted">Unknown unit</div>
                    </div>
                    <strong>${entry.totalPoints} pts</strong>
                </div>
            </article>
        `
    }

    collectRules(unit, entry, units, ruleMap, context)
    const doctrine = entry.config.fleetDoctrineSelection
        ? `<div class="note"><strong>Fleet Doctrine:</strong> ${escapeHtml(entry.config.fleetDoctrineSelection.doctrineName)} (+${entry.config.fleetDoctrineSelection.doctrineCost} pts)</div>`
        : ''
    const discountFirstEscort = hasChitaSwarmEscortDiscount(entry, context)
    const attachments = (entry.attachedUnits ?? []).map((attachment) => renderEntry(attachment, units, ruleMap, true, context)).join('')

    return `
        <article class="unit-card ${nested ? 'attachment' : ''}">
            <div class="unit-head">
                <div>
                    <h3>${escapeHtml(unit.name)}</h3>
                    ${entry.customName ? `<div class="custom-name">${escapeHtml(entry.customName)}</div>` : ''}
                    <div class="muted">${escapeHtml([unit.sub_name, unit.role].filter(Boolean).join(' · '))}</div>
                </div>
                <strong>${entry.totalPoints} pts</strong>
            </div>
            <div class="stats">
                ${Object.entries(unit.stats).map(([key, value]) => `<span><strong>${escapeHtml(key)}</strong> ${escapeHtml(String(value))}</span>`).join('')}
            </div>
            <div class="rule-row"><strong>Properties</strong><div>${renderRuleBadges(displayedProperties(unit, entry, units, context), 'properties')}</div></div>
            <div class="rule-row"><strong>Systems</strong><div>${renderRuleBadges(displayedSystems(unit, entry, units, context), 'systems')}</div></div>
            ${doctrine}
            <div class="profile-block">
                <h4>Unit Options</h4>
                ${renderOptionRows(unit, entry.config, discountFirstEscort)}
            </div>
            <div class="model-grid">${renderModelSummary(unit, printableModels(unit, entry))}</div>
            ${renderSrsTable(unit)}
            ${attachments ? `<div class="attachments"><h4>Attachments</h4>${attachments}</div>` : ''}
        </article>
    `
}

function renderBattlefleetSection(
    battlefleet: ArmyBattlefleet,
    entries: ArmyUnit[],
    definition: BattlefleetDefinition | undefined,
    forceFactionId: string,
    units: Unit[],
    ruleMap: Map<string, RuleReference>,
    context: PrintContext,
): string {
    const points = entries.reduce((sum, entry) => sum + entry.totalPoints, 0)
    const forceType = definition ? getBattlefleetForceType(definition, forceFactionId) : null
    const mercenary = definition ? isMercenaryInForce(definition, forceFactionId) : false
    const labels = [forceType, mercenary ? 'Mercenary' : null, definition?.legendary ? 'Legendary' : null].filter(Boolean).join(' · ')
    const battlefleetName = definition?.name ?? battlefleet.name

    return `
        <section class="battlefleet">
            <div class="section-head">
                <div>
                    <h2>${escapeHtml(battlefleetName)}</h2>
                    ${battlefleet.customName ? `<div class="custom-name">${escapeHtml(battlefleet.customName)}</div>` : ''}
                    <div class="muted">${escapeHtml(labels || 'Battlefleet')}</div>
                </div>
                <strong>${points} pts</strong>
            </div>
            ${entries.length > 0 ? entries.map((entry) => renderEntry(entry, units, ruleMap, false, context)).join('') : '<div class="empty">No units assigned.</div>'}
        </section>
    `
}

function renderGlossaryCategory(title: string, rules: RuleReference[], glossary: Glossary | null): string {
    if (rules.length === 0) return ''

    return `
        <section class="glossary-category">
            <h3>${escapeHtml(title)}</h3>
            ${rules.map((rule) => {
                const text = glossary?.[rule.category]?.[rule.name] ?? null
                const label = rule.value == null ? rule.name : `${rule.name} ${rule.value}`
                return `
                    <article class="glossary-entry">
                        <h4>${escapeHtml(label)}</h4>
                        ${text ? renderMarkdown(text) : '<p class="muted">No glossary definition found.</p>'}
                    </article>
                `
            }).join('')}
        </section>
    `
}

function renderGlossary(ruleMap: Map<string, RuleReference>, glossary: Glossary | null): string {
    const rules = [...ruleMap.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
    if (rules.length === 0) return '<section class="glossary"><h2>Glossary</h2><div class="empty">No glossary rules found for this list.</div></section>'

    return `
        <section class="glossary">
            <h2>Glossary</h2>
            ${renderGlossaryCategory('Properties', rules.filter((rule) => rule.category === 'properties'), glossary)}
            ${renderGlossaryCategory('Systems', rules.filter((rule) => rule.category === 'systems'), glossary)}
            ${renderGlossaryCategory('Qualities', rules.filter((rule) => rule.category === 'qualities'), glossary)}
        </section>
    `
}

function renderPrintableList(list: ArmyList, units: Unit[], glossary: Glossary | null, battlefleetDefinitions: BattlefleetDefinition[]): string {
    const totalPoints = list.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
    const ruleMap = new Map<string, RuleReference>()
    const definitions = new Map(battlefleetDefinitions.map((definition) => [definition.id, definition]))
    const battlefleets = list.battlefleets ?? []
    const printContext = { battlefleets, list, battlefleetDefinitions }
    const assignedIds = new Set(battlefleets.map((battlefleet) => battlefleet.instanceId))
    const entriesByBattlefleetId = new Map<string, ArmyUnit[]>(battlefleets.map((battlefleet) => [battlefleet.instanceId, []]))
    const unassignedEntries: ArmyUnit[] = []

    for (const entry of list.units) {
        if (entry.battlefleetInstanceId && assignedIds.has(entry.battlefleetInstanceId)) {
            entriesByBattlefleetId.get(entry.battlefleetInstanceId)?.push(entry)
        } else {
            unassignedEntries.push(entry)
        }
    }
    for (const [battlefleetInstanceId, entries] of entriesByBattlefleetId) {
        entriesByBattlefleetId.set(battlefleetInstanceId, sortBattlefleetEntries(entries, units))
    }

    const battlefleetSections = battlefleets.map((battlefleet) => renderBattlefleetSection(
        battlefleet,
        entriesByBattlefleetId.get(battlefleet.instanceId) ?? [],
        definitions.get(battlefleet.definitionId),
        list.faction_id,
        units,
        ruleMap,
        printContext,
    ))
    const unassigned = unassignedEntries.length > 0
        ? `<section class="battlefleet"><div class="section-head"><div><h2>Unassigned</h2><div class="muted">Units without a Battlefleet</div></div><strong>${unassignedEntries.reduce((sum, entry) => sum + entry.totalPoints, 0)} pts</strong></div>${unassignedEntries.map((entry) => renderEntry(entry, units, ruleMap, false, printContext)).join('')}</section>`
        : ''

    return `
        <!doctype html>
        <html>
            <head>
                <meta charset="utf-8" />
                <title>${escapeHtml(list.name)} - Print</title>
                <style>
                    @page { margin: 14mm; }
                    * { box-sizing: border-box; }
                    body { margin: 0; color: #18181b; background: #f4f4f5; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.35; }
                    main { max-width: 980px; margin: 0 auto; padding: 24px; background: white; }
                    h1, h2, h3, h4, p { margin: 0; }
                    h1 { font-size: 28px; }
                    h2 { font-size: 17px; }
                    h3 { font-size: 14px; }
                    h4 { font-size: 12px; margin-bottom: 6px; color: #3f3f46; }
                    ul { margin: 4px 0 0 18px; padding: 0; }
                    .cover { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 18px; }
                    .total { font-size: 24px; font-weight: 800; white-space: nowrap; }
                    .muted { color: #71717a; }
                    .custom-name { color: #1f3a5f; font-weight: 700; margin-top: 1px; }
                    .battlefleet, .glossary { margin-top: 16px; }
                    .section-head, .unit-head { display: flex; align-items: start; justify-content: space-between; gap: 16px; }
                    .section-head { break-after: avoid; border: 1px solid #d4d4d8; background: #f4f4f5; padding: 10px 12px; }
                    .unit-card { border: 1px solid #d4d4d8; border-top: 0; padding: 10px 12px; }
                    .unit-head, .stats, .rule-row, .profile-block h4 { break-after: avoid; }
                    tr, .badge, .model-line { break-inside: avoid; }
                    .unit-card.attachment { margin-top: 8px; border: 1px dashed #a1a1aa; background: #fafafa; }
                    .stats { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 1px; margin-top: 8px; border: 1px solid #d4d4d8; background: #d4d4d8; }
                    .stats span { background: white; padding: 4px; text-align: center; }
                    .rule-row { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 8px; margin-top: 8px; }
                    .badge { display: inline-block; border: 1px solid #d4d4d8; border-radius: 999px; margin: 0 4px 4px 0; padding: 2px 7px; background: white; }
                    .note { margin-top: 8px; }
                    .model-grid { display: grid; gap: 8px; margin-top: 8px; }
                    .model-line { border: 1px solid #e4e4e7; padding: 8px; }
                    .profile-block { margin-top: 8px; }
                    .profile-block h4 { margin-bottom: 4px; }
                    .profile-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    .profile-table th, .profile-table td { border: 1px solid #e4e4e7; padding: 4px 6px; vertical-align: top; }
                    .profile-table th { background: #f4f4f5; color: #3f3f46; font-size: 10px; text-align: left; text-transform: uppercase; }
                    .profile-table .center, .center { text-align: center; }
                    .profile-table .right, .right { text-align: right; }
                    .weapon-table th:nth-child(1), .weapon-table td:nth-child(1) { width: 30%; }
                    .weapon-table th:nth-child(2), .weapon-table td:nth-child(2), .weapon-table th:nth-child(3), .weapon-table td:nth-child(3), .weapon-table th:nth-child(4), .weapon-table td:nth-child(4), .weapon-table th:nth-child(5), .weapon-table td:nth-child(5) { width: 8%; }
                    .option-table th:nth-child(1), .option-table td:nth-child(1) { width: 18%; }
                    .option-table th:nth-child(3), .option-table td:nth-child(3), .option-table th:nth-child(4), .option-table td:nth-child(4), .option-table th:nth-child(5), .option-table td:nth-child(5) { width: 12%; }
                    .srs-table th:nth-child(1), .srs-table td:nth-child(1) { width: 24%; }
                    .srs-table th:nth-child(2), .srs-table td:nth-child(2), .srs-table th:nth-child(3), .srs-table td:nth-child(3), .srs-table th:nth-child(4), .srs-table td:nth-child(4), .srs-table th:nth-child(5), .srs-table td:nth-child(5) { width: 8%; }
                    .attachments { margin-top: 10px; }
                    .rule-text, .empty { border: 1px solid #e4e4e7; padding: 8px; background: #fafafa; }
                    .empty.compact { padding: 5px 6px; }
                    .rule-text p + p, .glossary-entry p + p { margin-top: 6px; }
                    .glossary { border-top: 2px solid #18181b; padding-top: 14px; }
                    .glossary-category { margin-top: 12px; }
                    .glossary-category h3 { break-after: avoid; border-bottom: 1px solid #d4d4d8; padding-bottom: 4px; text-transform: uppercase; font-size: 12px; color: #3f3f46; }
                    .glossary-entry { break-inside: avoid; border-bottom: 1px solid #e4e4e7; padding: 9px 0; }
                    .glossary-entry h4 { margin-bottom: 4px; }
                    .print-note { margin-top: 10px; color: #71717a; font-size: 11px; }
                    @media print {
                        body { background: white; }
                        main { max-width: none; padding: 0; }
                        .print-note { display: none; }
                    }
                </style>
            </head>
            <body>
                <main>
                    <header class="cover">
                        <div>
                            <h1>${escapeHtml(list.name)}</h1>
                            <div class="muted">${escapeHtml(list.faction_id)} · ${list.units.length} ${list.units.length === 1 ? 'unit' : 'units'}</div>
                            <div class="print-note">Use your browser print dialog to save this preview as a PDF.</div>
                        </div>
                        <div class="total">${totalPoints.toLocaleString('fr-FR')} pts</div>
                    </header>
                    ${battlefleetSections.join('')}
                    ${unassigned}
                    ${battlefleetSections.length === 0 && !unassigned ? '<div class="empty">No units added.</div>' : ''}
                    ${renderGlossary(ruleMap, glossary)}
                </main>
                <script>
                    window.addEventListener('load', () => {
                        window.focus();
                        window.print();
                    });
                </script>
            </body>
        </html>
    `
}

export function previewPrintableList(list: ArmyList, units: Unit[], glossary: Glossary | null, battlefleetDefinitions: BattlefleetDefinition[]): void {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.open()
    printWindow.document.write(renderPrintableList(list, units, glossary, battlefleetDefinitions))
    printWindow.document.close()
}
