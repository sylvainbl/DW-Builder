import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'

export default function ListsPanel() {
    const factions = useAppStore((state) => state.factions)
    const savedLists = useAppStore((state) => state.savedLists)
    const currentList = useAppStore((state) => state.currentList)
    const createList = useAppStore((state) => state.createList)
    const openList = useAppStore((state) => state.openList)
    const deleteList = useAppStore((state) => state.deleteList)
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [factionId, setFactionId] = useState('')

    const factionNames = useMemo(() => new Map(factions.map((faction) => [faction.id, faction.name])), [factions])

    return (
        <aside className="flex h-full flex-col bg-[var(--panel)] p-3">
            <button
                type="button"
                onClick={() => setShowForm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--navy)] px-3 py-2.5 text-sm font-medium text-white transition hover:bg-[var(--navy-light)]"
            >
                <Plus size={15} />
                Nouvelle liste
            </button>

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
                        placeholder="Nom de la liste"
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
                            Créer
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                            className="flex-1 rounded border border-neutral-200 px-2 py-1.5 text-xs text-neutral-600"
                        >
                            Annuler
                        </button>
                    </div>
                </form>
            ) : null}

            <div className="mt-5 px-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Mes listes</div>
            <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
                {savedLists.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-white/70 p-3 text-sm text-neutral-500">
                        Aucune liste sauvegardée.
                    </div>
                ) : (
                    savedLists.map((list) => {
                        const active = currentList?.id === list.id
                        const total = list.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
                        return (
                            <button
                                key={list.id}
                                type="button"
                                onClick={() => openList(list.id)}
                                className={`w-full rounded-lg border p-3 text-left transition ${active ? 'border-blue-200 bg-blue-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                                style={{ borderLeftWidth: active ? 4 : 1 }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-neutral-900">▶ {list.name}</div>
                                        <div className="mt-1 text-[11px] text-neutral-500">
                                            {factionNames.get(list.faction_id) ?? list.faction_id} · {list.units.length} u.
                                        </div>
                                    </div>
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        title="Supprimer"
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            if (window.confirm(`Supprimer "${list.name}" ?`)) deleteList(list.id)
                                        }}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault()
                                                event.stopPropagation()
                                                if (window.confirm(`Supprimer "${list.name}" ?`)) deleteList(list.id)
                                            }
                                        }}
                                        className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                                    >
                                        <X size={14} />
                                    </span>
                                </div>
                                <div className="mt-2 text-[12px] font-medium text-[var(--navy)]">{total.toLocaleString('fr-FR')} pts</div>
                            </button>
                        )
                    })
                )}
            </div>
        </aside>
    )
}
