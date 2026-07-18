import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
    formatPageRange,
    getRulebookHref,
    hasRenderableRuleContent,
    normalizeSearchText,
    resolveReadingSection,
    resolveSectionRuleBlocks,
} from '../../rulebook/data'
import type { RulebookIndexes } from '../../rulebook/data'
import type { CuratedVisual, RuleBlock, RulebookData, RulebookSection } from '../../rulebook/types'
import { CuratedVisualFigure, RuleTableView, RuleText } from './RulebookPrimitives'

interface RuleBlockCardProps {
    rule: RuleBlock
    sectionId: string
    visuals: CuratedVisual[]
    indexes: RulebookIndexes
    renderedTableIds: Set<string>
    onOpenVisual: (visual: CuratedVisual) => void
    hideTitle?: boolean
    showPage?: boolean
}

interface CopyLinkIconProps {
    relativeUrl: string
    label: string
}

function CopyLinkIcon({ relativeUrl, label }: CopyLinkIconProps) {
    const [copied, setCopied] = useState(false)

    const copyLink = async () => {
        const url = new URL(relativeUrl, window.location.origin).toString()
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1600)
        } catch {
            window.prompt('Copy this link:', url)
        }
    }

    return (
        <button
            type="button"
            onClick={copyLink}
            className="inline-flex size-7 flex-none items-center justify-center rounded-md border border-transparent bg-transparent opacity-0 transition hover:border-[var(--panel-border)] hover:bg-[var(--detail-panel)] focus:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] group-hover/title:opacity-100 group-focus-within/title:opacity-100"
            title={copied ? 'Link copied' : label}
            aria-label={copied ? 'Link copied' : label}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    )
}

