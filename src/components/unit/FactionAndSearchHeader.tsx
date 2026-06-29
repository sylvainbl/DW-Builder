import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import type { Unit } from '../../types/index'

interface Props {
    compact?: boolean
    sortMode: 'name' | 'points-asc' | 'points-desc'
    onSortModeChange: (mode: 'name' | 'points-asc' | 'points-desc') => void
    visibleCount: number
    filterUnits: Unit[]
    sourceMode: 'force' | 'mercenary' | 'both'
    sourceOptions: { value: 'force' | 'mercenary' | 'both'; label: string }[]
    onSourceModeChange: (mode: 'force' | 'mercenary' | 'both') => void
    selectedDomains: string[]
    selectedKeywords: string[]
    onToggleDomain: (tag: string) => void
    onToggleKeyword: (tag: string) => void
}

const domainTags = ['Surface', 'Airborne', 'Underwater']

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${active ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-neutral-300 bg-white text-neutral-600 hover:border-[var(--navy-light)]'}`}
        >
            {label}
        </button>
    )
}

export default function FactionAndSearchHeader({
    compact = false,
    sortMode,
    onSortModeChange,
    visibleCount,
    filterUnits,
    sourceMode,
    sourceOptions,
    onSourceModeChange,
    selectedDomains,
    selectedKeywords,
    onToggleDomain,
    onToggleKeyword,
}: Props) {
    const factions = useAppStore((state) => state.factions)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const setSearchQuery = useAppStore((state) => state.setSearchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const toggleRoleFilter = useAppStore((state) => state.toggleRoleFilter)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const currentList = useAppStore((state) => state.currentList)
    const [showDomains, setShowDomains] = useState(true)
    const [showKeywords, setShowKeywords] = useState(false)

    const availableFactions = currentList
        ? factions.filter((faction) => faction.id === currentList.faction_id)
        : factions
    const factionId = currentList?.faction_id ?? selectedFactionId
    const roles = useMemo(() => {
        if (!factionId) return []
        return Array.from(new Set(filterUnits.map((unit) => unit.role))).sort()
    }, [factionId, filterUnits])
    const availableDomains = useMemo(
        () => domainTags.filter((tag) => filterUnits.some((unit) => unit.tags.includes(tag))),
        [filterUnits],
    )
    const keywords = useMemo(() => {
        const excluded = new Set([...domainTags, ...roles])
        return Array.from(new Set(
            filterUnits.flatMap((unit) => unit.tags.filter((tag) => !excluded.has(tag))),
        )).sort()
    }, [filterUnits, roles])

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

            {currentList ? (
                <select
                    value={sourceMode}
                    disabled={sourceOptions.length <= 1}
                    onChange={(event) => onSourceModeChange(event.target.value as 'force' | 'mercenary' | 'both')}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none disabled:bg-neutral-100 disabled:text-neutral-500"
                >
                    {sourceOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            ) : (
                <select
                    value={factionId ?? ''}
                    onChange={(event) => {
                        setSelectedFactionId(event.target.value || null)
                        setSelectedUnitId(null)
                    }}
                    className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 outline-none"
                >
                    <option value="">Select a faction</option>
                    {availableFactions.map((faction) => (
                        <option key={faction.id} value={faction.id}>{faction.name}</option>
                    ))}
                </select>
            )}

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
                            <FilterChip
                                key={role}
                                label={role}
                                active={active}
                                onClick={() => toggleRoleFilter(role)}
                            />
                        )
                    })}
                </div>
            ) : null}

            {availableDomains.length > 0 ? (
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => setShowDomains((value) => !value)}
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500"
                    >
                        {showDomains ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Domain
                    </button>
                    {showDomains ? (
                        <div className="flex flex-wrap gap-1.5">
                            {availableDomains.map((tag) => (
                                <FilterChip
                                    key={tag}
                                    label={tag}
                                    active={selectedDomains.includes(tag)}
                                    onClick={() => onToggleDomain(tag)}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}

            {keywords.length > 0 ? (
                <div className="space-y-1">
                    <button
                        type="button"
                        onClick={() => setShowKeywords((value) => !value)}
                        className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500"
                    >
                        {showKeywords ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        Keywords
                    </button>
                    {showKeywords ? (
                        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
                            {keywords.map((tag) => (
                                <FilterChip
                                    key={tag}
                                    label={tag}
                                    active={selectedKeywords.includes(tag)}
                                    onClick={() => onToggleKeyword(tag)}
                                />
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
