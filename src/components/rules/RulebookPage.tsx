import { BookOpen, ChevronRight, Menu, Search, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import {
    buildRulebookIndexes,
    buildRulebookSearchIndex,
    getRulebookHref,
    getViewForSearchResult,
    loadRulebookData,
    searchRulebook,
} from '../../rulebook/data'
import type { RulebookIndexes } from '../../rulebook/data'
import type {
    CuratedVisual,
    RulebookNavigationItem,
    RuleSearchResult,
    RulebookData,
    RulebookSection,
    RulebookView,
} from '../../rulebook/types'
import RulebookSectionView from './RulebookSectionView'
import { ActionsView, EncountersView, ProceduresView, TerrainView, TokensView } from './RulebookSpecialViews'
import { HighlightedText, RulebookTextProvider, VisualLightbox } from './RulebookPrimitives'

const VIEW_OPTIONS: { value: RulebookView; label: string }[] = [
    { value: 'sections', label: 'Rules' },
    { value: 'procedures', label: 'Procedures' },
    { value: 'actions', label: 'Actions' },
    { value: 'tokens', label: 'Tokens' },
    { value: 'terrain', label: 'Terrain' },
    { value: 'encounters', label: 'Encounters' },
]

function parseView(search: string): RulebookView {
    const value = new URLSearchParams(search).get('view')
    return VIEW_OPTIONS.some((option) => option.value === value) ? (value as RulebookView) : 'sections'
}

interface RulebookNavigationProps {
    items: RulebookNavigationItem[]
    indexes: RulebookIndexes
    selectedSectionId: string
    onNavigate?: () => void
}

function RulebookNavigation({ items, indexes, selectedSectionId, onNavigate }: RulebookNavigationProps) {
    const selectedPath = indexes.sectionById.get(selectedSectionId)?.path ?? []
    const [expandedIds, setExpandedIds] = useState<Set<string>>(
        () => new Set([...items.map((item) => item.sectionId), ...selectedPath]),
    )

    const toggleExpanded = (sectionId: string) => {
        setExpandedIds((current) => {
            const next = new Set(current)
            if (next.has(sectionId)) next.delete(sectionId)
            else next.add(sectionId)
            return next
        })
    }

    const renderItems = (navigationItems: RulebookNavigationItem[], depth = 0) =>
        navigationItems.map((item) => {
            const isActive = item.sectionId === selectedSectionId
            const hasChildren = item.children.length > 0
            const isExpanded = expandedIds.has(item.sectionId)
            const rowClassName = `flex border-l-2 text-xs leading-4 transition ${depth === 0 ? 'font-bold' : 'font-medium'} ${
                isActive
                    ? 'border-[var(--gold)] bg-[var(--detail-panel-strong)] text-[var(--accent-foreground)]'
                    : 'border-transparent text-[var(--text)] hover:border-[var(--panel-border)] hover:bg-[var(--detail-panel)]'
            }`

            return (
                <div key={item.id}>
                    <div className={rowClassName}>
                        <Link
                            to={getRulebookHref(item.sectionId)}
                            onClick={onNavigate}
                            aria-current={isActive ? 'page' : undefined}
                            style={{ paddingLeft: `${12 + depth * 13}px` }}
                            className="min-w-0 flex-1 py-2 pr-1"
                        >
                            {item.title}
                        </Link>
                        {hasChildren ? (
                            <button
                                type="button"
                                onClick={() => toggleExpanded(item.sectionId)}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${item.title}`}
                                className="flex w-8 flex-none items-center justify-center text-[var(--muted)] transition hover:text-[var(--accent-foreground)] focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[var(--gold)]"
                            >
                                <ChevronRight
                                    size={14}
                                    aria-hidden="true"
                                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                            </button>
                        ) : null}
                    </div>
                    {hasChildren && isExpanded ? renderItems(item.children, depth + 1) : null}
                </div>
            )
        })

    return (
        <nav aria-label="Rulebook contents" className="py-3">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Table of contents
            </p>
            {renderItems(items)}
        </nav>
    )
}

interface SearchResultsProps {
    query: string
    results: RuleSearchResult[]
    onSelect: (result: RuleSearchResult) => void
}

function SearchResults({ query, results, onSelect }: SearchResultsProps) {
    return (
        <div className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-40 max-h-[min(30rem,70vh)] overflow-y-auto rounded-xl border border-[var(--panel-border)] bg-[var(--detail-row)] p-1.5 shadow-2xl">
            {results.length > 0 ? (
                results.map((result) => (
                    <button
                        key={`${result.kind}-${result.id}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => onSelect(result)}
                        className="block w-full rounded-lg px-3 py-2.5 text-left hover:bg-[var(--detail-panel)] focus:bg-[var(--detail-panel)] focus:outline-none"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--text)]">
                                <HighlightedText text={result.title} query={query} />
                            </span>
                            <span className="flex-none rounded-full border border-[var(--panel-border)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--muted)]">
                                {result.kind}
                            </span>
                        </div>
                        {result.snippet ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--muted)]">
                                <HighlightedText text={result.snippet} query={query} />
                            </p>
                        ) : null}
                    </button>
                ))
            ) : (
                <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">No matching rules.</p>
            )}
        </div>
    )
}

