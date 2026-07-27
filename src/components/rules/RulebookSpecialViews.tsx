import { BookOpen, ChevronDown, ChevronRight, Compass, Map as MapIcon, ShieldCheck, ShipWheel } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { formatIdentifier, getProcedureStepText, getRulebookHref } from '../../rulebook/data'
import type { RulebookIndexes } from '../../rulebook/data'
import type {
    CuratedVisual,
    EnvironmentalFeature,
    RuleBlock,
    RuleProcedure,
    RuleProcedureStep,
    RuleStructuredValue,
    RuleTableValue,
    RulebookData,
    RuleEncounter,
    TerrainFeature,
    TerrainMarker,
} from '../../rulebook/types'
import { CuratedVisualFigure, RuleTableView, RuleText } from './RulebookPrimitives'

interface SpecialViewProps {
    data: RulebookData
    indexes: RulebookIndexes
    onOpenVisual: (visual: CuratedVisual) => void
}

interface ViewHeaderProps {
    eyebrow: string
    title: string
    description: string
}

function ViewHeader({ eyebrow, title, description }: ViewHeaderProps) {
    return (
        <header className="mb-6 rounded-2xl border border-[var(--navy)] bg-gradient-to-br from-[var(--detail-hero)] to-[var(--detail-hero-soft)] p-5 text-white shadow-lg sm:p-7">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">{eyebrow}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">{description}</p>
        </header>
    )
}

function RuleAnchorLink({ ruleId, indexes }: { ruleId: string; indexes: RulebookIndexes }) {
    const rule = indexes.ruleById.get(ruleId)
    if (!rule) return null
    return (
        <Link
            to={getRulebookHref(rule.sectionId, rule.id)}
            className="inline-flex items-center gap-1 rounded-md border border-[var(--panel-border)] bg-[var(--detail-row)] px-2 py-1 text-xs font-semibold text-[var(--accent-foreground)] hover:border-[var(--gold)]"
        >
            {rule.title}
            <ChevronRight size={12} />
        </Link>
    )
}

function StructuredValues({ values }: { values: Record<string, RuleStructuredValue> }) {
    const entries = Object.entries(values).filter(
        ([, value]) => value !== undefined && value !== null && value !== false && value !== '',
    )
    if (entries.length === 0) return null
    return (
        <dl className="mt-3 flex flex-wrap gap-1.5">
            {entries.map(([key, value]) => (
                <div
                    key={key}
                    className="inline-flex min-w-0 items-baseline gap-1 rounded-md border border-[var(--panel-border)] bg-[var(--detail-panel)] px-2 py-1"
                >
                    <dt className="text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                        {formatIdentifier(key)}
                    </dt>
                    <dd className="text-xs font-semibold text-[var(--text)]">
                        {Array.isArray(value)
                            ? value.join(', ')
                            : typeof value === 'boolean'
                              ? 'Yes'
                              : typeof value === 'string' && value.includes('_')
                                ? formatIdentifier(value)
                                : value}
                    </dd>
                </div>
            ))}
        </dl>
    )
}

function InlineRuleContent({
    rule,
    fallbackText,
    preferFallback = false,
    headingLevel = 3,
    showRuleNotes = true,
}: {
    rule: RuleBlock | null
    fallbackText?: string
    preferFallback?: boolean
    headingLevel?: 3 | 4 | 5
    showRuleNotes?: boolean
}) {
    const text = preferFallback ? (fallbackText ?? rule?.text) : (rule?.text ?? fallbackText)
    if (!text) return null

    return (
        <>
            <RuleText text={text} headingLevel={headingLevel} />
            {showRuleNotes
                ? rule?.notes.map((note) => (
                      <aside
                          key={note.id}
                          className="mt-4 rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] p-3"
                      >
                          {note.title ? (
                              <h4 className="mb-1 text-sm font-bold text-[var(--text)]">{note.title}</h4>
                          ) : null}
                          <RuleText text={note.text} className="text-[var(--muted)]" headingLevel={5} />
                      </aside>
                  ))
                : null}
        </>
    )
}

