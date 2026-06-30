import { useState } from 'react'
import type { ArmyList, Glossary, Unit } from '../../types/index'
import { getListGlossary, type GlossaryCategory, type ListGlossaryRule } from '../../utils/listGlossary'
import { MarkdownText, type GlossaryRuleLink } from '../ui/MarkdownText'
import { RuleModal } from '../ui/RuleModal'

interface Props {
    list: ArmyList
    units: Unit[]
    glossary: Glossary | null
}

const categoryLabels: Record<GlossaryCategory, string> = {
    systems: 'Systems',
    properties: 'Properties',
    qualities: 'Qualities',
}

function RuleBlock({ rule, glossary, onRuleClick }: { rule: ListGlossaryRule; glossary: Glossary | null; onRuleClick: (rule: GlossaryRuleLink) => void }) {
    return (
        <div className="rounded-lg border border-white/80 bg-white/65 p-2.5">
            <div className="text-sm font-semibold text-neutral-900">{rule.name}</div>
            {rule.text ? (
                <MarkdownText
                    text={rule.text}
                    className="rule-modal-body mt-1 text-[12px] leading-relaxed text-neutral-800"
                    glossary={glossary}
                    currentRuleName={rule.name}
                    onRuleClick={onRuleClick}
                />
            ) : (
                <div className="mt-1 text-[12px] text-neutral-500">No glossary text available.</div>
            )}
        </div>
    )
}

export default function ListGlossaryDetail({ list, units, glossary }: Props) {
    const [openRule, setOpenRule] = useState<GlossaryRuleLink | null>(null)
    const listGlossary = getListGlossary(list.units, units, glossary)
    const totalRules = listGlossary.systems.length + listGlossary.properties.length + listGlossary.qualities.length

    return (
        <div className="space-y-2">
            <section className="unit-detail-section unit-detail-hero rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.2em]">Glossary</div>
                        <h2 className="mt-1 text-lg font-semibold text-white">{list.name}</h2>
                        <p className="text-sm text-white/78">Rules used by this list</p>
                    </div>
                    <div className="rounded-full border border-white/20 bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
                        {totalRules} {totalRules === 1 ? 'rule' : 'rules'}
                    </div>
                </div>
            </section>

            <section className="grid items-start gap-2 xl:grid-cols-3">
                {(Object.keys(categoryLabels) as GlossaryCategory[]).map((category) => {
                    const rules = listGlossary[category]

                    return (
                        <div key={category} className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">{categoryLabels[category]}</div>
                                <span className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--navy)]">
                                    {rules.length}
                                </span>
                            </div>
                            <div className="mt-2 space-y-2">
                                {rules.length > 0 ? (
                                    rules.map((rule) => (
                                        <RuleBlock
                                            key={`${category}-${rule.name}`}
                                            rule={rule}
                                            glossary={glossary}
                                            onRuleClick={setOpenRule}
                                        />
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-dashed border-neutral-300 bg-white/45 p-3 text-sm text-neutral-500">
                                        None
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </section>
            {openRule ? (
                <RuleModal
                    name={openRule.name}
                    category={openRule.category}
                    text={openRule.text}
                    glossary={glossary}
                    onClose={() => setOpenRule(null)}
                />
            ) : null}
        </div>
    )
}
