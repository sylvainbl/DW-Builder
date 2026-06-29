import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getFilteredUnits } from '../../store/selectors'
import type { Unit } from '../../types/index'
import ActiveListPanel from '../lists/ActiveListPanel'
import FactionAndSearchHeader from './FactionAndSearchHeader'
import UnitCard from './UnitCard'

function unitTraits(unit: Unit): string[] {
    return [unit.name, unit.sub_name, unit.role, ...unit.tags].map((trait) => trait.toLowerCase())
}

function canAttachToParent(attachment: Unit, parent: Unit): boolean {
    if (!attachment.attachment || attachment.faction_id !== parent.faction_id) return false
    if (attachment.id === parent.id) return false
    const parentTraits = unitTraits(parent)
    return attachment.attachment.parent_traits.every((requiredTrait) =>
        parentTraits.includes(requiredTrait.toLowerCase()),
    )
}

function attachmentModelLimit(unit: Unit): number {
    const fallback = unit.max ?? (typeof unit.models === 'number' ? unit.models : 1)
    return unit.attachment?.max_models ?? fallback
}

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
    const addAttachmentToListUnit = useAppStore((state) => state.addAttachmentToListUnit)
    const [sortMode, setSortMode] = useState<'name' | 'points-asc' | 'points-desc'>('name')

    const factionId = currentList?.faction_id ?? selectedFactionId
    const filteredUnits = useMemo(() => {
        const filtered = getFilteredUnits({ units, selectedFactionId: factionId, searchQuery, selectedRoles })
        return [...filtered].sort((a, b) => {
            if (sortMode === 'points-asc') return (a.point_cost_per_model ?? 0) - (b.point_cost_per_model ?? 0)
            if (sortMode === 'points-desc') return (b.point_cost_per_model ?? 0) - (a.point_cost_per_model ?? 0)
            return a.name.localeCompare(b.name)
        })
    }, [factionId, searchQuery, selectedRoles, sortMode, units])

    const faction = factions.find((item) => item.id === factionId)
    const attachmentTargetsByUnitId = useMemo(() => {
        if (!currentList) return new Map<string, { instanceId: string; label: string }[]>()
        return new Map(filteredUnits.map((unit) => {
            const targets = currentList.units.flatMap((entry) => {
                const parent = units.find((item) => item.id === entry.unitId)
                if (!parent || !canAttachToParent(unit, parent)) return []
                const usedModels = (entry.attachedUnits ?? [])
                    .filter((attachment) => attachment.unitId === unit.id)
                    .reduce((sum, attachment) => sum + attachment.models.length, 0)
                const minimum = unit.min ?? (typeof unit.models === 'number' ? unit.models : 1)
                if (usedModels + minimum > attachmentModelLimit(unit)) return []
                return [{ instanceId: entry.instanceId, label: parent.name }]
            })
            return [unit.id, targets]
        }))
    }, [currentList, filteredUnits, units])

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
                                attachmentTargets={attachmentTargetsByUnitId.get(unit.id)}
                                onAttach={currentList ? (parentInstanceId) => addAttachmentToListUnit(parentInstanceId, unit.id) : undefined}
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
            <div className="max-h-[62%] flex-none overflow-y-auto border-b border-neutral-200">
                <ActiveListPanel />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <UnitCardList />
            </div>
        </aside>
    )
}
