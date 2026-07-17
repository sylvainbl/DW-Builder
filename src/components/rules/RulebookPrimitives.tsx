import { ChevronDown, Maximize2, X } from 'lucide-react'
import { useEffect } from 'react'
import { findNormalizedMatch, getRuleTextBlocks } from '../../rulebook/data'
import type { CuratedVisual, RuleTable } from '../../rulebook/types'

interface RuleTextProps {
    text: string
    className?: string
}

export function RuleText({ text, className = '' }: RuleTextProps) {
    return (
        <div className={`space-y-3 text-[15px] leading-7 text-[var(--text)] [text-wrap:pretty] ${className}`}>
            {getRuleTextBlocks(text).map((block, index) => {
                if (block.kind === 'heading') {
                    return (
                        <h4 key={`${block.text}-${index}`} className="pt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--accent-foreground)]">
                            {block.text}
                        </h4>
                    )
                }
                return (
                    <p key={index}>
                        {block.text}
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
}

export function VisualLightbox({ visual, onClose }: VisualLightboxProps) {
    useEffect(() => {
        if (!visual) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose, visual])

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
            <div className="relative max-h-full max-w-6xl overflow-auto rounded-xl bg-white p-3 shadow-2xl">
                <button
                    type="button"
                    onClick={onClose}
                    autoFocus
                    className="sticky right-0 top-0 z-10 ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy)] text-white shadow"
                    aria-label="Close diagram"
                >
                    <X size={18} />
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
