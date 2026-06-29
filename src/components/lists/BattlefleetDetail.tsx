import type { ArmyBattlefleet, ArmyUnit, BattlefleetDefinition, Unit } from '../../types/index'
import { getBattlefleetDisplayInfo } from '../../utils/battlefleetDisplay'
import { MarkdownText } from '../ui/MarkdownText'

interface Props {
    battlefleet: ArmyBattlefleet
    definition: BattlefleetDefinition
    entries: ArmyUnit[]
    units: Unit[]
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

export default function BattlefleetDetail({ battlefleet, definition, entries, units }: Props) {
    const points = entries.reduce((sum, entry) => sum + entry.totalPoints, 0)
    const displayInfo = getBattlefleetDisplayInfo(definition.id)
    const specialRuleText = definition.specialRuleText ?? displayInfo.specialRuleText ?? []
    const battlefleetBonus = definition.battlefleetBonus ?? displayInfo.battlefleetBonus ?? null
    const titleParts = [
        definition.type === 'main' ? 'Main' : 'Specialist',
        definition.legendary ? 'Legendary' : null,
    ].filter(Boolean)

    return (
        <div className="space-y-2">
            <section className="unit-detail-section unit-detail-hero rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.2em]">Battlefleet</div>
                        <h2 className="mt-1 text-lg font-semibold text-white">{battlefleet.name}</h2>
                        <p className="text-sm text-white/78">{definition.name}</p>
                        <p className="mt-1 text-[11px] font-medium text-white/65">{titleParts.join(' · ')}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                        <div className="text-sm font-medium text-white">{points} pts</div>
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
                        {entries.length > 0 ? entries.map((entry) => (
                            <div key={entry.instanceId} className="flex items-center justify-between gap-2 rounded-lg border border-white/80 bg-white/65 px-2.5 py-2 text-[12px]">
                                <div className="min-w-0">
                                    <div className="truncate font-semibold text-neutral-900">{unitLabel(units, entry)}</div>
                                    <div className="text-[11px] text-neutral-500">{entry.models.length} {entry.models.length === 1 ? 'model' : 'models'}</div>
                                </div>
                                <div className="flex-none font-semibold text-[var(--navy)]">{entry.totalPoints} pts</div>
                            </div>
                        )) : (
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

                <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Special Rules</div>
                    <div className="mt-2 space-y-2">
                        {specialRuleText.length > 0 ? specialRuleText.map((text, index) => (
                            <MarkdownText
                                key={`${definition.id}-rule-${index}`}
                                text={text}
                                className="rule-modal-body rounded-lg border border-white/80 bg-white/65 p-2.5 text-[12px] leading-relaxed text-neutral-800"
                            />
                        )) : (
                            <div className="rounded-lg border border-dashed border-neutral-300 bg-white/45 p-3 text-sm text-neutral-500">
                                No special rules.
                            </div>
                        )}
                    </div>
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