function RuleBlockCard({
    rule,
    sectionId,
    visuals,
    indexes,
    renderedTableIds,
    onOpenVisual,
    hideTitle = false,
    showPage = true,
}: RuleBlockCardProps) {
    const hasHeading = showPage || !hideTitle

    const tables = (rule.contentMode === 'container' ? [] : rule.tableIds)
        .filter((id) => !renderedTableIds.has(id))
        .flatMap((id) => {
            const table = indexes.tableById.get(id)
            if (!table) return []
            renderedTableIds.add(id)
            return [table]
        })

    return (
        <article id={rule.id} className="relative scroll-mt-32 rounded-2xl border border-l-4 border-[var(--panel-border)] border-l-[var(--navy)] bg-[var(--detail-row)] p-4 shadow-sm sm:p-6">
            {hasHeading ? (
                <div>
                    {showPage ? (
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">
                            {formatPageRange(rule.printedPageStart, rule.printedPageEnd)}
                        </p>
                    ) : null}
                    {!hideTitle ? (
                        <div className="group/title inline-flex items-center gap-1.5 text-[var(--accent-foreground)]">
                            <h2 className="text-xl font-bold leading-tight text-[var(--accent-foreground)] sm:text-2xl">{rule.title}</h2>
                            <CopyLinkIcon
                                relativeUrl={getRulebookHref(sectionId, rule.id)}
                                label={`Copy a direct link to ${rule.title}`}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}

            {rule.text ? <RuleText text={rule.text} className={`${hasHeading ? 'mt-5' : ''} max-w-[72ch]`} /> : null}

            {rule.notes.map((note) => (
                <aside
                    key={note.id}
                    className={`mt-5 rounded-xl border p-4 ${note.type === 'designers_note'
                        ? 'border-[rgb(var(--gold-rgb)/0.55)] bg-[var(--gold-light)]'
                        : 'border-[var(--panel-border)] bg-[var(--detail-panel)] italic'}`}
                >
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-foreground)]">
                        {note.type === 'designers_note' ? 'Designers’ Note' : 'From the Dystopian Age'}
                    </p>
                    {note.title ? <h3 className="mb-2 font-bold text-[var(--text)]">{note.title}</h3> : null}
                    <RuleText text={note.text} />
                </aside>
            ))}

            {tables.map((table) => <RuleTableView key={table.id} table={table} />)}
            {visuals.map((visual) => (
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

interface RulebookSectionViewProps {
    section: RulebookSection
    data: RulebookData
    indexes: RulebookIndexes
    onOpenVisual: (visual: CuratedVisual) => void
}

export default function RulebookSectionView({ section, data, indexes, onOpenVisual }: RulebookSectionViewProps) {
    const readingSection = resolveReadingSection(section)
    const childSections = readingSection.childSectionIds
        .map((id) => indexes.sectionById.get(id))
        .filter((item): item is RulebookSection => Boolean(item))
    const renderedTableIds = new Set<string>()
    const renderedVisualIds = new Set<string>()
    const renderedRuleIds = new Set<string>()
    const breadcrumbSections = readingSection.path
        .map((id) => indexes.sectionById.get(id))
        .filter((item): item is RulebookSection => Boolean(item))

    const renderSectionContent = (currentSection: RulebookSection) => {
        const rules = resolveSectionRuleBlocks(currentSection, indexes)
            .filter((rule) => hasRenderableRuleContent(rule, indexes))
            .filter((rule) => {
                if (renderedRuleIds.has(rule.id)) return false
                renderedRuleIds.add(rule.id)
                return true
            })
        const sectionTables = (currentSection.childSectionIds.length > 0 ? [] : currentSection.tableIds).flatMap((id) => {
            if (renderedTableIds.has(id)) return []
            const table = indexes.tableById.get(id)
            if (!table) return []
            renderedTableIds.add(id)
            return [table]
        })
        const sectionVisuals = (indexes.visualsBySectionId.get(currentSection.id) ?? []).filter((visual) => {
            if (renderedVisualIds.has(visual.id)) return false
            renderedVisualIds.add(visual.id)
            return true
        })

        return (
            <div className="space-y-5">
                {rules.map((rule) => {
                    const visuals = (indexes.visualsByRuleId.get(rule.id) ?? []).filter((visual) => {
                        if (renderedVisualIds.has(visual.id)) return false
                        renderedVisualIds.add(visual.id)
                        return true
                    })
                    return (
                        <RuleBlockCard
                            key={rule.id}
                            rule={rule}
                            sectionId={currentSection.id}
                            visuals={visuals}
                            indexes={indexes}
                            renderedTableIds={renderedTableIds}
                            onOpenVisual={onOpenVisual}
                            hideTitle={normalizeSearchText(rule.title) === normalizeSearchText(currentSection.title)}
                            showPage={false}
                        />
                    )
                })}

                {sectionTables.map((table) => <RuleTableView key={table.id} table={table} />)}
                {sectionVisuals.map((visual) => (
                    <CuratedVisualFigure
                        key={visual.id}
                        visual={visual}
                        onOpen={onOpenVisual}
                        collapsed={!visual.requiredForUnderstanding}
                    />
                ))}
            </div>
        )
    }

    return (
        <div className="mx-auto max-w-4xl">
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-xs text-[var(--muted)]">
                {breadcrumbSections.map((item, index) => (
                    <span key={item.id} className="inline-flex items-center gap-1">
                        {index > 0 ? <span aria-hidden="true">›</span> : null}
                        {item.id === readingSection.id ? (
                            <span aria-current="page">{item.title}</span>
                        ) : (
                            <Link to={getRulebookHref(item.id)} className="hover:text-[var(--accent-foreground)] hover:underline">
                                {item.title}
                            </Link>
                        )}
                    </span>
                ))}
            </nav>

            <header className="mb-6 overflow-hidden rounded-2xl border border-[var(--navy)] bg-gradient-to-br from-[var(--detail-hero)] to-[var(--detail-hero-soft)] p-5 text-white shadow-lg sm:p-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold)]">
                    {formatPageRange(readingSection.printedPageStart, readingSection.printedPageEnd)}
                </p>
                <div className="group/title inline-flex items-center gap-1.5">
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{readingSection.title}</h1>
                    <CopyLinkIcon
                        relativeUrl={getRulebookHref(readingSection.id)}
                        label={`Copy a direct link to ${readingSection.title}`}
                    />
                </div>
                <p className="mt-2 text-sm text-white/70">
                    Rulebook v{data.manifest.version} · Dataset {data.manifest.datasetVersion}
                </p>
            </header>

            {childSections.length > 0 ? (
                <nav aria-label="In this section" className="mb-7 rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-panel)] p-5">
                    <h2 className="text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">In this section</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {childSections.map((childSection) => (
                            <Link
                                key={childSection.id}
                                to={getRulebookHref(childSection.id)}
                                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-border)] bg-[var(--detail-row)] px-3 py-3 text-sm font-semibold text-[var(--text)] transition hover:border-[var(--gold)] hover:text-[var(--accent-foreground)]"
                            >
                                <span>{childSection.title}</span>
                                <span className="flex-none text-[10px] font-bold uppercase tracking-wide text-[var(--muted)]">
                                    {formatPageRange(childSection.printedPageStart, childSection.printedPageEnd)}
                                </span>
                            </Link>
                        ))}
                    </div>
                </nav>
            ) : null}

            {renderSectionContent(readingSection)}
        </div>
    )
}
