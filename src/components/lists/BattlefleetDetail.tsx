import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { useAppStore } from '../../store'
import type { ArmyBattlefleet, ArmyUnit, BattlefleetDefinition, FleetDoctrine, Unit } from '../../types/index'
import { getBattlefleetForceType, getMatchingBattlefleetElement, isMercenaryInForce, sortBattlefleetEntries } from '../../utils/battlefleets'
import { getBattlefleetDisplayInfo } from '../../utils/battlefleetDisplay'
import { getAvailableFleetDoctrines } from '../../utils/fleetDoctrines'
import { formatOptionName, getEffectiveGeneratorSelections } from '../../utils/optionRuleEffects'
import { computeOptionPoints, hasChitaSwarmEscortDiscount, isUnitLevelOption } from '../../utils/pointsCalc'
import { computeArmyUnitGuardianPool, computeArmyUnitGuardianSurge, computeEntriesGuardianPool, computeEntriesGuardianSurge, isCrownFaction } from '../../utils/guardianPool'
import { MarkdownText } from '../ui/MarkdownText'

interface Props {
    battlefleet: ArmyBattlefleet
    definition: BattlefleetDefinition
    forceFactionId: string
    entries: ArmyUnit[]
    units: Unit[]
    fleetDoctrines: Record<string, FleetDoctrine[]>
}

function unitName(units: Unit[], unitId: string): string {
    const unit = units.find((item) => item.id === unitId)
    return unit ? `${unit.name}${unit.sub_name ? ` ${unit.sub_name}` : ''}` : unitId
}

function unitLabel(units: Unit[], entry: ArmyUnit): string {
    const unit = units.find((item) => item.id === entry.unitId)
    return unit ? `${unit.name}${unit.sub_name ? `, ${unit.sub_name}` : ''}` : entry.unitId
}

function textList(items: string[]): string {
    return items.length > 0 ? items.join(', ') : 'None'
}

const GENERATOR_OPTION_TAGS = new Set([
    'GENERATOR',
    'TRIDENT_GENERATOR',
    'GUARDIAN_GENERATOR',
    'ADDITIONAL_GUARDIAN_GENERATOR',
    'FREYA_ARRAY',
    'MAGMA_CAST_GENERATOR',
    'EMPIRE_FREE_GENERATOR',
])

function elementLabel(definition: BattlefleetDefinition, entry: ArmyUnit, unit: Unit): string {
    const element = getMatchingBattlefleetElement(definition, entry, unit)
    if (!element) return unit.role
    return element.name
        .replace(/^\d+(?:-\d+)?\s+/, '')
        .replace(/^Empire\s+/, '')
}

function addPointGroup(groups: Map<string, { quantity: number; points: number }>, label: string, quantity: number, points: number): void {
    const current = groups.get(label) ?? { quantity: 0, points: 0 }
    groups.set(label, {
        quantity: current.quantity + quantity,
        points: current.points + points,
    })
}

function pointBreakdown(entry: ArmyUnit, unit: Unit, battlefleet: ArmyBattlefleet): string[] {
    const lines: string[] = []
    const baseCost = unit.point_cost_per_model ?? 0
    if (baseCost > 0) {
        lines.push(`${entry.models.length} ${entry.models.length === 1 ? 'model' : 'models'}: ${entry.models.length} x ${baseCost} = ${entry.models.length * baseCost} pts`)
    }

    const optionGroups = new Map<string, { quantity: number; points: number }>()
    for (const model of entry.models) {
        for (const generator of getEffectiveGeneratorSelections(unit, model.config, entry.config)) {
            addPointGroup(optionGroups, generator.generatorName, 1, generator.generatorCost)
        }

        for (const option of unit.options_and_upgrades) {
            if (option.cost_per_unit == null || isUnitLevelOption(option.tag) || GENERATOR_OPTION_TAGS.has(option.tag)) continue
            const quantity = model.config.optionQuantities[option.tag] ?? 0
            if (quantity <= 0) continue
            addPointGroup(optionGroups, formatOptionName(option), quantity, computeOptionPoints(option, quantity) ?? 0)
        }
    }

    if (entry.config.fleetDoctrineSelection) {
        const doctrine = entry.config.fleetDoctrineSelection
        addPointGroup(optionGroups, `Doctrine: ${doctrine.doctrineName}`, 1, doctrine.doctrineCost)
    }

    for (const option of unit.options_and_upgrades) {
        if (option.cost_per_unit == null || !isUnitLevelOption(option.tag)) continue
        const quantity = entry.config.optionQuantities[option.tag] ?? 0
        if (quantity <= 0) continue
        const points = computeOptionPoints(option, quantity, hasChitaSwarmEscortDiscount(entry, { battlefleets: [battlefleet] })) ?? 0
        addPointGroup(optionGroups, formatOptionName(option), quantity, points)
    }

    for (const [label, group] of optionGroups) {
        const quantity = group.quantity > 1 ? ` x${group.quantity}` : ''
        lines.push(`${label}${quantity}: +${group.points} pts`)
    }

    const attachmentsTotal = (entry.attachedUnits ?? []).reduce((sum, attachment) => sum + attachment.totalPoints, 0)
    if (attachmentsTotal > 0) {
        lines.push(`Attachments: +${attachmentsTotal} pts`)
    }

    return lines
}

