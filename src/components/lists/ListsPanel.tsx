import { FolderOpen, Plus, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store'
import { parseImportedList } from '../../utils/localStorage'
import { computeEntriesVpr } from '../../utils/pointsCalc'

export default function ListsPanel() {
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

    return (
        <aside className="flex h-full flex-col bg-[var(--panel)] p-3">
            <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--navy-light)]"
            >
                <Plus size={15} />
                New list
            </button>
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
                <FolderOpen size={15} />
                Load list
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return

                    try {
                        const data = JSON.parse(await file.text())
                        const importedList = parseImportedList(data, units)
                        if (!importedList) {
                            window.alert('This file is not a valid Dystopian Wars list.')
                            return
                        }
                        importList(importedList)
                    } catch {
                        window.alert('Could not read this list file.')
                    }
                }}
            />

            {showForm ? (
                <form
                    className="mt-3 space-y-2 rounded-lg border border-neutral-200 bg-white p-3"
                    onSubmit={(event) => {
                        event.preventDefault()
                        if (!name.trim() || !factionId) return
                        createList(name.trim(), factionId)
                        setName('')
                        setFactionId('')
                        setShowForm(false)
                    }}
                >
                    <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="List name"
                        className="w-full rounded border border-neutral-200 px-2.5 py-2 text-sm outline-none"
                    />
                    <select
                        value={factionId}
                        onChange={(event) => setFactionId(event.target.value)}
                        className="w-full rounded border border-neutral-200 bg-white px-2.5 py-2 text-sm outline-none"
                    >
                        <option value="">Faction</option>
                        {factions.map((faction) => (
                            <option key={faction.id} value={faction.id}>{faction.name}</option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button type="submit" className="flex-1 rounded bg-[var(--navy)] px-2 py-1.5 text-xs font-medium text-white">
                            Create
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="flex-1 rounded border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            ) : null}

            <div className="mt-5 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">My lists</div>
            <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {savedLists.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-white/70 p-3 text-sm text-neutral-500">
                        No saved lists yet.
                    </div>
                ) : (
                    savedLists.map((list) => {
                        const active = currentList?.id === list.id
                        const total = list.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
                        const totalVpr = computeEntriesVpr(list.units, units)
                        return (
                            <div
                                key={list.id}
                                className={`w-full rounded-lg border p-3 text-left transition ${active ? 'border-[var(--navy)] bg-[var(--navy)] text-white shadow-sm' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                style={{ borderLeftWidth: active ? 5 : 1, borderLeftColor: active ? 'var(--gold)' : undefined }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openList(list.id)}
                                        className="min-w-0 flex-1 text-left"
                                    >
                                        <div className={`truncate text-sm font-medium ${active ? 'text-white' : 'text-neutral-900'}`}>▶ {list.name}</div>
                                        <div className={`mt-1 text-[11px] ${active ? 'text-white/70' : 'text-neutral-500'}`}>
                                            {factionNames.get(list.faction_id) ?? list.faction_id} · {list.units.length} u.
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        title="Delete"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            if (window.confirm(`Delete "${list.name}"?`)) deleteList(list.id)
                                        }}
                                        className={`rounded p-1 ${active ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-neutral-400 hover:bg-rose-50 hover:text-rose-600'}`}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openList(list.id)}
                                    className={`mt-2 text-left text-[12px] font-medium ${active ? 'text-white' : 'text-[var(--navy)]'}`}
                                >
                                    {total.toLocaleString('fr-FR')} pts · {totalVpr.toLocaleString('fr-FR')} VPR
                                </button>
                            </div>
                        )
                    })
                )}
            </div>
        </aside>
    )
}
