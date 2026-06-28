import { Search } from 'lucide-react'
import { useMemo } from 'react'
import { useAppStore } from '../../store'

interface Props {
    compact?: boolean
    sortMode: 'name' | 'points-asc' | 'points-desc'
    onSortModeChange: (mode: 'name' | 'points-asc' | 'points-desc') => void
    visibleCount: number
}

export default function FactionAndSearchHeader({ compact = false, sortMode, onSortModeChange, visibleCount }: Props) {
    const factions = useAppStore((state) => state.factions)
    const units = useAppStore((state) => state.units)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const setSearchQuery = useAppStore((state) => state.setSearchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const toggleRoleFilter = useAppStore((state) => state.toggleRoleFilter)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const currentList = useAppStore((state) => state.currentList)

    const availableFactions = currentList
        ? factions.filter((faction) => faction.id === currentList.faction_id)
        : factions
    const factionId = currentList?.faction_id ?? selectedFactionId
    const roles = useMemo(() => {
        if (!factionId) return []
        return Array.from(new Set(units.filter((unit) => unit.faction_id === factionId).map((unit) => unit.role))).sort()
    }, [factionId, units])

    return (
        <div className={`border-b border-neutral-200 ${compact ? 'space-y-2 p-3' : 'space-y-3 p-4'}`}>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Units</div>
                    <div className="text-[11px] text-neutral-500">{visibleCount} visible</div>
                </div>
                <select
                    value={sortMode}
                    onChange={(event) => onSortModeChange(event.target.value as 'name' | 'points-asc' | 'points-desc')}
                    className="rounded border border-neutral-200 bg-white px-2 py-1.5 text-[11px] text-neutral-600 outline-none"
                >
                    <option value="name">Name A-Z</option>
                    <option value="points-asc">Points ↑</option>
                    <option value="points-desc">Points ↓</option>
                </select>
            </div>

            <select
                value={factionId ?? ''}
                disabled={Boolean(currentList)}
                onChange={(event) => {
                    setSelectedFactionId(event.target.value || null)
                    setSelectedUnitId(null)
                }}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
            >
                <option value="">Select a faction</option>
                {availableFactions.map((faction) => (
                    <option key={faction.id} value={faction.id}>{faction.name}</option>
                ))}
            </select>

            <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm">
                <Search size={14} className="text-neutral-400" />
                <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search"
                    className="w-full bg-transparent outline-none"
                />
            </label>

            {roles.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {roles.map((role) => {
                        const active = selectedRoles.includes(role)
                        return (
                            <button
                                key={role}
                                type="button"
                                onClick={() => toggleRoleFilter(role)}
                                className={`rounded-full border px-2 py-0.5 text-[10px] transition ${active ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-neutral-300 bg-white text-neutral-600 hover:border-[var(--navy-light)]'}`}
                            >
                                {role}
                            </button>
                        )
                    })}
                </div>
            ) : null}
        </div>
    )
}
