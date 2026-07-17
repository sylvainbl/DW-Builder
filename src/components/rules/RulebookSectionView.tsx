import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    flattenSectionTree,
    formatPageRange,
    getRulebookHref,
    hasRenderableRuleContent,
    hasSamePageRange,
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

    const tables = rule.tableIds
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
                <CuratedVisualFigure key={visual.id} visual={visual} onOpen={onOpenVisual} collapsed />
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
    const readingSection = resolveReadingSection(section, indexes)
    const readingSections = flattenSectionTree(readingSection, indexes)
    const nestedSections = readingSections.slice(1)
    const renderedTableIds = new Set<string>()
    const renderedVisualIds = new Set<string>()
    const renderedRuleIds = new Set<string>()
    const breadcrumbSections = readingSection.path
        .map((id) => indexes.sectionById.get(id))
        .filter((item): item is RulebookSection => Boolean(item))

    useEffect(() => {
        if (section.id === readingSection.id || window.location.hash) return
        window.requestAnimationFrame(() => {
            document.getElementById(`section-${section.id}`)?.scrollIntoView({ block: 'start' })
        })
    }, [readingSection.id, section.id])

    const renderSectionContent = (currentSection: RulebookSection) => {
        const rules = resolveSectionRuleBlocks(currentSection, indexes)
            .filter((rule) => hasRenderableRuleContent(rule, indexes))
            .filter((rule) => {
                if (renderedRuleIds.has(rule.id)) return false
                renderedRuleIds.add(rule.id)
                return true
            })
        const sectionTables = currentSection.tableIds.flatMap((id) => {
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
                    <CuratedVisualFigure key={visual.id} visual={visual} onOpen={onOpenVisual} collapsed />
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

            {nestedSections.length > 0 ? (
                <nav aria-label="On this page" className="mb-7 rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-panel)] p-5">
                    <h2 className="text-sm font-bold uppercase tracking-[0.13em] text-[var(--accent-foreground)]">On this page</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {nestedSections.map((nestedSection) => (
                            <Link
                                key={nestedSection.id}
                                to={getRulebookHref(nestedSection.id, `section-${nestedSection.id}`)}
                                style={{ paddingLeft: `${12 + Math.max(0, nestedSection.level - readingSection.level - 1) * 12}px` }}
                                className={`flex items-center justify-between gap-3 rounded-xl border bg-[var(--detail-row)] py-3 pr-3 text-sm font-semibold transition hover:border-[var(--gold)] hover:text-[var(--accent-foreground)] ${nestedSection.id === section.id
                                    ? 'border-[var(--gold)] text-[var(--accent-foreground)]'
                                    : 'border-[var(--panel-border)] text-[var(--text)]'}`}
                            >
                                <span>{nestedSection.title}</span>
                            </Link>
                        ))}
                    </div>
                </nav>
            ) : null}

            {renderSectionContent(readingSection)}

            {nestedSections.map((nestedSection, index) => {
                const relativeDepth = nestedSection.level - readingSection.level
                const Heading = relativeDepth > 1 ? 'h3' : 'h2'
                const previousSection = index > 0 ? nestedSections[index - 1] : null
                const showPage = !previousSection || !hasSamePageRange(previousSection, nestedSection)
                return (
                    <section
                        key={nestedSection.id}
                        id={`section-${nestedSection.id}`}
                        className="scroll-mt-32 pt-10"
                    >
                        <header className={`mb-5 border-b pb-3 ${nestedSection.id === section.id
                            ? 'border-[var(--gold)]'
                            : 'border-[var(--panel-border)]'}`}>
                            {showPage ? (
                                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--gold)]">
                                    {formatPageRange(nestedSection.printedPageStart, nestedSection.printedPageEnd)}
                                </p>
                            ) : null}
                            <div className={`group/title inline-flex items-center gap-1.5 text-[var(--accent-foreground)] ${showPage ? 'mt-1' : ''}`}>
                                <Heading className={`${relativeDepth > 1 ? 'text-xl' : 'text-2xl'} font-bold`}>
                                    {nestedSection.title}
                                </Heading>
                                <CopyLinkIcon
                                    relativeUrl={getRulebookHref(nestedSection.id)}
                                    label={`Copy a direct link to ${nestedSection.title}`}
                                />
                            </div>
                        </header>
                        {renderSectionContent(nestedSection)}
                    </section>
                )
            })}
        </div>
    )
}
