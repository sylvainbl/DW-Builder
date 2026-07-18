import { ChevronDown, Maximize2, X } from 'lucide-react'
import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { findNormalizedMatch, getRuleInlineSegments, getRuleTextBlocks } from '../../rulebook/data'
import type { CuratedVisual, RuleTable } from '../../rulebook/types'

const RulebookTextContext = createContext<string[]>([])

export function RulebookTextProvider({ terms, children }: { terms: string[], children: ReactNode }) {
    return (
        <RulebookTextContext.Provider value={terms}>
            {children}
        </RulebookTextContext.Provider>
    )
}

interface RuleTextProps {
    text: string
    className?: string
    headingLevel?: 3 | 4 | 5
}

export function RuleText({ text, className = '', headingLevel = 3 }: RuleTextProps) {
    const terms = useContext(RulebookTextContext)
    const emphasizedTerms = new Set<string>()
    const renderInlineText = (textValue: string) => {
        const availableTerms = terms.filter((term) => !emphasizedTerms.has(term.toLocaleLowerCase('en')))
        const segments = getRuleInlineSegments(textValue, availableTerms)
        for (const segment of segments) {
            if (segment.kind === 'strong') emphasizedTerms.add(segment.text.toLocaleLowerCase('en'))
        }
        return segments.map((segment, index) => (
            segment.kind === 'strong'
                ? <strong key={`${segment.text}-${index}`} className="font-bold">{segment.text}</strong>
                : <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ))
    }
    const renderHeading = (textValue: string, key: string) => {
        const classNames = 'pt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-foreground)]'
        if (headingLevel === 5) return <h5 key={key} className={classNames}>{renderInlineText(textValue)}</h5>
        if (headingLevel === 4) return <h4 key={key} className={classNames}>{renderInlineText(textValue)}</h4>
        return <h3 key={key} className={classNames}>{renderInlineText(textValue)}</h3>
    }

    return (
        <div className={`space-y-3 text-[15px] leading-7 text-[var(--text)] [text-wrap:pretty] ${className}`}>
            {getRuleTextBlocks(text).map((block, index) => {
                if (block.kind === 'heading') {
                    return renderHeading(block.text, `${block.text}-${index}`)
                }
                if (block.kind === 'unordered-list') {
                    return (
                        <ul key={index} className="list-disc space-y-2 pl-6 marker:text-[var(--gold)]">
                            {block.items.map((item, itemIndex) => (
                                <li key={`${item}-${itemIndex}`} className="pl-1">
                                    {renderInlineText(item)}
                                </li>
                            ))}
                        </ul>
                    )
                }
                if (block.kind === 'ordered-list') {
                    return (
                        <ol
                            key={index}
                            type={block.style === 'lower-alpha' ? 'a' : '1'}
                            className={`list-outside space-y-3 pl-7 marker:font-bold marker:text-[var(--gold)] ${block.style === 'lower-alpha'
                                ? '[list-style-type:lower-alpha]'
                                : 'list-decimal'}`}
                        >
                            {block.items.map((item) => (
                                <li key={`${item.marker}-${item.title}`} className="pl-1">
                                    {item.paragraphs.length > 0 ? (
                                        <>
                                            <strong className="font-bold text-[var(--accent-foreground)]">
                                                {renderInlineText(item.title)}
                                            </strong>
                                            <div className="mt-1 space-y-2">
                                                {item.paragraphs.map((paragraph, paragraphIndex) => (
                                                    <p key={`${paragraph}-${paragraphIndex}`}>
                                                        {renderInlineText(paragraph)}
                                                    </p>
                                                ))}
                                            </div>
                                        </>
                                    ) : renderInlineText(item.title)}
                                </li>
                            ))}
                        </ol>
                    )
                }
                return (
                    <p key={index}>
                        {renderInlineText(block.text)}
                    </p>
                )
            })}
        </div>
    )
}

interface HighlightedTextProps {
    text: string
    query: string
}

export function HighlightedText({ text, query }: HighlightedTextProps) {
    const match = findNormalizedMatch(text, query)
    if (!match) return text

    return (
        <>
            {text.slice(0, match.start)}
            <mark className="rounded-sm bg-[var(--gold-light)] px-0.5 text-[var(--text)]">
                {text.slice(match.start, match.end)}
            </mark>
            {text.slice(match.end)}
        </>
    )
}

interface CuratedVisualFigureProps {
    visual: CuratedVisual
    onOpen: (visual: CuratedVisual) => void
    compact?: boolean
    collapsed?: boolean
}