function ProcedureStepDetails({
    step,
    procedure,
    indexes,
    showRuleNotes = true,
}: {
    step: RuleProcedureStep
    procedure: RuleProcedure
    indexes: RulebookIndexes
    showRuleNotes?: boolean
}) {
    const rule = step.ruleBlockId ? (indexes.ruleById.get(step.ruleBlockId) ?? null) : null
    const text = getProcedureStepText(step, procedure, indexes)
    const ruleIsShared = Boolean(
        step.ruleBlockId && procedure.steps.filter((item) => item.ruleBlockId === step.ruleBlockId).length > 1,
    )

    return (
        <li>
            <details className="group/step overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--detail-panel)]">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--navy)] text-xs font-bold text-white">
                        {step.order}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--text)]">{step.title}</span>
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className="flex-none text-[var(--accent-foreground)] transition-transform group-open/step:rotate-180"
                    />
                </summary>
                <div className="border-t border-[var(--panel-border)] bg-[var(--detail-row)] p-4">
                    <InlineRuleContent
                        rule={ruleIsShared ? null : rule}
                        fallbackText={text ?? undefined}
                        preferFallback
                        headingLevel={4}
                        showRuleNotes={showRuleNotes}
                    />
                </div>
            </details>
        </li>
    )
}

function ProcedureCard({
    procedure,
    indexes,
    onOpenVisual,
}: {
    procedure: RuleProcedure
    indexes: RulebookIndexes
    onOpenVisual: (visual: CuratedVisual) => void
}) {
    const pageStart = Math.min(...procedure.source.printedPages)
    const pageEnd = Math.max(...procedure.source.printedPages)

    return (
        <article
            id={procedure.id}
            className="scroll-mt-32 rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm"
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">
                        {pageStart === pageEnd ? `Page ${pageStart}` : `Pages ${pageStart}–${pageEnd}`}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[var(--accent-foreground)]">{procedure.title}</h2>
                </div>
                <span className="rounded-full bg-[var(--detail-panel)] px-3 py-1 text-xs font-semibold text-[var(--muted)]">
                    {procedure.steps.length} steps
                </span>
            </div>

            <ol className="mt-5 space-y-2">
                {procedure.steps.map((step) => (
                    <ProcedureStepDetails
                        key={`${procedure.id}-${step.order}`}
                        step={step}
                        procedure={procedure}
                        indexes={indexes}
                    />
                ))}
            </ol>

            {(indexes.visualsByProcedureId.get(procedure.id) ?? []).map((visual) => (
                <CuratedVisualFigure
                    key={visual.id}
                    visual={visual}
                    onOpen={onOpenVisual}
                    collapsed={!visual.requiredForUnderstanding}
                />
            ))}
        </article>
    )
}

export function ProceduresView({ data, indexes, onOpenVisual }: SpecialViewProps) {
    return (
        <div className="mx-auto max-w-4xl">
            <ViewHeader
                eyebrow="13 structured sequences"
                title="Procedures"
                description="Step-by-step references for rounds, activations, actions, missions and common dice resolutions. Open any step to read its complete rule in place."
            />
            <div className="space-y-5">
                {data.procedures.map((procedure) => (
                    <ProcedureCard
                        key={procedure.id}
                        procedure={procedure}
                        indexes={indexes}
                        onOpenVisual={onOpenVisual}
                    />
                ))}
            </div>
        </div>
    )
}

