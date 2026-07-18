import { ArrowRight, FolderOpen, Plus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store'
import { parseImportedList } from '../../utils/localStorage'
import { computeEntriesVpr } from '../../utils/pointsCalc'

interface ListsPanelProps {
    onEnterBuilder: () => void
}

export default function ListsPanel({ onEnterBuilder }: ListsPanelProps) {
    const factions = useAppStore((state) => state.factions)
    const savedLists = useAppStore((state) => state.savedLists)
    const currentList = useAppStore((state) => state.currentList)
    const createList = useAppStore((state) => state.createList)
    const openList = useAppStore((state) => state.openList)
    const deleteList = useAppStore((state) => state.deleteList)
    const importList = useAppStore((state) => state.importList)
    const units = useAppStore((state) => state.units)
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [factionId, setFactionId] = useState('')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const factionNames = useMemo(() => new Map(factions.map((faction) => [faction.id, faction.name])), [factions])

    const handleOpenList = (listId: string) => {
        openList(listId)
        onEnterBuilder()
    }

    const importFile = async (file: File) => {
        try {
            const data: unknown = JSON.parse(await file.text())
            const importedList = parseImportedList(data, units)
            if (!importedList) {
                window.alert('This file is not a valid Dystopian Wars list.')
                return
            }
            importList(importedList)
            onEnterBuilder()
        } catch {
            window.alert('Could not read this list file.')
        }
    }

    return (
        <main className="min-h-full bg-[var(--panel)]">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
                <div className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--detail-row)] shadow-sm">
                    <div className="border-b border-[var(--panel-border)] bg-[linear-gradient(135deg,var(--navy),var(--navy-light))] px-5 py-6 text-white sm:px-7 sm:py-7">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--gold)]">
                                    Fleet command
                                </div>
                                <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                                    Your army lists
                                </h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-white/70">
                                    Create a fleet, reopen a saved build, or load one from a file.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 min-[420px]:flex-row">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(true)}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--gold)] px-4 py-2.5 text-sm font-semibold text-[var(--navy)] shadow-sm transition hover:brightness-105"
                                >
                                    <Plus size={16} />
                                    New list
                                </button>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                                >
                                    <FolderOpen size={16} />
                                    Load list
                                </button>
                            </div>
                        </div>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/json,.json"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0]
                            event.target.value = ''
                            if (!file) return
                            void importFile(file)
                        }}
                    />

                    <div className="p-4 sm:p-6">
                        {showForm ? (
                            <form
                                className="mb-6 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 sm:p-5"
                                onSubmit={(event) => {
                                    event.preventDefault()
                                    if (!name.trim() || !factionId) return
                                    createList(name.trim(), factionId)
                                    setName('')
                                    setFactionId('')
                                    setShowForm(false)
                                    onEnterBuilder()
                                }}
                            >
                                <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-sm font-semibold text-[var(--text)]">Create a new list</h2>
                                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                                            Choose a name and starting faction.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        title="Close"
                                        aria-label="Close new list form"
                                        onClick={() => setShowForm(false)}
                                        className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--detail-row)] hover:text-[var(--text)]"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)_auto]">
                                    <input
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        placeholder="List name"
                                        aria-label="List name"
                                        autoFocus
                                        className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                                    />
                                    <select
                                        value={factionId}
                                        onChange={(event) => setFactionId(event.target.value)}
                                        aria-label="Faction"
                                        className="min-w-0 rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] px-3 py-2.5 text-sm text-[var(--text)] outline-none transition focus:border-[var(--gold)]"
                                    >
                                        <option value="">Select faction</option>
                                        {factions.map((faction) => (
                                            <option key={faction.id} value={faction.id}>
                                                {faction.name}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--navy-light)]"
                                    >
                                        Create
                                    </button>
                                </div>
                            </form>
                        ) : null}

                        <div className="mb-3 flex items-center justify-between gap-3">
                            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                                My lists
                            </h2>
                            <span className="rounded-full bg-[var(--detail-panel)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-foreground)]">
                                {savedLists.length}
                            </span>
                        </div>

                        {savedLists.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)] px-5 py-12 text-center">
                                <div className="text-base font-semibold text-[var(--text)]">No saved lists yet</div>
                                <p className="mt-1 text-sm text-[var(--muted)]">
                                    Create your first fleet to start building.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(true)}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
                                >
                                    <Plus size={16} />
                                    New list
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {savedLists.map((list) => {
                                    const active = currentList?.id === list.id
                                    const total = list.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
                                    const totalVpr = computeEntriesVpr(list.units, units)
                                    return (
                                        <article
                                            key={list.id}
                                            className={`group relative flex min-h-40 cursor-pointer flex-col rounded-xl border p-4 transition ${active ? 'border-[var(--gold)] bg-[var(--gold-light)] shadow-sm' : 'border-[var(--panel-border)] bg-[var(--detail-row)] hover:-translate-y-0.5 hover:border-[rgb(var(--navy-rgb)/0.35)] hover:shadow-md'}`}
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleOpenList(list.id)}
                                                aria-label={`Open ${list.name}`}
                                                className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2"
                                            />
                                            <div className="pointer-events-none relative z-10 flex h-full flex-1 flex-col">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0 flex-1 text-left">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="truncate text-base font-semibold text-[var(--text)]">
                                                                {list.name}
                                                            </h3>
                                                            {active ? (
                                                                <span className="flex-none rounded-full bg-[var(--navy)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                                                                    Open
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        <p className="mt-1 text-xs text-[var(--muted)]">
                                                            {factionNames.get(list.faction_id) ?? list.faction_id} ·{' '}
                                                            {list.units.length}{' '}
                                                            {list.units.length === 1 ? 'unit' : 'units'}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        title={`Delete ${list.name}`}
                                                        aria-label={`Delete ${list.name}`}
                                                        onClick={() => {
                                                            if (window.confirm(`Delete "${list.name}"?`))
                                                                deleteList(list.id)
                                                        }}
                                                        className="pointer-events-auto rounded-md p-1.5 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
                                                    >
                                                        <X size={15} />
                                                    </button>
                                                </div>
                                                <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                                                    <div>
                                                        <div className="text-lg font-semibold tabular-nums text-[var(--accent-foreground)]">
                                                            {total.toLocaleString('fr-FR')} pts
                                                        </div>
                                                        <div className="text-xs font-medium text-[var(--muted)]">
                                                            {totalVpr.toLocaleString('fr-FR')} VPR
                                                        </div>
                                                    </div>
                                                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] bg-[var(--detail-row)] px-3 py-2 text-xs font-semibold text-[var(--accent-foreground)] transition group-hover:border-[var(--gold)]">
                                                        Build
                                                        <ArrowRight size={14} />
                                                    </span>
                                                </div>
                                            </div>
                                        </article>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    )
}