export function CuratedVisualFigure({ visual, onOpen, compact = false, collapsed = false }: CuratedVisualFigureProps) {
    const figure = (
        <figure className={collapsed
            ? 'overflow-hidden bg-[var(--detail-row)]'
            : `overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--detail-row)] shadow-sm ${compact ? '' : 'my-5'}`}>
            <button
                type="button"
                onClick={() => onOpen(visual)}
                className="group relative block w-full cursor-zoom-in bg-white p-2 text-left"
                aria-label={`Open ${visual.title} diagram`}
            >
                <img
                    src={`/data/${visual.assetReference}`}
                    alt={visual.altText}
                    width={visual.width}
                    height={visual.height}
                    loading="lazy"
                    className={`mx-auto h-auto max-w-full object-contain ${compact ? 'max-h-72' : 'max-h-[36rem]'}`}
                />
                <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(var(--navy-rgb)/0.88)] text-white opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <Maximize2 size={15} aria-hidden="true" />
                </span>
            </button>
            <figcaption className="border-t border-[var(--panel-border)] px-4 py-3">
                {!collapsed ? <div className="text-sm font-semibold text-[var(--accent-foreground)]">{visual.title}</div> : null}
                {visual.description ? <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{visual.description}</p> : null}
            </figcaption>
        </figure>
    )

    if (!collapsed) return figure

    return (
        <details className={`group/visual overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--detail-row)] shadow-sm ${compact ? 'mt-4' : 'my-5'}`}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--gold)]">Diagram</span>
                    <span className="mt-0.5 block text-sm font-semibold text-[var(--accent-foreground)]">{visual.title}</span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                    <span className="group-open/visual:hidden">Show</span>
                    <span className="hidden group-open/visual:inline">Hide</span>
                    <ChevronDown
                        size={15}
                        aria-hidden="true"
                        className="transition-transform group-open/visual:rotate-180"
                    />
                </span>
            </summary>
            <div className="border-t border-[var(--panel-border)]">
                {figure}
            </div>
        </details>
    )
}

interface VisualLightboxProps {
    visual: CuratedVisual | null
    onClose: () => void
    returnFocusTo: HTMLElement | null
}

export function VisualLightbox({ visual, onClose, returnFocusTo }: VisualLightboxProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!visual) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
            }
            if (event.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            )).filter((element) => !element.hasAttribute('disabled'))
            if (focusableElements.length === 0) return

            const first = focusableElements[0]
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
            returnFocusTo?.focus()
        }
    }, [onClose, returnFocusTo, visual])

    if (!visual) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label={visual.title}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div ref={dialogRef} className="relative max-h-full max-w-6xl overflow-auto rounded-xl bg-white p-3 shadow-2xl">
                <button
                    type="button"
                    onClick={onClose}
                    autoFocus
                    className="sticky right-0 top-0 z-10 ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy)] text-white shadow"
                    aria-label="Close diagram"
                >
                    <X size={18} aria-hidden="true" />
                </button>
                <img
                    src={`/data/${visual.assetReference}`}
                    alt={visual.altText}
                    width={visual.width}
                    height={visual.height}
                    className="mx-auto h-auto max-h-[78vh] max-w-full object-contain"
                />
                <div className="max-w-3xl px-3 pb-3 pt-4 text-slate-900">
                    <div className="font-semibold">{visual.title}</div>
                    {visual.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{visual.description}</p> : null}
                </div>
            </div>
        </div>
    )
}

interface RuleTableViewProps {
    table: RuleTable
}

function renderCell(value: RuleTable['rows'][number][number]) {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    return value ?? '—'
}

export function RuleTableView({ table }: RuleTableViewProps) {
    const hasTypedRecords = Boolean(table.columns?.length && table.records?.length)
    const columns = hasTypedRecords
        ? table.columns ?? []
        : (table.rows[0] ?? []).map((title, index) => ({ id: String(index), title: String(title), type: 'string' }))
    const records = hasTypedRecords
        ? table.records ?? []
        : table.rows.slice(1).map((row) => Object.fromEntries(row.map((value, index) => [String(index), value])))

    return (
        <section id={`table-${table.id}`} className="my-5 overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--detail-row)] shadow-sm">
            <div className="border-b border-[var(--panel-border)] bg-[var(--detail-panel)] px-4 py-3">
                <h3 className="font-semibold text-[var(--accent-foreground)]">{table.title}</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Printed page {table.printedPage}</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                    <thead>
                        <tr className="bg-[var(--detail-row)]">
                            {columns.map((column) => (
                                <th key={column.id} scope="col" className="border-b border-[var(--panel-border)] px-4 py-3 text-xs font-bold tracking-wide text-[var(--accent-foreground)]">
                                    <span className="whitespace-pre-line">{column.title}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {records.map((record, rowIndex) => (
                            <tr key={rowIndex} className="odd:bg-[var(--detail-panel)]">
                                {columns.map((column) => (
                                    <td key={column.id} className="border-b border-[var(--panel-border)] px-4 py-3 align-top text-[var(--text)] last:border-r-0">
                                        <span className="whitespace-pre-line">{renderCell(record[column.id])}</span>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    )
}