export function ActionsView({ data, indexes }: SpecialViewProps) {
    const groups = Array.from(new Set(data.actions.map((action) => action.category)))

    return (
        <div className="mx-auto max-w-4xl">
            <ViewHeader
                eyebrow="Actions & manoeuvres"
                title="Action Reference"
                description="Actions are grouped by category and phase. Open a card to read the complete rule and its ordered resolution."
            />
            <div className="space-y-7">
                {groups.map((category) => (
                    <section key={category}>
                        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                            <ShipWheel size={17} />
                            {formatIdentifier(category)}
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            {data.actions
                                .filter((action) => action.category === category)
                                .map((action) => {
                                    const procedure = action.procedureId
                                        ? indexes.procedureById.get(action.procedureId)
                                        : null
                                    const rule = action.ruleBlockId
                                        ? (indexes.ruleById.get(action.ruleBlockId) ?? null)
                                        : null
                                    return (
                                        <details
                                            key={action.id}
                                            id={action.id}
                                            className="group/action scroll-mt-32 overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] shadow-sm"
                                        >
                                            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 [&::-webkit-details-marker]:hidden">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-semibold text-[var(--gold)]">
                                                        {action.phase}
                                                    </p>
                                                    <h3 className="mt-1 text-lg font-bold text-[var(--text)]">
                                                        {action.name}
                                                    </h3>
                                                    <StructuredValues values={action.limits} />
                                                </div>
                                                <ChevronDown
                                                    size={18}
                                                    aria-hidden="true"
                                                    className="mt-1 flex-none text-[var(--accent-foreground)] transition-transform group-open/action:rotate-180"
                                                />
                                            </summary>
                                            <div className="border-t border-[var(--panel-border)] bg-[var(--detail-panel)] p-4">
                                                {procedure ? (
                                                    <section>
                                                        <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-foreground)]">
                                                            {procedure.title}
                                                        </h4>
                                                        <ol className="space-y-2">
                                                            {procedure.steps.map((step) => (
                                                                <ProcedureStepDetails
                                                                    key={`${procedure.id}-${step.order}`}
                                                                    step={step}
                                                                    procedure={procedure}
                                                                    indexes={indexes}
                                                                    showRuleNotes={
                                                                        step.ruleBlockId !== 'rule.5-inflict-damage'
                                                                    }
                                                                />
                                                            ))}
                                                        </ol>
                                                    </section>
                                                ) : (
                                                    <InlineRuleContent
                                                        rule={rule}
                                                        fallbackText={action.text}
                                                        headingLevel={4}
                                                    />
                                                )}
                                            </div>
                                        </details>
                                    )
                                })}
                        </div>
                    </section>
                ))}
            </div>
        </div>
    )
}

export function TokensView({ data, indexes, onOpenVisual }: SpecialViewProps) {
    return (
        <div className="mx-auto max-w-5xl">
            <ViewHeader
                eyebrow="Tokens & critical damage"
                title="Token Reference"
                description="Quick tracking metadata for all five token types, followed by the six Critical Damage effects."
            />
            <div className="grid gap-4 lg:grid-cols-2">
                {data.tokens.map((token) => {
                    const tokenTable = token.effectsTableId ? indexes.tableById.get(token.effectsTableId) : null
                    return (
                        <article
                            key={token.id}
                            id={token.id}
                            className="scroll-mt-32 rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">
                                        {formatIdentifier(token.scope)}
                                    </p>
                                    <h2 className="mt-1 text-xl font-bold text-[var(--text)]">{token.name}</h2>
                                </div>
                                <ShieldCheck size={22} className="text-[var(--accent-foreground)]" />
                            </div>
                            <RuleText text={token.text} className="mt-4" />
                            <StructuredValues
                                values={{
                                    stacking: formatIdentifier(token.stacking),
                                    maximumLevel: token.maximumLevel ?? token.tracking?.maximum ?? null,
                                    ...(token.tracking ?? {}),
                                }}
                            />
                            <div className="mt-4 flex flex-wrap gap-2">
                                {token.ruleBlockIds.map((ruleId) => (
                                    <RuleAnchorLink key={ruleId} ruleId={ruleId} indexes={indexes} />
                                ))}
                            </div>
                            {(indexes.visualsByTokenId.get(token.id) ?? []).map((visual) => (
                                <CuratedVisualFigure
                                    key={visual.id}
                                    visual={visual}
                                    onOpen={onOpenVisual}
                                    compact
                                    collapsed={!visual.requiredForUnderstanding}
                                />
                            ))}
                            {tokenTable ? <RuleTableView table={tokenTable} /> : null}
                        </article>
                    )
                })}
            </div>

            <section className="mt-8">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                    Critical Damage effects
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {data.criticalDamageEffects.map((effect) => (
                        <article
                            key={effect.id}
                            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-4 shadow-sm"
                        >
                            <h3 className="font-bold text-[var(--text)]">{effect.name}</h3>
                            <RuleText text={effect.text} className="mt-3" />
                            <StructuredValues values={effect.structuredEffect} />
                        </article>
                    ))}
                </div>
            </section>
        </div>
    )
}

