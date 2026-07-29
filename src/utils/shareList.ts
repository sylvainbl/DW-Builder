import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit } from '../types/index'
import { isAttachmentOption } from './attachments.ts'
import { sortBattlefleetEntries } from './battlefleets.ts'
import { isUnitLevelOption } from './optionConfig.ts'
import {
    formatOptionName,
    getEffectiveGeneratorSelections,
    getSelectedRemovedWeaponNames,
    SYSTEM_GENERATOR_WEAPON_INDEX,
} from './optionRuleEffects.ts'
import { isGeneratorOption } from './unitHelpers.ts'

const pointsFormatter = new Intl.NumberFormat('en-US')
const equipmentIndent = '\u00a0'.repeat(8)

function formatPoints(points: number): string {
    return `${pointsFormatter.format(points)} pts`
}

function entryOwnPoints(entry: ArmyUnit): number {
    return entry.totalPoints - (entry.attachedUnits ?? []).reduce((sum, attachment) => sum + attachment.totalPoints, 0)
}

function addEquipmentCount(counts: Map<string, number>, name: string | undefined, quantity = 1): void {
    const label = name
        ?.trim()
        .replace(/\bFocused\b/gi, 'F.')
        .replace(/\bHeavy\b/gi, 'H.')
        .replace(/\bLight\b/gi, 'L.')
        .replace(/\bGenerator\b/gi, 'G.')
    if (!label || quantity <= 0) return
    counts.set(label, (counts.get(label) ?? 0) + quantity)
}

function mergeEquipmentCounts(target: Map<string, number>, source: Map<string, number>): void {
    source.forEach((quantity, name) => addEquipmentCount(target, name, quantity))
}

function formatEntryEquipment(entry: ArmyUnit, unit: Unit): string {
    const weaponCounts = new Map<string, number>()
    const generatorCounts = new Map<string, number>()
    const optionCounts = new Map<string, number>()

    for (const model of entry.models) {
        const removedWeaponNames = getSelectedRemovedWeaponNames(unit, model.config, entry.config)
        const generatorSelections = getEffectiveGeneratorSelections(unit, model.config, entry.config)
        const generatorByWeaponIndex = new Map(
            generatorSelections
                .filter((selection) => selection.weaponIndex !== SYSTEM_GENERATOR_WEAPON_INDEX)
                .map((selection) => [selection.weaponIndex, selection]),
        )

        unit.weapons.forEach((weapon, weaponIndex) => {
            if (removedWeaponNames.has(weapon.name)) return
            const generator = generatorByWeaponIndex.get(weaponIndex)
            if (generator) {
                addEquipmentCount(generatorCounts, generator.generatorName)
                addEquipmentCount(weaponCounts, generator.mountedWeaponName)
                return
            }

            const selectedWeaponName = model.config.hardpointSelections[weaponIndex] ?? weapon.name
            const selectedWeapon =
                weapon.slot && !weapon.hardpoint_locked
                    ? (unit.hardpoint_options[weapon.slot] ?? []).find(
                          (hardpointOption) => hardpointOption.name === selectedWeaponName,
                      )
                    : undefined
            addEquipmentCount(weaponCounts, selectedWeapon?.name ?? weapon.name)
        })

        for (const generator of generatorSelections.filter(
            (selection) => selection.weaponIndex === SYSTEM_GENERATOR_WEAPON_INDEX,
        )) {
            addEquipmentCount(generatorCounts, generator.generatorName)
            addEquipmentCount(weaponCounts, generator.mountedWeaponName)
        }

        for (const option of unit.options_and_upgrades) {
            if (isAttachmentOption(option) || isGeneratorOption(option) || isUnitLevelOption(option.tag)) continue
            addEquipmentCount(optionCounts, formatOptionName(option), model.config.optionQuantities[option.tag] ?? 0)
        }
    }

    for (const option of unit.options_and_upgrades) {
        if (!isUnitLevelOption(option.tag) || isAttachmentOption(option) || isGeneratorOption(option)) continue
        addEquipmentCount(optionCounts, formatOptionName(option), entry.config.optionQuantities[option.tag] ?? 0)
    }

    const equipmentCounts = new Map<string, number>()
    mergeEquipmentCounts(equipmentCounts, weaponCounts)
    mergeEquipmentCounts(equipmentCounts, generatorCounts)
    mergeEquipmentCounts(equipmentCounts, optionCounts)

    return Array.from(equipmentCounts, ([name, quantity]) => `${quantity} ${name}`).join(' / ')
}

function formatEntryLines(entry: ArmyUnit, unitById: Map<string, Unit>, depth = 0): string[] {
    const unit = unitById.get(entry.unitId)
    const attachmentLabel = depth > 0 ? (entry.generatedByOption ? 'Tethered: ' : 'Attachment: ') : ''
    const indent = equipmentIndent.repeat(depth)
    const linePrefix = depth === 0 ? '- ' : indent
    const unitName = unit?.name ?? entry.unitId
    const lines = [
        `${linePrefix}${attachmentLabel}${entry.models.length}× **${unitName}** — **${formatPoints(entryOwnPoints(entry))}**`,
    ]
    const equipment = unit ? formatEntryEquipment(entry, unit) : ''
    if (equipment) lines.push(`${indent}${equipmentIndent}*${equipment}*`)

    for (const attachment of entry.attachedUnits ?? []) {
        lines.push(...formatEntryLines(attachment, unitById, depth + 1))
    }

    return depth === 0 ? lines.map((line, index) => (index < lines.length - 1 ? `${line}  ` : line)) : lines
}

function entriesTotal(entries: ArmyUnit[]): number {
    return entries.reduce((sum, entry) => sum + entry.totalPoints, 0)
}

export function buildShareableListSummary(
    list: ArmyList,
    units: Unit[],
    battlefleetDefinitions: BattlefleetDefinition[],
    factionName: string,
): string {
    const unitById = new Map(units.map((unit) => [unit.id, unit]))
    const definitionById = new Map(battlefleetDefinitions.map((definition) => [definition.id, definition]))
    const battlefleets = list.battlefleets ?? []
    const assignedEntryIds = new Set<string>()
    const sections: string[][] = []

    for (const battlefleet of battlefleets) {
        const entries = sortBattlefleetEntries(
            list.units.filter((entry) => entry.battlefleetInstanceId === battlefleet.instanceId),
            units,
        )
        entries.forEach((entry) => assignedEntryIds.add(entry.instanceId))
        const definitionName = definitionById.get(battlefleet.definitionId)?.name ?? battlefleet.name
        const lines = [`*Battlefleet: ${definitionName} — ${formatPoints(entriesTotal(entries))}*`]

        if (entries.length === 0) {
            lines.push('- No ships')
        } else {
            entries.forEach((entry) => lines.push(...formatEntryLines(entry, unitById)))
        }
        sections.push(lines)
    }

    const unassignedEntries = list.units.filter((entry) => !assignedEntryIds.has(entry.instanceId))
    if (unassignedEntries.length > 0) {
        sections.push([
            `Unassigned — ${formatPoints(entriesTotal(unassignedEntries))}`,
            ...unassignedEntries.flatMap((entry) => formatEntryLines(entry, unitById)),
        ])
    }

    const totalPoints = entriesTotal(list.units)
    const header = `**${list.name} — ${factionName || list.faction_id} — ${formatPoints(totalPoints)}**`

    return [header, ...sections.map((section) => section.join('\n'))].join('\n\n')
}
