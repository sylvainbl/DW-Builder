import { useMemo } from 'react'
import { Search } from 'lucide-react'
import { useAppStore } from '../../store'
import { getFilteredUnits } from '../../store/selectors'
import type { Faction } from '../../types/index'

export default function FactionSidebar() {
    const factions = useAppStore((state) => state.factions)
    const units = useAppStore((state) => state.units)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const setSearchQuery = useAppStore((state) => state.setSearchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const toggleRoleFilter = useAppStore((state) => state.toggleRoleFilter)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)

    const factionUnits = useMemo(() => {
        if (!selectedFactionId) {
            return []
        }
        return units.filter((unit) => unit.faction_id === selectedFactionId)
    }, [selectedFactionId, units])

    const roles = useMemo(() => Array.from(new Set(factionUnits.map((unit) => unit.role))).sort(), [factionUnits])
    const filteredCount = useMemo(() => getFilteredUnits({ units, selectedFactionId, searchQuery, selectedRoles }).length, [units, selectedFactionId, searchQuery, selectedRoles])

    return (
        <aside className="flex h-full flex-col bg-[var(--panel)] p-4 text-[var(--text)]">
            <label className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm shadow-sm">
                <Search size={14} className="text-neutral-400" />
                <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Rechercher"
                    className="w-full bg-transparent outline-none"
                />
            </label>

            <div className="mt-5">
                <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Factions</div>
                <div className="space-y-2">
                    {factions.map((faction: Faction) => {
                        const active = faction.id === selectedFactionId
                        const count = units.filter((unit) => unit.faction_id === faction.id).length
                        return (
                            <button
                                key={faction.id}
                                type="button"
                                onClick={() => {
                                    setSelectedFactionId(faction.id)
                                    setSelectedUnitId(null)
                                }}
                                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition ${active ? 'bg-blue-50 text-blue-700' : 'text-neutral-700 hover:bg-white'}`}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: faction.color }} />
                                    <span className="truncate">{faction.name}</span>
                                </span>
                                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] text-neutral-500">{count}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {selectedFactionId ? (
                <div className="mt-6">
                    <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Rôles</div>
                    <div className="flex flex-wrap gap-2">
                        {roles.map((role) => {
                            const active = selectedRoles.includes(role)
                            return (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => toggleRoleFilter(role)}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] transition ${active ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-neutral-300 bg-white text-neutral-600 hover:border-[var(--navy-light)]'}`}
                                >
                                    {role}
                                </button>
                            )
                        })}
                    </div>
                    <p className="mt-3 px-2 text-[11px] text-neutral-500">{filteredCount} unité(s) visibles</p>
                </div>
            ) : null}
        </aside>
    )
}
