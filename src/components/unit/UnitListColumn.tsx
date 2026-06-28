import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getFilteredUnits } from '../../store/selectors'
import type { Unit } from '../../types/index'
import ActiveListPanel from '../lists/ActiveListPanel'
import FactionAndSearchHeader from './FactionAndSearchHeader'
import UnitCard from './UnitCard'

function UnitCardList() {
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const setSelectedListInstanceId = useAppStore((state) => state.setSelectedListInstanceId)
    const units = useAppStore((state) => state.units)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const factions = useAppStore((state) => state.factions)
    const currentList = useAppStore((state) => state.currentList)
    const addUnitToCurrentList = useAppStore((state) => state.addUnitToCurrentList)
    const [sortMode, setSortMode] = useState<'name' | 'points-asc' | 'points-desc'>('name')

    const factionId = currentList?.faction_id ?? selectedFactionId
    const filteredUnits = useMemo(() => {
        const filtered = getFilteredUnits({ units, selectedFactionId: factionId, searchQuery, selectedRoles })
        return [...filtered].sort((a, b) => {
            if (sortMode === 'points-asc') return a.point_cost_per_model - b.point_cost_per_model
            if (sortMode === 'points-desc') return b.point_cost_per_model - a.point_cost_per_model
            return a.name.localeCompare(b.name)
        })
    }, [factionId, searchQuery, selectedRoles, sortMode, units])

    const faction = factions.find((item) => item.id === factionId)

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <FactionAndSearchHeader
                compact={Boolean(currentList)}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
                visibleCount={filteredUnits.length}
            />
            <div className="flex-1 overflow-y-auto p-3">
                {!factionId ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                        Select a faction to see units.
                    </div>
                ) : filteredUnits.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-500">
                        No units match the current filters.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredUnits.map((unit: Unit) => (
                            <UnitCard
                                key={unit.id}
                                unit={unit}
                                faction={faction}
                                active={selectedUnitId === unit.id}
                                onSelect={() => {
                                    setSelectedListInstanceId(null)
                                    setSelectedUnitId(unit.id)
                                }}
                                onAdd={currentList ? () => addUnitToCurrentList(unit.id) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function UnitListColumn() {
    const currentList = useAppStore((state) => state.currentList)

    if (!currentList) {
        return (
            <aside className="flex h-full flex-col overflow-hidden bg-white">
                <UnitCardList />
            </aside>
        )
    }

    return (
        <aside className="flex h-full flex-col overflow-hidden bg-white">
            <div className="max-h-[45%] flex-none overflow-y-auto border-b border-neutral-200">
                <ActiveListPanel />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <UnitCardList />
            </div>
        </aside>
    )
}