function TerrainCard({
    item,
    metadata,
    ruleIds,
    indexes,
}: {
    item: EnvironmentalFeature | TerrainFeature | TerrainMarker
    metadata: Record<string, RuleTableValue>
    ruleIds: string[]
    indexes: RulebookIndexes
}) {
    const fallbackText = 'text' in item ? item.text : item.definition

    return (
        <article
            id={item.id}
            className="scroll-mt-32 rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-4 shadow-sm"
        >
            <h3 className="text-lg font-bold text-[var(--text)]">{item.name}</h3>
            <StructuredValues values={metadata} />
            {fallbackText ? (
                <RuleText text={fallbackText} className="mt-3 text-[var(--muted)]" headingLevel={4} />
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
                {ruleIds.map((ruleId) => (
                    <RuleAnchorLink key={ruleId} ruleId={ruleId} indexes={indexes} />
                ))}
            </div>
        </article>
    )
}

export function TerrainView({ data, indexes, onOpenVisual }: SpecialViewProps) {
    const markerVisuals = Array.from(
        new Map(
            data.terrain.markers
                .flatMap((marker) => indexes.visualsByMarkerId.get(marker.id) ?? [])
                .map((visual) => [visual.id, visual]),
        ).values(),
    )

    return (
        <div className="mx-auto max-w-5xl">
            <ViewHeader
                eyebrow="Battlefield reference"
                title="Terrain & Markers"
                description="Environmental effects, physical terrain and encounter markers are separated so their numerical rules stay easy to scan."
            />

            <section className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                    <Compass size={17} />
                    Environmental Features
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {data.terrain.environmentalFeatures.map((item) => (
                        <TerrainCard
                            key={item.id}
                            item={item}
                            metadata={{
                                impedes: item.impedes.join(', ') || null,
                                hampersVisibility: item.hampersVisibility,
                                specialRules: item.specialRules?.join(', ') ?? null,
                            }}
                            ruleIds={item.sharedRuleIds.flatMap((id) => {
                                const sharedRule = data.terrain.sharedRules.find((rule) => rule.id === id)
                                return sharedRule ? [sharedRule.ruleBlockId] : []
                            })}
                            indexes={indexes}
                        />
                    ))}
                </div>
            </section>

            <section className="mb-8">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                    <MapIcon size={17} />
                    Terrain Features
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                    {data.terrain.terrainFeatures.map((item) => (
                        <TerrainCard
                            key={item.id}
                            item={item}
                            metadata={{
                                examples: item.examples?.join(', ') ?? null,
                                visibilityMass: item.visibilityMass ?? null,
                                minimumSizeAcrossInches: item.minimumSizeAcrossInches ?? null,
                                treacherousWaterBandInches: item.treacherousWaterBandInches ?? null,
                                defaultArmour: item.defaultArmour ?? null,
                                massReducedPerDamage: item.massReducedPerDamage ?? null,
                                removedAtMass: item.removedAtMass ?? null,
                                canContainImpassableGround: item.canContainImpassableGround ?? null,
                            }}
                            ruleIds={item.ruleBlockId ? [item.ruleBlockId] : []}
                            indexes={indexes}
                        />
                    ))}
                </div>
            </section>

            <section>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                    <BookOpen size={17} />
                    Markers
                </h2>
                <RuleText
                    text={data.terrain.markerGeneralRules}
                    className="mb-4 rounded-xl border border-[var(--panel-border)] bg-[var(--detail-panel)] p-4"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                    {data.terrain.markers.map((item) => (
                        <TerrainCard
                            key={item.id}
                            item={item}
                            metadata={{
                                triggeredByTraits: item.triggeredByTraits?.join(', ') ?? null,
                                removedBy: item.criticalDamageResultsThatRemoveMarker?.join(', ') ?? null,
                                ...(item.controlCondition ?? {}),
                                ...(item.onTrigger ?? {}),
                            }}
                            ruleIds={[item.ruleBlockId]}
                            indexes={indexes}
                        />
                    ))}
                </div>
                {markerVisuals.map((visual) => (
                    <CuratedVisualFigure
                        key={visual.id}
                        visual={visual}
                        onOpen={onOpenVisual}
                        collapsed={!visual.requiredForUnderstanding}
                    />
                ))}
            </section>
        </div>
    )
}

function availabilityLabel(value: string): string {
    if (value === 'all') return 'All scales'
    if (value === 'medium_and_large') return 'Medium & Large'
    if (value === 'large_only') return 'Large only'
    return formatIdentifier(value)
}

function EncounterDetail({
    encounter,
    indexes,
    onOpenVisual,
}: {
    encounter: RuleEncounter
    indexes: RulebookIndexes
    onOpenVisual: (visual: CuratedVisual) => void
}) {
    const mapVisual = indexes.visualById.get(encounter.deployment.diagram.visualId)

    return (
        <article id={encounter.id} className="scroll-mt-32">
            <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--gold)]">
                    Encounter {encounter.number}
                </p>
                <h2 className="mt-1 text-2xl font-bold text-[var(--accent-foreground)]">{encounter.name}</h2>
                <RuleText
                    text={encounter.narrative}
                    className="mt-4 border-l-2 border-[var(--gold)] pl-4 italic text-[var(--muted)]"
                />
            </header>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.72fr)]">
                <div className="space-y-5">
                    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                            Play Area
                        </h3>
                        <RuleText text={encounter.playArea} className="mt-3" />
                    </section>
                    {encounter.deployment.description ? (
                        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm">
                            <h3 className="text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                                Deployment
                            </h3>
                            <RuleText text={encounter.deployment.description} className="mt-3" />
                        </section>
                    ) : null}
                    {encounter.additionalRules.map((rule) => (
                        <section
                            key={rule.id}
                            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-5 shadow-sm"
                        >
                            <p className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--gold)]">
                                Additional Rule
                            </p>
                            <h3 className="mt-1 font-bold text-[var(--text)]">{rule.name}</h3>
                            <RuleText text={rule.text} className="mt-3" />
                        </section>
                    ))}
                </div>
                <div>{mapVisual ? <CuratedVisualFigure visual={mapVisual} onOpen={onOpenVisual} compact /> : null}</div>
            </div>

            <section className="mt-6">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">
                    Objectives
                </h3>
                <div className="grid gap-4 lg:grid-cols-3">
                    {encounter.objectives.map((objective) => (
                        <article
                            key={objective.id}
                            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-4 shadow-sm"
                        >
                            <div className="flex flex-wrap gap-2">
                                <span className="rounded-full bg-[var(--navy)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                                    {objective.tier}
                                </span>
                                <span className="rounded-full border border-[var(--panel-border)] bg-[var(--detail-panel)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text)]">
                                    {availabilityLabel(objective.availability)}
                                </span>
                                {objective.role !== 'both' ? (
                                    <span className="rounded-full border border-[var(--gold)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text)]">
                                        {formatIdentifier(objective.role)}
                                    </span>
                                ) : null}
                            </div>
                            <h4 className="mt-3 font-bold text-[var(--text)]">{objective.name}</h4>
                            <RuleText text={objective.text} className="mt-3" />
                        </article>
                    ))}
                </div>
            </section>
        </article>
    )
}