export default function BattlefleetDetail({ battlefleet, definition, forceFactionId, entries, units, fleetDoctrines }: Props) {
    const renameBattlefleet = useAppStore((state) => state.renameBattlefleet)
    const [editingName, setEditingName] = useState(false)
    const [draftName, setDraftName] = useState('')
    const points = entries.reduce((sum, entry) => sum + entry.totalPoints, 0)
    const showGuardianPool = isCrownFaction(forceFactionId)
    const guardianPool = showGuardianPool ? computeEntriesGuardianPool(entries, units) : 0
    const guardianSurge = showGuardianPool ? computeEntriesGuardianSurge(entries, units) : 0
    const sortedEntries = sortBattlefleetEntries(entries, units)
    const displayInfo = getBattlefleetDisplayInfo(definition.id)
    const specialRuleText = definition.specialRuleText ?? displayInfo.specialRuleText ?? []
    const battlefleetBonus = definition.battlefleetBonus ?? displayInfo.battlefleetBonus ?? null
    const selectedFleetDoctrines = sortedEntries.flatMap((entry) => {
        const selection = entry.config.fleetDoctrineSelection
        const unit = units.find((item) => item.id === entry.unitId)
        if (!selection || !unit) return []

        const doctrine = getAvailableFleetDoctrines(unit, fleetDoctrines)
            .find((item) => item.name === selection.doctrineName)
        if (!doctrine) return []

        return [{ entry, unit, doctrine }]
    })
    const hasSpecialRules = specialRuleText.length > 0
    const forceType = getBattlefleetForceType(definition, forceFactionId)
    const mercenary = isMercenaryInForce(definition, forceFactionId)
    const titleParts = [
        forceType === 'main' ? 'Main' : 'Specialist',
        mercenary ? 'Mercenary' : null,
        definition.legendary ? 'Legendary' : null,
    ].filter(Boolean)
    const customName = battlefleet.customName?.trim()
    const commitName = () => {
        renameBattlefleet(battlefleet.instanceId, draftName)
        setEditingName(false)
    }

    return (
        <div className="space-y-2">
            <section className="unit-detail-section unit-detail-hero rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.2em]">Battlefleet</div>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-white">{definition.name}</h2>
                            <button
                                type="button"
                                title={customName ? 'Rename Battlefleet' : 'Add Battlefleet name'}
                                onClick={() => {
                                    setDraftName(customName ?? '')
                                    setEditingName(true)
                                }}
                                className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                            >
                                <Pencil size={12} />
                            </button>
                        </div>
                        {editingName ? (
                            <input
                                value={draftName}
                                autoFocus
                                onChange={(event) => setDraftName(event.target.value)}
                                onBlur={commitName}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') commitName()
                                    if (event.key === 'Escape') setEditingName(false)
                                }}
                                className="mt-1 w-full max-w-xs rounded border border-white/30 bg-white px-2 py-1 text-sm font-semibold text-[var(--navy)] outline-none"
                            />
                        ) : customName ? (
                            <p className="truncate text-sm font-semibold text-white/90">{customName}</p>
                        ) : null}
                        <p className="mt-1 text-[11px] font-medium text-white/65">{titleParts.join(' · ')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <div className="text-sm font-medium text-white">{points} pts</div>
                        {showGuardianPool ? (
                            <div className="text-[11px] font-medium text-white/75">
                                Guardian Pool: {guardianPool} - Guardian Surge: {guardianSurge}
                            </div>
                        ) : null}
                        <div className="rounded-full border border-white/20 bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
                            {entries.length} {entries.length === 1 ? 'unit' : 'units'}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid items-start gap-2 lg:grid-cols-2">
                <div className="unit-detail-section unit-detail-panel rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Elements</div>
                    <div className="mt-2 divide-y divide-white/70 overflow-hidden rounded-lg border border-white/80 bg-white/60">
                        {definition.elements.map((element) => (
                            <div key={element.id} className="px-2.5 py-2">
                                <div className="text-[12px] font-semibold text-neutral-900">{element.name}</div>
                                <div className="mt-0.5 text-[11px] text-neutral-600">
                                    {element.min === element.max ? `${element.min} required` : `${element.min}-${element.max} allowed`}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="unit-detail-section unit-detail-panel rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Assigned Units</div>
                    <div className="mt-2 space-y-1">
                        {sortedEntries.length > 0 ? sortedEntries.map((entry) => {
                            const unit = units.find((item) => item.id === entry.unitId)
                            const breakdown = unit ? pointBreakdown(entry, unit, battlefleet) : []
                            return (
                                <div key={entry.instanceId} className="rounded-lg border border-white/80 bg-white/65 px-2.5 py-2 text-[12px]">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-semibold text-neutral-900">{unitLabel(units, entry)}</div>
                                            {entry.customName ? <div className="truncate text-[11px] font-semibold text-[var(--navy)]">{entry.customName}</div> : null}
                                            {unit ? (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    <span className="rounded-full border border-white bg-[var(--gold-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--navy)]">
                                                        {elementLabel(definition, entry, unit)}
                                                    </span>
                                                    <span className="rounded-full border border-white bg-white/80 px-2 py-0.5 text-[10px] text-neutral-600">
                                                        {unit.role}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                        <div className="flex-none text-right font-semibold text-[var(--navy)]">
                                            <div>{entry.totalPoints} pts</div>
                                            {showGuardianPool ? (
                                                <div className="mt-1 text-[10px]">
                                                    Guardian Pool: {computeArmyUnitGuardianPool(entry, units)} - Guardian Surge: {computeArmyUnitGuardianSurge(entry, units)}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                    {breakdown.length > 0 ? (
                                        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-neutral-600">
                                            {breakdown.map((line) => (
                                                <span key={line} className="rounded-full border border-neutral-200 bg-white/75 px-2 py-0.5">
                                                    {line}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            )
                        }) : (
                            <div className="rounded-lg border border-dashed border-neutral-300 bg-white/45 p-3 text-sm text-neutral-500">
                                No units assigned.
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className="grid items-start gap-2 lg:grid-cols-2">
                <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Mainstays</div>
                    <div className="mt-2 rounded-lg border border-white/80 bg-white/65 p-2.5 text-sm text-neutral-800">
                        <div className="text-[12px] font-semibold text-neutral-900">Mainstay classes</div>
                        <div className="mt-1 text-[12px] text-neutral-700">{textList(definition.mainstayClassNames ?? [])}</div>

                        {(definition.additionalMainstays ?? []).length > 0 ? (
                            <div className="mt-3 space-y-2">
                                <div className="text-[12px] font-semibold text-neutral-900">Additional mainstays</div>
                                {definition.additionalMainstays?.map((mainstay) => (
                                    <div key={`${mainstay.flagshipUnitIds.join('-')}-${mainstay.classNames.join('-')}`} className="rounded border border-neutral-200 bg-white px-2 py-1.5">
                                        <div className="text-[11px] font-semibold text-neutral-600">
                                            If this Battlefleet includes {mainstay.flagshipUnitIds.map((id) => unitName(units, id)).join(' or ')}
                                        </div>
                                        <div className="mt-0.5 text-[12px] text-neutral-900">{textList(mainstay.classNames)}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                        <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Special Rules</div>
                        <div className="mt-2 space-y-2">
                            {hasSpecialRules ? (
                                specialRuleText.map((text, index) => (
                                    <MarkdownText
                                        key={`${definition.id}-rule-${index}`}
                                        text={text}
                                        className="rule-modal-body rounded-lg border border-white/80 bg-white/65 p-2.5 text-[12px] leading-relaxed text-neutral-800"
                                    />
                                ))
                            ) : (
                                <div className="rounded-lg border border-dashed border-neutral-300 bg-white/45 p-3 text-sm text-neutral-500">
                                    No special rules.
                                </div>
                            )}
                        </div>
                    </div>

                    {selectedFleetDoctrines.length > 0 ? (
                        <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                            <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Fleet Doctrine</div>
                            <div className="mt-2 space-y-2">
                                {selectedFleetDoctrines.map(({ entry, unit, doctrine }) => (
                                    <div key={`${entry.instanceId}-doctrine-${doctrine.name}`} className="rounded-lg border border-white/80 bg-white/65 p-2.5">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-[12px] font-semibold text-neutral-900">{doctrine.name}</div>
                                            <div className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">+{doctrine.point_cost} pts</div>
                                        </div>
                                        <div className="mt-0.5 text-[11px] text-neutral-500">Selected on {unitLabel(units, entry)} {unit.role}</div>
                                        <MarkdownText text={doctrine.text} className="rule-modal-body mt-1 text-[12px] leading-relaxed text-neutral-800" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    </div>
            </section>

            {battlefleetBonus ? (
                <section className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Battlefleet Bonus</div>
                    <div className="mt-2 rounded-lg border border-white/80 bg-white/65 p-2.5">
                        <div className="text-sm font-semibold text-neutral-900">{battlefleetBonus.name}</div>
                        <MarkdownText text={battlefleetBonus.text} className="rule-modal-body mt-1 text-[12px] leading-relaxed text-neutral-800" />
                    </div>
                </section>
            ) : null}
        </div>
    )
}
