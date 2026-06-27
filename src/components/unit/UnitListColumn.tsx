import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getFilteredUnits } from '../../store/selectors'
import type { Unit } from '../../types/index'
import UnitCard from './UnitCard'

export default function UnitListColumn() {
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const units = useAppStore((state) => state.units)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const factions = useAppStore((state) => state.factions)
    const [sortMode, setSortMode] = useState<'name' | 'points-asc' | 'points-desc'>('name')

    const filteredUnits = useMemo(() => {
        const filtered = getFilteredUnits({ units, selectedFactionId, searchQuery, selectedRoles })
        return [...filtered].sort((a, b) => {
            if (sortMode === 'points-asc') return a.point_cost_per_model - b.point_cost_per_model
            if (sortMode === 'points-desc') return b.point_cost_per_model - a.point_cost_per_model
            return a.name.localeCompare(b.name)
        })
    }, [selectedFactionId, searchQuery, selectedRoles, sortMode, units])

    const faction = factions.find((item) => item.id === selectedFactionId)

    return (
        <aside className="flex h-full flex-col border-r border-neutral-200 bg-white">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Unités</div>
                    <div className="text-[11px] text-neutral-500">{filteredUnits.length} visible{filteredUnits.length > 1 ? 's' : ''}</div>
                </div>
                <select
                    value={sortMode}
                    onChange={(event) => setSortMode(event.target.value as 'name' | 'points-asc' | 'points-desc')}
                    className="rounded border border-neutral-200 bg-white px-2.5 py-1.5 text-[11px] text-neutral-600 outline-none"
                >
                    <option value="name">Nom A→Z</option>
                    <option value="points-asc">Points ↑</option>
                    <option value="points-desc">Points ↓</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {!selectedFactionId ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                        Sélectionnez une faction pour voir les unités.
                    </div>
                ) : filteredUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                        Aucune unité ne correspond aux filtres actuels.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredUnits.map((unit: Unit) => (
                            <UnitCard
                                key={unit.id}
                                unit={unit}
                                faction={faction}
                                active={selectedUnitId === unit.id}
                                onSelect={() => setSelectedUnitId(unit.id)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </aside>
    )
}
