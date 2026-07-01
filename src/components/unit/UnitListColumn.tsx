import { AlertTriangle, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import type { Unit } from '../../types/index'
import { isMercenaryInForce, validateBattlefleetOrganisation } from '../../utils/battlefleets'
import { getRoleSortRank } from '../../utils/unitRoles'
import ActiveListPanel from '../lists/ActiveListPanel'
import FactionAndSearchHeader from './FactionAndSearchHeader'
import UnitCard from './UnitCard'

type SortMode = 'name' | 'points-asc' | 'points-desc' | 'type'

interface UnitCardListProps {
    addTargetBattlefleetInstanceId?: string | null
    addTargetLabel?: string
    onClose?: () => void
}

function UnitCardList({ addTargetBattlefleetInstanceId, addTargetLabel, onClose }: UnitCardListProps) {
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const setSelectedListInstanceId = useAppStore((state) => state.setSelectedListInstanceId)
    const units = useAppStore((state) => state.units)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const factions = useAppStore((state) => state.factions)
    const battlefleetDefinitions = useAppStore((state) => state.battlefleetDefinitions)
    const currentList = useAppStore((state) => state.currentList)
    const addUnitToCurrentList = useAppStore((state) => state.addUnitToCurrentList)
    const [sortMode, setSortMode] = useState<SortMode>('name')
    const [targetBattlefleetInstanceId, setTargetBattlefleetInstanceId] = useState<string | null>(addTargetBattlefleetInstanceId ?? null)
    const [sourceMode, setSourceMode] = useState<'force' | 'mercenary' | 'both'>('both')
    const [selectedDomains, setSelectedDomains] = useState<string[]>([])
    const [selectedKeywordState, setSelectedKeywordState] = useState<{ listId: string | null; values: string[] }>({ listId: null, values: [] })

    const factionId = currentList?.faction_id ?? selectedFactionId
    const definitionById = useMemo(
        () => new Map(battlefleetDefinitions.map((definition) => [definition.id, definition])),
        [battlefleetDefinitions],
    )
    const destinationOptions = useMemo(() => {
        const battlefleets = currentList?.battlefleets ?? []
        return [
            { value: '', label: 'Unassigned units' },
            ...battlefleets.map((battlefleet) => {
                const definition = definitionById.get(battlefleet.definitionId)
                const typeName = definition?.name ?? battlefleet.name
                return {
                    value: battlefleet.instanceId,
                    label: battlefleet.customName ? `${typeName} - ${battlefleet.customName}` : typeName,
                }
            }),
        ]
    }, [currentList?.battlefleets, definitionById])
    const selectedDestinationLabel = destinationOptions.find((option) => option.value === (targetBattlefleetInstanceId ?? ''))?.label ?? addTargetLabel ?? 'Unassigned units'
    const selectedBattlefleetIssues = useMemo(
        () => currentList && targetBattlefleetInstanceId
            ? validateBattlefleetOrganisation(currentList, units, battlefleetDefinitions)
                .filter((issue) => issue.battlefleetInstanceId === targetBattlefleetInstanceId)
            : [],
        [battlefleetDefinitions, currentList, targetBattlefleetInstanceId, units],
    )
    const selectedKeywords = useMemo(
        () => (selectedKeywordState.listId === (currentList?.id ?? null) ? selectedKeywordState.values : []),
        [currentList?.id, selectedKeywordState.listId, selectedKeywordState.values],
    )
    const mercenaryFactionIds = useMemo(() => {
        const ids = new Set<string>()
        for (const battlefleet of currentList?.battlefleets ?? []) {
            const definition = battlefleetDefinitions.find((item) => item.id === battlefleet.definitionId)
            if (definition && isMercenaryInForce(definition, currentList?.faction_id)) {
                ids.add(definition.faction_id)
            }
        }
        return ids
    }, [battlefleetDefinitions, currentList?.battlefleets, currentList?.faction_id])
    const effectiveSourceMode = mercenaryFactionIds.size === 0 ? 'force' : sourceMode
    const visibleFactionIds = useMemo(() => {
        const ids = new Set<string>()
        if (effectiveSourceMode !== 'mercenary' && factionId) ids.add(factionId)
        if (effectiveSourceMode !== 'force') {
            mercenaryFactionIds.forEach((id) => ids.add(id))
        }
        return ids
    }, [effectiveSourceMode, factionId, mercenaryFactionIds])
    const filterSourceUnits = useMemo(
        () => units.filter((unit) => visibleFactionIds.size === 0 || visibleFactionIds.has(unit.faction_id)),
        [units, visibleFactionIds],
    )
    const filteredUnits = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        const filtered = filterSourceUnits.filter((unit) => {
            if (selectedDomains.length > 0 && !selectedDomains.some((tag) => unit.tags.includes(tag))) return false
            if (selectedKeywords.length > 0 && !selectedKeywords.some((tag) => unit.tags.includes(tag))) return false

            const textMatch = [unit.name, unit.sub_name, ...unit.tags]
                .filter((part): part is string => typeof part === 'string')
                .some((part) => part.toLowerCase().includes(query))

            const roleMatch = selectedRoles.length === 0 || selectedRoles.includes(unit.role)

            return query.length === 0 ? roleMatch : textMatch && roleMatch
        })
        return [...filtered].sort((a, b) => {
            if (sortMode === 'points-asc') return (a.point_cost_per_model ?? 0) - (b.point_cost_per_model ?? 0)
            if (sortMode === 'points-desc') return (b.point_cost_per_model ?? 0) - (a.point_cost_per_model ?? 0)
            if (sortMode === 'type') {
                const roleRank = getRoleSortRank(a.role) - getRoleSortRank(b.role)
                if (roleRank !== 0) return roleRank
            }
            return a.name.localeCompare(b.name)
        })
    }, [filterSourceUnits, searchQuery, selectedDomains, selectedKeywords, selectedRoles, sortMode])

    const factionById = useMemo(() => new Map(factions.map((faction) => [faction.id, faction])), [factions])
    const sourceOptions = useMemo(() => {
        const forceFactionName = factionById.get(factionId ?? '')?.name ?? 'Current faction'
        const mercenaryNames = Array.from(mercenaryFactionIds)
            .map((id) => factionById.get(id)?.name ?? id)
            .join(', ')
        if (!currentList || mercenaryFactionIds.size === 0) {
            return [{ value: 'force' as const, label: forceFactionName }]
        }
        return [
            { value: 'both' as const, label: `${forceFactionName} + ${mercenaryNames}` },
            { value: 'force' as const, label: forceFactionName },
            { value: 'mercenary' as const, label: mercenaryNames },
        ]
    }, [currentList, factionById, factionId, mercenaryFactionIds])
    const toggleDomain = (tag: string) => {
        setSelectedDomains((selected) => (
            selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]
        ))
    }
    const toggleKeyword = (tag: string) => {
        const listId = currentList?.id ?? null
        setSelectedKeywordState((state) => {
            const selected = state.listId === listId ? state.values : []
            return {
                listId,
                values: selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag],
            }
        })
    }
    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {currentList && addTargetLabel ? (
                <div className="flex flex-none items-start justify-between gap-3 border-b border-neutral-200 bg-[var(--navy)] px-3 py-2.5 text-white">
                    <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">Add unit to</div>
                        <select
                            value={targetBattlefleetInstanceId ?? ''}
                            onChange={(event) => setTargetBattlefleetInstanceId(event.target.value || null)}
                            className="mt-1 max-w-full rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm font-semibold text-white outline-none transition hover:bg-white/15 focus:border-[var(--gold)]"
                            title={selectedDestinationLabel}
                        >
                            {destinationOptions.map((option) => (
                                <option key={option.value || 'unassigned'} value={option.value} className="text-neutral-900">
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    {onClose ? (
                        <button
                            type="button"
                            title="Close unit picker"
                            onClick={onClose}
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-md border border-white/20 bg-white/10 text-white/80 transition hover:bg-white/20 hover:text-white"
                        >
                            <X size={15} />
                        </button>
                    ) : null}
                </div>
            ) : null}
            {selectedBattlefleetIssues.length > 0 ? (
                <div className="flex-none space-y-1 border-b border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
                    {selectedBattlefleetIssues.slice(0, 4).map((issue, index) => (
                        <div key={`${issue.message}-${index}`} className="flex gap-1.5">
                            <AlertTriangle className="mt-0.5 flex-none" size={12} />
                            <span>{issue.message}</span>
                        </div>
                    ))}
                    {selectedBattlefleetIssues.length > 4 ? (
                        <div className="pl-5 text-rose-700">+{selectedBattlefleetIssues.length - 4} more issues</div>
                    ) : null}
                </div>
            ) : null}
            <FactionAndSearchHeader
                compact={Boolean(currentList)}
                sortMode={sortMode}
                onSortModeChange={setSortMode}
                visibleCount={filteredUnits.length}
                filterUnits={filterSourceUnits}
                sourceMode={effectiveSourceMode}
                sourceOptions={sourceOptions}
                onSourceModeChange={setSourceMode}
                selectedDomains={selectedDomains}
                selectedKeywords={selectedKeywords}
                onToggleDomain={toggleDomain}
                onToggleKeyword={toggleKeyword}
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
                                faction={factionById.get(unit.faction_id)}
                                active={selectedUnitId === unit.id}
                                onSelect={() => {
                                    setSelectedListInstanceId(null)
                                    setSelectedUnitId(unit.id)
                                }}
                                onAdd={currentList ? () => addUnitToCurrentList(unit.id, targetBattlefleetInstanceId) : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

function OpenListUnitColumn() {
    const [unitPickerTarget, setUnitPickerTarget] = useState<{ battlefleetInstanceId: string | null; label: string } | null>(null)

    return (
        <aside className="relative flex h-full flex-col overflow-hidden bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto">
                <ActiveListPanel
                    onOpenUnitPicker={(battlefleetInstanceId, label) => setUnitPickerTarget({ battlefleetInstanceId, label })}
                />
            </div>
            {unitPickerTarget ? (
                <div className="absolute inset-0 z-20 flex flex-col overflow-hidden bg-white shadow-[0_-18px_35px_rgba(15,23,42,0.18)]">
                    <UnitCardList
                        addTargetBattlefleetInstanceId={unitPickerTarget.battlefleetInstanceId}
                        addTargetLabel={unitPickerTarget.label}
                        onClose={() => setUnitPickerTarget(null)}
                    />
                </div>
            ) : null}
        </aside>
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

    return <OpenListUnitColumn key={currentList.id} />
}