interface RulebookSearchProps {
    data: RulebookData
    onSelect: (result: RuleSearchResult) => void
}

function RulebookSearch({ data, onSelect }: RulebookSearchProps) {
    const [query, setQuery] = useState('')
    const [focused, setFocused] = useState(false)
    const deferredQuery = useDeferredValue(query)
    const searchIndex = useMemo(() => buildRulebookSearchIndex(data), [data])
    const results = useMemo(() => searchRulebook(searchIndex, deferredQuery), [deferredQuery, searchIndex])

    const selectResult = (result: RuleSearchResult) => {
        onSelect(result)
        setQuery('')
        setFocused(false)
    }

    return (
        <div className="relative order-2 min-w-0 flex-1 lg:order-3 lg:max-w-sm">
            <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Search rules, actions, terrain…"
                aria-label="Search the rulebook"
                className="h-9 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[rgb(var(--gold-rgb)/0.18)]"
            />
            {focused && query.trim() && deferredQuery.trim() ? (
                <SearchResults query={deferredQuery} results={results} onSelect={selectResult} />
            ) : null}
        </div>
    )
}

interface ReferenceRailProps {
    data: RulebookData
    indexes: RulebookIndexes
    section: RulebookSection
}

function ReferenceRail({ data, indexes, section }: ReferenceRailProps) {
    const sourcePages = new Set(section.source.printedPages)
    const referenceKeys = new Set<string>()
    const references = data.pageReferenceLinks
        .filter((reference) => {
            if (!sourcePages.has(reference.sourcePrintedPage)) return false
            const key = `${reference.label}:${reference.targetSectionId}:${reference.targetRuleBlockId ?? ''}`
            if (referenceKeys.has(key)) return false
            referenceKeys.add(key)
            return indexes.sectionById.has(reference.targetSectionId)
        })
        .slice(0, 14)

    const sourceIds = new Set([section.id, ...section.ruleBlockIds])
    const semanticKeys = new Set<string>()
    const related = data.semanticLinks
        .flatMap((link) => {
            if (!sourceIds.has(link.from)) return []
            const targetRule = indexes.ruleById.get(link.to) ?? indexes.ruleById.get(`rule.${link.to}`)
            const targetSection =
                indexes.sectionById.get(link.to) ??
                (targetRule ? indexes.sectionById.get(targetRule.sectionId) : undefined)
            if (!targetSection) return []
            const key = `${targetSection.id}:${targetRule?.id ?? ''}`
            if (semanticKeys.has(key)) return []
            semanticKeys.add(key)
            return [
                {
                    id: link.id,
                    title: indexes.entityTitleById.get(link.to) ?? targetRule?.title ?? targetSection.title,
                    relation: link.relation,
                    href: getRulebookHref(targetSection.id, targetRule?.id),
                },
            ]
        })
        .slice(0, 10)

    return (
        <aside className="h-full overflow-y-auto border-l border-[var(--panel-border)] bg-[var(--detail-row)] p-4">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-foreground)]">
                References
            </h2>
            {references.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                    {references.map((reference) => (
                        <li key={reference.id}>
                            <Link
                                to={getRulebookHref(reference.targetSectionId, reference.targetRuleBlockId)}
                                className="block rounded-lg border border-[var(--panel-border)] bg-[var(--detail-panel)] px-3 py-2 text-xs hover:border-[var(--gold)]"
                            >
                                <span className="font-semibold text-[var(--text)]">{reference.label}</span>
                                <span className="mt-0.5 block text-[10px] text-[var(--muted)]">
                                    Printed page {reference.targetPrintedPage}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">No page references in this section.</p>
            )}

            {related.length > 0 ? (
                <>
                    <h2 className="mt-6 text-xs font-bold uppercase tracking-[0.14em] text-[var(--accent-foreground)]">
                        Related rules
                    </h2>
                    <ul className="mt-3 space-y-1.5">
                        {related.map((item) => (
                            <li key={item.id}>
                                <Link
                                    to={item.href}
                                    className="block rounded-lg px-2 py-2 text-xs hover:bg-[var(--detail-panel)]"
                                >
                                    <span className="font-semibold text-[var(--text)]">{item.title}</span>
                                    <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-[var(--muted)]">
                                        {item.relation.replaceAll('_', ' ')}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </aside>
    )
}

function SelectedView({
    view,
    section,
    data,
    indexes,
    onOpenVisual,
}: {
    view: RulebookView
    section: RulebookSection
    data: RulebookData
    indexes: RulebookIndexes
    onOpenVisual: (visual: CuratedVisual) => void
}) {
    if (view === 'procedures') return <ProceduresView data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
    if (view === 'actions') return <ActionsView data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
    if (view === 'tokens') return <TokensView data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
    if (view === 'terrain') return <TerrainView data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
    if (view === 'encounters') return <EncountersView data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
    return <RulebookSectionView section={section} data={data} indexes={indexes} onOpenVisual={onOpenVisual} />
}

export default function RulebookPage() {
    const { sectionId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const [data, setData] = useState<RulebookData | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loadAttempt, setLoadAttempt] = useState(0)
    const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
    const [activeVisual, setActiveVisual] = useState<CuratedVisual | null>(null)
    const [visualTrigger, setVisualTrigger] = useState<HTMLElement | null>(null)
    const mobileNavigationDialogRef = useRef<HTMLDivElement>(null)
    const mobileNavigationButtonRef = useRef<HTMLButtonElement>(null)
    const view = parseView(location.search)
    const indexes = useMemo(() => (data ? buildRulebookIndexes(data) : null), [data])

    useEffect(() => {
        let active = true
        loadRulebookData()
            .then((loadedData) => {
                if (active) setData(loadedData)
            })
            .catch((reason: unknown) => {
                if (active) setError(reason instanceof Error ? reason.message : 'Could not load the rulebook.')
            })
        return () => {
            active = false
        }
    }, [loadAttempt])

    const defaultSectionId = indexes?.sectionById.has('core-rules')
        ? 'core-rules'
        : indexes?.flatNavigation[0]?.sectionId
    const selectedSection =
        indexes && data
            ? (indexes.sectionById.get(sectionId ?? '') ??
              (defaultSectionId ? indexes.sectionById.get(defaultSectionId) : undefined))
            : undefined

    useEffect(() => {
        if (!selectedSection || sectionId === selectedSection.id) return
        void navigate(getRulebookHref(selectedSection.id, undefined, view), { replace: true })
    }, [navigate, sectionId, selectedSection, view])

    useEffect(() => {
        if (!data || !location.hash) return
        const anchorId = decodeURIComponent(location.hash.slice(1))
        window.requestAnimationFrame(() => {
            const element = document.getElementById(anchorId)
            if (!element) return
            const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
            element.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
        })
    }, [data, location.hash, view])

    useEffect(() => {
        if (!mobileNavigationOpen) return
        const navigationButton = mobileNavigationButtonRef.current

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                setMobileNavigationOpen(false)
                return
            }
            if (event.key !== 'Tab' || !mobileNavigationDialogRef.current) return

            const focusableElements = Array.from(
                mobileNavigationDialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                ),
            ).filter((element) => !element.hasAttribute('disabled'))
            if (focusableElements.length === 0) return

            const first = focusableElements[0]
            if (!first) return
            const last = focusableElements.at(-1) ?? first
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            navigationButton?.focus()
        }
    }, [mobileNavigationOpen])

    if (error) {
        return (
            <div className="flex h-full items-center justify-center bg-[var(--panel)] p-6">
                <div className="max-w-md rounded-2xl border border-red-300 bg-[var(--detail-row)] p-6 text-center shadow-lg">
                    <h1 className="text-lg font-bold text-[var(--text)]">Rulebook unavailable</h1>
                    <p className="mt-2 text-sm text-[var(--muted)]">{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            setError(null)
                            setLoadAttempt((attempt) => attempt + 1)
                        }}
                        className="mt-4 rounded-lg bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-white"
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    if (!data || !indexes || !selectedSection) {
        return (
            <div className="flex h-full items-center justify-center bg-[var(--panel)] p-6 text-[var(--text)]">
                <div className="flex items-center gap-3 text-sm font-semibold">
                    <BookOpen size={20} className="text-[var(--gold)]" />
                    Loading core rules…
                </div>
            </div>
        )
    }

    const selectSearchResult = (result: RuleSearchResult) => {
        const resultView = getViewForSearchResult(result)
        void navigate(getRulebookHref(result.sectionId ?? selectedSection.id, result.id, resultView))
        setMobileNavigationOpen(false)
    }
    const openVisual = (visual: CuratedVisual) => {
        setVisualTrigger(document.activeElement instanceof HTMLElement ? document.activeElement : null)
        setActiveVisual(visual)
    }

    return (
        <RulebookTextProvider terms={indexes.ruleTerms}>
            <div className="flex h-full min-h-0 flex-col bg-[var(--panel)] text-[var(--text)]">
                <div className="relative z-30 flex flex-none flex-col gap-2 border-b border-[var(--panel-border)] bg-[rgb(var(--panel-rgb)/0.97)] px-3 py-2 shadow-sm backdrop-blur sm:px-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-2">
                        <button
                            ref={mobileNavigationButtonRef}
                            type="button"
                            onClick={() => setMobileNavigationOpen(true)}
                            className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] text-[var(--accent-foreground)] lg:hidden"
                            aria-label="Open rulebook contents"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-[var(--accent-foreground)]">
                                {data.manifest.title}
                            </p>
                            <p className="text-[10px] text-[var(--muted)]">Version {data.manifest.version}</p>
                        </div>
                    </div>

                    <div
                        className="order-3 grid w-full grid-cols-3 gap-1 sm:grid-cols-6 lg:order-2 lg:flex lg:w-auto lg:max-w-full lg:overflow-x-auto"
                        aria-label="Rulebook views"
                    >
                        {VIEW_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() =>
                                    void navigate(getRulebookHref(selectedSection.id, undefined, option.value))
                                }
                                aria-pressed={view === option.value}
                                className={`flex-none rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                    view === option.value
                                        ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)]'
                                        : 'border-[var(--panel-border)] bg-[var(--detail-row)] text-[var(--text)] hover:border-[var(--gold)]'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <RulebookSearch data={data} onSelect={selectSearchResult} />
                </div>

                <div
                    className={`grid min-h-0 flex-1 overflow-hidden ${view === 'sections' ? 'lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_16rem]' : 'lg:grid-cols-[18rem_minmax(0,1fr)]'}`}
                >
                    <aside className="hidden h-full overflow-y-auto border-r border-[var(--panel-border)] bg-[var(--detail-row)] lg:block">
                        <RulebookNavigation
                            key={`desktop-${selectedSection.id}`}
                            items={data.navigation}
                            indexes={indexes}
                            selectedSectionId={selectedSection.id}
                        />
                    </aside>

                    <main className="min-h-0 overflow-y-auto px-3 py-4 sm:px-5 sm:py-6">
                        <SelectedView
                            view={view}
                            section={selectedSection}
                            data={data}
                            indexes={indexes}
                            onOpenVisual={openVisual}
                        />
                    </main>

                    {view === 'sections' ? (
                        <div className="hidden min-h-0 xl:block">
                            <ReferenceRail data={data} indexes={indexes} section={selectedSection} />
                        </div>
                    ) : null}
                </div>

                {mobileNavigationOpen ? (
                    <div
                        ref={mobileNavigationDialogRef}
                        className="fixed inset-0 z-50 bg-slate-950/60 lg:hidden"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Rulebook contents"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget) setMobileNavigationOpen(false)
                        }}
                    >
                        <aside className="h-full w-[min(22rem,88vw)] overflow-y-auto bg-[var(--detail-row)] shadow-2xl">
                            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--detail-row)] px-3 py-3">
                                <span className="text-sm font-bold text-[var(--accent-foreground)]">
                                    Rulebook contents
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMobileNavigationOpen(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--panel-border)]"
                                    aria-label="Close rulebook contents"
                                    autoFocus
                                >
                                    <X size={18} aria-hidden="true" />
                                </button>
                            </div>
                            <RulebookNavigation
                                key={`mobile-${selectedSection.id}`}
                                items={data.navigation}
                                indexes={indexes}
                                selectedSectionId={selectedSection.id}
                                onNavigate={() => setMobileNavigationOpen(false)}
                            />
                        </aside>
                    </div>
                ) : null}

                <VisualLightbox
                    visual={activeVisual}
                    onClose={() => setActiveVisual(null)}
                    returnFocusTo={visualTrigger}
                />
            </div>
        </RulebookTextProvider>
    )
}