export function EncountersView({ data, indexes, onOpenVisual }: SpecialViewProps) {
    const location = useLocation()
    const navigate = useNavigate()
    const selectedEncounterId = decodeURIComponent(location.hash.slice(1))
    const selectedEncounter =
        data.encounters.find((encounter) => encounter.id === selectedEncounterId) ?? data.encounters[0]

    if (!selectedEncounter) return null

    return (
        <div className="mx-auto max-w-6xl">
            <ViewHeader
                eyebrow="Six common encounters"
                title="Encounter Library"
                description="Choose an encounter to see its narrative, cropped deployment map, play-area rules and tiered objectives."
            />
            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Encounter index">
                {data.encounters.map((encounter) => (
                    <button
                        key={encounter.id}
                        type="button"
                        onClick={() =>
                            void navigate(`${location.pathname}${location.search}#${encodeURIComponent(encounter.id)}`)
                        }
                        aria-pressed={encounter.id === selectedEncounter.id}
                        className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold transition ${
                            encounter.id === selectedEncounter.id
                                ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)]'
                                : 'border-[var(--panel-border)] bg-[var(--detail-row)] text-[var(--text)] hover:border-[var(--gold)]'
                        }`}
                    >
                        <span className="block text-[10px] uppercase tracking-wide opacity-70">
                            Encounter {encounter.number}
                        </span>
                        <span className="mt-1 block">{encounter.name}</span>
                    </button>
                ))}
            </div>
            <EncounterDetail encounter={selectedEncounter} indexes={indexes} onOpenVisual={onOpenVisual} />
        </div>
    )
}
