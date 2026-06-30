import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import type { Unit } from '../../types/index'
import { isMercenaryInForce } from '../../utils/battlefleets'
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
    const battlefleetDefinitions = useAppStore((state) => state.battlefleetDefinitions)
    const currentList = useAppStore((state) => state.currentList)
    const addUnitToCurrentList = useAppStore((state) => state.addUnitToCurrentList)
    const addAttachmentToListUnit = useAppStore((state) => state.addAttachmentToListUnit)
    const [sortMode, setSortMode] = useState<'name' | 'points-asc' | 'points-desc'>('name')
    const [sourceMode, setSourceMode] = useState<'force' | 'mercenary' | 'both'>('both')
    const [selectedDomains, setSelectedDomains] = useState<string[]>([])
    const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])

    useEffect(() => {
        setSelectedKeywords([])
    }, [currentList?.id])

    const factionId = currentList?.faction_id ?? selectedFactionId
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
        setSelectedKeywords((selected) => (
            selected.includes(tag) ? selected.filter((item) => item !== tag) : [...selected, tag]
        ))
    }
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
    const [unitsPickerCollapsed, setUnitsPickerCollapsed] = useState(false)

    if (!currentList) {
        return (
            <aside className="flex h-full flex-col overflow-hidden bg-white">
                <UnitCardList />
            </aside>
        )
    }

    return (
        <aside className="flex h-full flex-col overflow-hidden bg-white">
            <div className={`${unitsPickerCollapsed ? 'max-h-[calc(100%-2rem)]' : 'max-h-[60%]'} min-h-0 flex-none overflow-y-auto border-b border-neutral-200`}>
                <ActiveListPanel />
            </div>
            <button
                type="button"
                onClick={() => setUnitsPickerCollapsed((collapsed) => !collapsed)}
                className="flex h-8 flex-none items-center justify-center gap-1 border-b border-neutral-200 bg-neutral-50 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navy)] transition hover:bg-[var(--detail-panel)]"
            >
                {unitsPickerCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                {unitsPickerCollapsed ? 'Show units' : 'Hide units'}
            </button>
            {!unitsPickerCollapsed ? (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <UnitCardList />
                </div>
            ) : null}
        </aside>
    )
}
