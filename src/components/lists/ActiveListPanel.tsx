import { AlertTriangle, BookOpenText, ChevronDown, ChevronRight, Download, Minus, Plus, Printer, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import type { ArmyBattlefleet, ArmyUnit, BattlefleetDefinition, BattlefleetIssue, Unit } from '../../types/index'
import { getBattlefleetDefinitionsForFaction, getBattlefleetForceType, isMercenaryInForce, sortBattlefleetEntries, validateBattlefleetOrganisation } from '../../utils/battlefleets'
import { getListGlossary, getListGlossaryCount } from '../../utils/listGlossary'
import { downloadList } from '../../utils/localStorage'
import { previewPrintableList } from '../../utils/printList'
import { computeArmyUnitGuardianPool, computeArmyUnitGuardianSurge, computeEntriesGuardianPool, computeEntriesGuardianSurge, isCrownFaction } from '../../utils/guardianPool'
import { computeArmyUnitVpr, computeEntriesVpr } from '../../utils/pointsCalc'

interface UnitRowProps {
    entry: ArmyUnit
    unit?: Unit
    active: boolean
    nested?: boolean
    battlefleets: ArmyBattlefleet[]
    issues: BattlefleetIssue[]
    showGuardianPool: boolean
    guardianPool: number
    guardianSurge: number
    vpr: number
    onSelect: () => void
    onRemove: () => void
    onBattlefleetChange?: (battlefleetInstanceId: string | null) => void
}

interface BattlefleetSectionProps {
    battlefleet: ArmyBattlefleet
    definition?: BattlefleetDefinition
    forceFactionId: string
    entries: ArmyUnit[]
    issues: BattlefleetIssue[]
    unitById: Map<string, Unit>
    battlefleets: ArmyBattlefleet[]
    selectedListInstanceId: string | null
    active: boolean
    collapsed: boolean
    showGuardianPool: boolean
    onToggleCollapsed: () => void
    onRemoveBattlefleet: () => void
    onSelectBattlefleet: () => void
    onAddUnit: () => void
    onSelectUnit: (instanceId: string) => void
    onRemoveUnit: (instanceId: string) => void
    onMoveUnit: (instanceId: string, battlefleetInstanceId: string | null) => void
    unitIssuesByInstanceId: Map<string, BattlefleetIssue[]>
}

interface UnitGroupProps {
    title: string
    subtitle: string
    entries: ArmyUnit[]
    issues: BattlefleetIssue[]
    unitById: Map<string, Unit>
    battlefleets: ArmyBattlefleet[]
    selectedListInstanceId: string | null
    showGuardianPool: boolean
    tone?: 'neutral' | 'warning'
    onSelectUnit: (instanceId: string) => void
    onRemoveUnit: (instanceId: string) => void
    onMoveUnit: (instanceId: string, battlefleetInstanceId: string | null) => void
    unitIssuesByInstanceId: Map<string, BattlefleetIssue[]>
}

function UnitRow({ entry, unit, active, nested = false, battlefleets, issues, showGuardianPool, guardianPool, guardianSurge, vpr, onSelect, onRemove, onBattlefleetChange }: UnitRowProps) {
    const rowClasses = nested
        ? active
            ? 'ml-4 w-[calc(100%-1rem)] border-amber-400 bg-amber-100 shadow-sm ring-1 ring-amber-300'
            : 'ml-4 w-[calc(100%-1rem)] border-amber-200 bg-amber-50 hover:bg-amber-100'
        : active
            ? 'border-[var(--navy)] bg-[var(--navy)] text-white shadow-sm ring-2 ring-[var(--gold)]/40'
            : 'border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50'
    const customName = entry.customName?.trim()
    const generated = Boolean(entry.generatedByOption)

    return (
        <div className={`w-full rounded-lg border p-2 text-left transition ${rowClasses}`}>
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <button
                        type="button"
                        onClick={onSelect}
                        className="block w-full text-left"
                    >
                        <span className="flex items-center gap-1.5">
                            {nested ? <span className={`text-[10px] font-medium uppercase tracking-[0.16em] ${active ? 'text-amber-900' : 'text-amber-700'}`}>{generated ? 'Tethered' : 'Attachment'}</span> : null}
                            <span className={`truncate text-sm font-medium ${active && !nested ? 'text-white' : 'text-neutral-900'}`}>{unit?.name ?? entry.unitId}</span>
                        </span>
                    {customName ? (
                            <span className={`block truncate text-[11px] font-semibold ${active && !nested ? 'text-white/85' : 'text-[var(--navy)]'}`}>{customName}</span>
                    ) : null}
                        <span className={`block text-[11px] ${active && !nested ? 'text-white/70' : 'text-neutral-500'}`}>
                        {unit?.role ?? 'Unit'} · {entry.models.length} {entry.models.length === 1 ? 'model' : 'models'}
                        </span>
                    {entry.config.fleetDoctrineSelection ? (
                            <span className={`mt-0.5 block text-[10px] font-medium ${active && !nested ? 'text-white/70' : 'text-[var(--navy)]'}`}>
                            {entry.config.fleetDoctrineSelection.doctrineName}
                            </span>
                    ) : null}
                    {issues.length > 0 ? (
                            <span className={`mt-1 flex items-center gap-1 text-[10px] font-medium ${active && !nested ? 'text-amber-100' : 'text-rose-700'}`}>
                            <AlertTriangle size={11} />
                            <span>{issues[0].message}</span>
                            </span>
                    ) : null}
                    </button>
                    {!nested && onBattlefleetChange ? (
                        <select
                            value={entry.battlefleetInstanceId ?? ''}
                            onChange={(event) => onBattlefleetChange(event.target.value || null)}
                            className={`mt-2 w-full rounded border px-2 py-1 text-[11px] font-medium outline-none ${active && !nested ? 'border-white/20 bg-white/10 text-white' : 'border-neutral-200 bg-white text-neutral-700'}`}
                        >
                            <option value="">No Battlefleet</option>
                            {battlefleets.map((battlefleet) => (
                                <option key={battlefleet.instanceId} value={battlefleet.instanceId}>
                                    {battlefleet.customName ? `${battlefleet.name} - ${battlefleet.customName}` : battlefleet.name}
                                </option>
                            ))}
                        </select>
                    ) : null}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                        <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${active && !nested ? 'bg-white/10 text-white' : 'bg-[var(--gold-light)] text-[var(--navy)]'}`}>{entry.totalPoints} pts</span>
                        <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${active && !nested ? 'bg-white/10 text-white' : 'bg-neutral-100 text-[var(--navy)]'}`}>{vpr} VPR</span>
                        {showGuardianPool ? (
                            <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${active && !nested ? 'bg-white/10 text-white' : 'bg-neutral-100 text-[var(--navy)]'}`}>
                                GP {guardianPool} - GS {guardianSurge}
                            </span>
                        ) : null}
                    </div>
                    {!generated ? (
                        <button
                            type="button"
                            title="Remove"
                            onClick={onRemove}
                            className={`rounded p-1 ${active && !nested ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-neutral-400 hover:bg-rose-50 hover:text-rose-600'}`}
                        >
                            <Minus size={13} />
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}

function renderUnitRows({
    entries,
    unitById,
    battlefleets,
    selectedListInstanceId,
    onSelectUnit,
    onRemoveUnit,
    onMoveUnit,
    unitIssuesByInstanceId,
    showGuardianPool,
    allUnits,
}: {
    entries: ArmyUnit[]
    unitById: Map<string, Unit>
    battlefleets: ArmyBattlefleet[]
    selectedListInstanceId: string | null
    onSelectUnit: (instanceId: string) => void
    onRemoveUnit: (instanceId: string) => void
    onMoveUnit: (instanceId: string, battlefleetInstanceId: string | null) => void
    unitIssuesByInstanceId: Map<string, BattlefleetIssue[]>
    showGuardianPool: boolean
    allUnits: Unit[]
}) {
    return entries.map((entry) => (
        <div key={entry.instanceId} className="space-y-1">
            <UnitRow
                entry={entry}
                unit={unitById.get(entry.unitId)}
                active={selectedListInstanceId === entry.instanceId}
                battlefleets={battlefleets}
                issues={unitIssuesByInstanceId.get(entry.instanceId) ?? []}
                showGuardianPool={showGuardianPool}
                guardianPool={showGuardianPool ? computeArmyUnitGuardianPool(entry, allUnits) : 0}
                guardianSurge={showGuardianPool ? computeArmyUnitGuardianSurge(entry, allUnits) : 0}
                vpr={computeArmyUnitVpr(entry, allUnits)}
                onSelect={() => onSelectUnit(entry.instanceId)}
                onRemove={() => onRemoveUnit(entry.instanceId)}
                onBattlefleetChange={(battlefleetInstanceId) => onMoveUnit(entry.instanceId, battlefleetInstanceId)}
            />
            {(entry.attachedUnits ?? []).map((attachment) => (
                <UnitRow
                    key={attachment.instanceId}
                    entry={attachment}
                    unit={unitById.get(attachment.unitId)}
                    active={selectedListInstanceId === attachment.instanceId}
                    nested
                    battlefleets={battlefleets}
                    issues={unitIssuesByInstanceId.get(attachment.instanceId) ?? []}
                    showGuardianPool={showGuardianPool}
                    guardianPool={showGuardianPool ? computeArmyUnitGuardianPool(attachment, allUnits) : 0}
                    guardianSurge={showGuardianPool ? computeArmyUnitGuardianSurge(attachment, allUnits) : 0}
                    vpr={computeArmyUnitVpr(attachment, allUnits)}
                    onSelect={() => onSelectUnit(attachment.instanceId)}
                    onRemove={() => onRemoveUnit(attachment.instanceId)}
                />
            ))}
        </div>
    ))
}

function BattlefleetSection({
    battlefleet,
    definition,
    forceFactionId,
    entries,
    issues,
    unitById,
    battlefleets,
    selectedListInstanceId,
    active,
    collapsed,
    showGuardianPool,
    onToggleCollapsed,
    onRemoveBattlefleet,
    onSelectBattlefleet,
    onAddUnit,
    onSelectUnit,
    onRemoveUnit,
    onMoveUnit,
    unitIssuesByInstanceId,
}: BattlefleetSectionProps) {
    const points = entries.reduce((sum, entry) => sum + entry.totalPoints, 0)
    const vpr = computeEntriesVpr(entries, Array.from(unitById.values()))
    const guardianPool = showGuardianPool ? computeEntriesGuardianPool(entries, Array.from(unitById.values())) : 0
    const guardianSurge = showGuardianPool ? computeEntriesGuardianSurge(entries, Array.from(unitById.values())) : 0
    const hasIssues = issues.length > 0
    const forceType = definition ? getBattlefleetForceType(definition, forceFactionId) : null
    const mercenary = definition ? isMercenaryInForce(definition, forceFactionId) : false
    const customName = battlefleet.customName?.trim()
    const typeName = definition?.name ?? battlefleet.name

    return (
        <section className={`rounded-lg border bg-white shadow-sm ${active ? 'border-[var(--navy)] ring-2 ring-[var(--gold)]/40' : hasIssues ? 'border-rose-200' : 'border-neutral-200'}`}>
            <div className={`border-b px-2.5 py-2 ${hasIssues ? 'border-rose-100 bg-rose-50/70' : 'border-neutral-200 bg-neutral-50'}`}>
                <div className="flex items-start justify-between gap-2">
                    <button
                        type="button"
                        title={collapsed ? 'Expand Battlefleet' : 'Collapse Battlefleet'}
                        onClick={onToggleCollapsed}
                        className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-md border transition ${active ? 'border-[var(--gold)]/50 bg-[var(--gold-light)] text-[var(--navy)]' : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300 hover:text-[var(--navy)]'}`}
                    >
                        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                        type="button"
                        onClick={onSelectBattlefleet}
                        className="min-w-0 flex-1 text-left"
                    >
                        <div className="truncate text-[13px] font-semibold text-neutral-900">{typeName}</div>
                        {customName ? <div className="truncate text-[11px] font-semibold text-[var(--navy)]">{customName}</div> : null}
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                            <span>{forceType ?? 'Unknown'}</span>
                            {mercenary ? <span>Mercenary</span> : null}
                            {definition?.legendary ? <span>Legendary</span> : null}
                            <span>{entries.length} {entries.length === 1 ? 'unit' : 'units'}</span>
                        </div>
                    </button>
                    <div className="flex flex-none items-start gap-1">
                        <div className="flex flex-wrap justify-end gap-1">
                            <div className="rounded-md border border-[var(--gold)]/60 bg-[var(--gold-light)] px-2 py-1 text-right text-[12px] font-bold leading-none text-[var(--navy)] shadow-sm">
                                {points.toLocaleString('fr-FR')} pts
                            </div>
                            <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-right text-[12px] font-bold leading-none text-[var(--navy)] shadow-sm">
                                {vpr.toLocaleString('fr-FR')} VPR
                            </div>
                            {showGuardianPool ? (
                                <div className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-right text-[12px] font-bold leading-none text-[var(--navy)] shadow-sm">
                                    GP {guardianPool.toLocaleString('fr-FR')} - GS {guardianSurge.toLocaleString('fr-FR')}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            title="Remove Battlefleet"
                            onClick={onRemoveBattlefleet}
                            className="rounded p-1 text-neutral-400 hover:bg-rose-100 hover:text-rose-600"
                        >
                            <X size={13} />
                        </button>
                    </div>
                </div>
                {issues.length > 0 && !collapsed ? (
                    <div className="mt-2 space-y-1 text-[11px] text-rose-800">
                        {issues.slice(0, 3).map((issue, index) => (
                            <div key={`${battlefleet.instanceId}-${issue.message}-${index}`} className="flex gap-1.5">
                                <AlertTriangle className="mt-0.5 flex-none" size={12} />
                                <span>{issue.message}</span>
                            </div>
                        ))}
                        {issues.length > 3 ? <div className="pl-5 text-rose-700">+{issues.length - 3} more issues</div> : null}
                    </div>
                ) : null}
                {issues.length > 0 && collapsed ? (
                    <div className="mt-2 inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                        {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                    </div>
                ) : null}
                {!collapsed ? (
                    <button
                        type="button"
                        onClick={onAddUnit}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--navy)]/35 bg-white px-3 py-2.5 text-[12px] font-semibold text-[var(--navy)] shadow-sm transition hover:border-[var(--navy)] hover:bg-[var(--detail-panel)]"
                    >
                        <Plus size={16} />
                        Add unit to this Battlefleet
                    </button>
                ) : null}
            </div>

            {!collapsed ? (
                <div className="space-y-1.5 p-2">
                    {entries.length > 0 ? (
                        renderUnitRows({
                            entries,
                            unitById,
                            battlefleets,
                            selectedListInstanceId,
                            onSelectUnit,
                            onRemoveUnit,
                            onMoveUnit,
                            unitIssuesByInstanceId,
                            showGuardianPool,
                            allUnits: Array.from(unitById.values()),
                        })
                    ) : (
                        <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-2 text-[12px] text-neutral-500">
                            No units assigned.
                        </div>
                    )}
                </div>
            ) : null}
        </section>
    )
}

function UnitGroup({
    title,
    subtitle,
    entries,
    issues,
    unitById,
    battlefleets,
    selectedListInstanceId,
    showGuardianPool,
    tone = 'neutral',
    onSelectUnit,
    onRemoveUnit,
    onMoveUnit,
    unitIssuesByInstanceId,
}: UnitGroupProps) {
    const warning = tone === 'warning'

    return (
        <section className={`rounded-lg border shadow-sm ${warning ? 'border-amber-300 bg-amber-50' : 'border-neutral-200 bg-white'}`}>
            <div className={`border-b px-2.5 py-2 ${warning ? 'border-amber-200' : 'border-neutral-200 bg-neutral-50'}`}>
                <div className="text-[13px] font-semibold text-neutral-900">{title}</div>
                <div className="text-[11px] text-neutral-500">{subtitle}</div>
                {issues.length > 0 ? (
                    <div className="mt-2 space-y-1 text-[11px] text-amber-900">
                        {issues.slice(0, 3).map((issue, index) => (
                            <div key={`${title}-${issue.message}-${index}`} className="flex gap-1.5">
                                <AlertTriangle className="mt-0.5 flex-none" size={12} />
                                <span>{issue.message}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <div className="space-y-1.5 p-2">
                {renderUnitRows({
                    entries,
                    unitById,
                    battlefleets,
                    selectedListInstanceId,
                    onSelectUnit,
                    onRemoveUnit,
                    onMoveUnit,
                    unitIssuesByInstanceId,
                    showGuardianPool,
                    allUnits: Array.from(unitById.values()),
                })}
            </div>
        </section>
    )
}

interface ActiveListPanelProps {
    onOpenUnitPicker: (battlefleetInstanceId: string | null, label: string) => void
}

export default function ActiveListPanel({ onOpenUnitPicker }: ActiveListPanelProps) {
    const currentList = useAppStore((state) => state.currentList)
    const factions = useAppStore((state) => state.factions)
    const units = useAppStore((state) => state.units)
    const glossary = useAppStore((state) => state.glossary)
    const fleetDoctrines = useAppStore((state) => state.fleetDoctrines)
    const battlefleetDefinitions = useAppStore((state) => state.battlefleetDefinitions)
    const closeList = useAppStore((state) => state.closeList)
    const renameList = useAppStore((state) => state.renameList)
    const removeUnitFromList = useAppStore((state) => state.removeUnitFromList)
    const addBattlefleetToCurrentList = useAppStore((state) => state.addBattlefleetToCurrentList)
    const removeBattlefleetFromCurrentList = useAppStore((state) => state.removeBattlefleetFromCurrentList)
    const setUnitBattlefleet = useAppStore((state) => state.setUnitBattlefleet)
    const selectListUnit = useAppStore((state) => state.selectListUnit)
    const selectBattlefleet = useAppStore((state) => state.selectBattlefleet)
    const selectListGlossary = useAppStore((state) => state.selectListGlossary)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedBattlefleetInstanceId = useAppStore((state) => state.selectedBattlefleetInstanceId)
    const selectedListGlossary = useAppStore((state) => state.selectedListGlossary)
    const [editingName, setEditingName] = useState(false)
    const [draftName, setDraftName] = useState('')
    const [collapsedBattlefleetIds, setCollapsedBattlefleetIds] = useState<string[]>([])

    const factionName = useMemo(() => {
        if (!currentList) return ''
        return factions.find((faction) => faction.id === currentList.faction_id)?.name ?? currentList.faction_id
    }, [currentList, factions])
    const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])
    const definitionById = useMemo(() => new Map(battlefleetDefinitions.map((definition) => [definition.id, definition])), [battlefleetDefinitions])
    const availableBattlefleetDefinitions = useMemo(
        () => {
            const definitions = getBattlefleetDefinitionsForFaction(battlefleetDefinitions, currentList?.faction_id)
            const hasMercenary = (currentList?.battlefleets ?? []).some((battlefleet) => {
                const definition = battlefleetDefinitions.find((item) => item.id === battlefleet.definitionId)
                return definition ? isMercenaryInForce(definition, currentList?.faction_id) : false
            })
            return definitions.filter((definition) => (
                !hasMercenary || !isMercenaryInForce(definition, currentList?.faction_id)
            ))
        },
        [battlefleetDefinitions, currentList?.battlefleets, currentList?.faction_id],
    )
    const battlefleetIssues = useMemo(
        () => validateBattlefleetOrganisation(currentList, units, battlefleetDefinitions),
        [battlefleetDefinitions, currentList, units],
    )
    const unitIssuesByInstanceId = useMemo(() => {
        const grouped = new Map<string, BattlefleetIssue[]>()
        for (const issue of battlefleetIssues) {
            if (!issue.unitInstanceId) continue
            grouped.set(issue.unitInstanceId, [...(grouped.get(issue.unitInstanceId) ?? []), issue])
        }
        return grouped
    }, [battlefleetIssues])
    const battlefleetIssuesByInstanceId = useMemo(() => {
        const grouped = new Map<string, BattlefleetIssue[]>()
        for (const issue of battlefleetIssues) {
            if (!issue.battlefleetInstanceId) continue
            grouped.set(issue.battlefleetInstanceId, [...(grouped.get(issue.battlefleetInstanceId) ?? []), issue])
        }
        return grouped
    }, [battlefleetIssues])
    const forceIssues = useMemo(
        () => battlefleetIssues.filter((issue) => !issue.battlefleetInstanceId && !issue.unitInstanceId),
        [battlefleetIssues],
    )
    const regularBattlefleetDefinitions = useMemo(
        () => availableBattlefleetDefinitions.filter((definition) => !isMercenaryInForce(definition, currentList?.faction_id)),
        [availableBattlefleetDefinitions, currentList?.faction_id],
    )
    const mainBattlefleetDefinitions = useMemo(
        () => regularBattlefleetDefinitions.filter((definition) => definition.type === 'main'),
        [regularBattlefleetDefinitions],
    )
    const specialistBattlefleetDefinitions = useMemo(
        () => regularBattlefleetDefinitions.filter((definition) => definition.type === 'specialist'),
        [regularBattlefleetDefinitions],
    )
    const mercenaryBattlefleetDefinitions = useMemo(
        () => availableBattlefleetDefinitions.filter((definition) => isMercenaryInForce(definition, currentList?.faction_id)),
        [availableBattlefleetDefinitions, currentList?.faction_id],
    )
    const listGlossary = useMemo(
        () => getListGlossary(currentList?.units ?? [], units, glossary, currentList, battlefleetDefinitions),
        [battlefleetDefinitions, currentList, glossary, units],
    )
    const listGlossaryCount = useMemo(() => getListGlossaryCount(listGlossary), [listGlossary])

    if (!currentList) return null

    const totalPoints = currentList.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
    const totalVpr = computeEntriesVpr(currentList.units, units)
    const showGuardianPool = isCrownFaction(currentList.faction_id)
    const guardianPool = showGuardianPool ? computeEntriesGuardianPool(currentList.units, units) : 0
    const guardianSurge = showGuardianPool ? computeEntriesGuardianSurge(currentList.units, units) : 0
    const battlefleets = currentList.battlefleets ?? []
    const entriesByBattlefleetId = new Map<string, ArmyUnit[]>()
    for (const battlefleet of battlefleets) {
        entriesByBattlefleetId.set(battlefleet.instanceId, [])
    }
    const unassignedEntries: ArmyUnit[] = []
    for (const entry of currentList.units) {
        if (entry.battlefleetInstanceId && entriesByBattlefleetId.has(entry.battlefleetInstanceId)) {
            entriesByBattlefleetId.get(entry.battlefleetInstanceId)?.push(entry)
        } else {
            unassignedEntries.push(entry)
        }
    }
    for (const [battlefleetInstanceId, entries] of entriesByBattlefleetId) {
        entriesByBattlefleetId.set(battlefleetInstanceId, sortBattlefleetEntries(entries, units))
    }
    const commitName = () => {
        renameList(currentList.id, draftName)
        setEditingName(false)
    }
    const toggleBattlefleetCollapsed = (battlefleetInstanceId: string) => {
        setCollapsedBattlefleetIds((ids) => (
            ids.includes(battlefleetInstanceId)
                ? ids.filter((id) => id !== battlefleetInstanceId)
                : [...ids, battlefleetInstanceId]
        ))
    }

    return (
        <div className="border-b border-neutral-200 bg-neutral-100 p-3">
            <div className="rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    {editingName ? (
                        <input
                            value={draftName}
                            autoFocus
                            onChange={(event) => setDraftName(event.target.value)}
                            onBlur={commitName}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') commitName()
                                if (event.key === 'Escape') setEditingName(false)
                            }}
                            className="w-full rounded border border-blue-200 px-2 py-1 text-sm font-semibold outline-none"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                setDraftName(currentList.name)
                                setEditingName(true)
                            }}
                            className="max-w-full truncate text-left text-sm font-semibold text-neutral-900 hover:underline"
                        >
                            {currentList.name}
                        </button>
                    )}
                    <div className="mt-1 text-[11px] text-neutral-500">{factionName}</div>
                    <div className="mt-2 inline-flex flex-wrap items-center gap-1">
                        <span className="rounded-md border border-[var(--gold)]/70 bg-[var(--gold-light)] px-2.5 py-1 text-[13px] font-bold text-[var(--navy)] shadow-sm">
                            Total: {totalPoints.toLocaleString('fr-FR')} pts
                        </span>
                        <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[13px] font-bold text-[var(--navy)] shadow-sm">
                            {totalVpr.toLocaleString('fr-FR')} VPR
                        </span>
                        {showGuardianPool ? (
                            <span className="rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-[13px] font-bold text-[var(--navy)] shadow-sm">
                                GP {guardianPool.toLocaleString('fr-FR')} - GS {guardianSurge.toLocaleString('fr-FR')}
                            </span>
                        ) : null}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        title="Download"
                        onClick={() => downloadList(currentList, units)}
                        className="rounded border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                    >
                        <Download size={14} />
                    </button>
                    <button
                        type="button"
                        title="Preview printable PDF"
                        onClick={() => previewPrintableList(currentList, units, glossary, battlefleetDefinitions, fleetDoctrines)}
                        className="rounded border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                    >
                        <Printer size={14} />
                    </button>
                    <button
                        type="button"
                        title="Close"
                        onClick={closeList}
                        className="rounded border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>
            </div>

            <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-2.5 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--navy)]">Battlefleets</div>
                        <div className="text-[11px] text-neutral-500">
                            {battlefleets.length} {battlefleets.length === 1 ? 'formation' : 'formations'} · {currentList.units.length} {currentList.units.length === 1 ? 'unit' : 'units'}
                        </div>
                    </div>
                    {availableBattlefleetDefinitions.length > 0 ? (
                        <div className="relative flex-none">
                            <Plus className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--navy)]" size={12} />
                            <select
                                aria-label="Add Battlefleet"
                                value=""
                                onChange={(event) => {
                                    if (event.target.value) addBattlefleetToCurrentList(event.target.value)
                                }}
                                className="h-7 w-28 appearance-none rounded-md border border-neutral-300 bg-white pl-7 pr-6 text-[11px] font-semibold text-neutral-800 shadow-sm outline-none transition hover:border-neutral-400 hover:bg-neutral-50 focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10"
                            >
                                <option value="">Add</option>
                                {mainBattlefleetDefinitions.length > 0 ? (
                                    <optgroup label="Main">
                                        {mainBattlefleetDefinitions.map((definition) => (
                                            <option key={definition.id} value={definition.id}>
                                                {definition.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                                {specialistBattlefleetDefinitions.length > 0 ? (
                                    <optgroup label="Specialist">
                                        {specialistBattlefleetDefinitions.map((definition) => (
                                            <option key={definition.id} value={definition.id}>
                                                {definition.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                                {mercenaryBattlefleetDefinitions.length > 0 ? (
                                    <optgroup label="Mercenary">
                                        {mercenaryBattlefleetDefinitions.map((definition) => (
                                            <option key={definition.id} value={definition.id}>
                                                {definition.name}
                                            </option>
                                        ))}
                                    </optgroup>
                                ) : null}
                            </select>
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-neutral-500">▾</span>
                        </div>
                    ) : null}
                </div>

                {forceIssues.length > 0 ? (
                    <div className="mt-2 space-y-1 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
                        {forceIssues.map((issue, index) => (
                            <div key={`${issue.message}-${index}`} className="flex gap-1.5">
                                <AlertTriangle className="mt-0.5 flex-none" size={12} />
                                <span>{issue.message}</span>
                            </div>
                        ))}
                    </div>
                ) : battlefleetIssues.length === 0 ? (
                    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-[11px] font-medium text-emerald-800">
                        Battlefleet organisation valid.
                    </div>
                ) : null}
            </div>

            <div className="mt-3 space-y-2">
                {battlefleets.length === 0 && currentList.units.length === 0 ? (
                    <>
                        <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                            No units added.
                        </div>
                        <button
                            type="button"
                            onClick={() => onOpenUnitPicker(null, 'Unassigned units')}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-700 shadow-sm transition hover:border-[var(--navy)] hover:bg-[var(--detail-panel)] hover:text-[var(--navy)]"
                        >
                            <Plus size={18} />
                            Add unit without Battlefleet
                        </button>
                    </>
                ) : (
                    <>
                        {battlefleets.map((battlefleet) => (
                            <BattlefleetSection
                                key={battlefleet.instanceId}
                                battlefleet={battlefleet}
                                definition={definitionById.get(battlefleet.definitionId)}
                                forceFactionId={currentList.faction_id}
                                entries={entriesByBattlefleetId.get(battlefleet.instanceId) ?? []}
                                issues={battlefleetIssuesByInstanceId.get(battlefleet.instanceId) ?? []}
                                unitById={unitById}
                                battlefleets={battlefleets}
                                selectedListInstanceId={selectedListInstanceId}
                                active={selectedBattlefleetInstanceId === battlefleet.instanceId}
                                collapsed={collapsedBattlefleetIds.includes(battlefleet.instanceId)}
                                showGuardianPool={showGuardianPool}
                                onToggleCollapsed={() => toggleBattlefleetCollapsed(battlefleet.instanceId)}
                                onRemoveBattlefleet={() => removeBattlefleetFromCurrentList(battlefleet.instanceId)}
                                onSelectBattlefleet={() => selectBattlefleet(battlefleet.instanceId)}
                                onAddUnit={() => onOpenUnitPicker(battlefleet.instanceId, definitionById.get(battlefleet.definitionId)?.name ?? battlefleet.name)}
                                onSelectUnit={selectListUnit}
                                onRemoveUnit={removeUnitFromList}
                                onMoveUnit={setUnitBattlefleet}
                                unitIssuesByInstanceId={unitIssuesByInstanceId}
                            />
                        ))}
                        {unassignedEntries.length > 0 ? (
                            <UnitGroup
                                title="Unassigned"
                                subtitle={`${unassignedEntries.length} ${unassignedEntries.length === 1 ? 'unit needs' : 'units need'} a Battlefleet`}
                                entries={unassignedEntries}
                                issues={battlefleetIssues.filter((issue) => issue.unitInstanceId && !issue.battlefleetInstanceId)}
                                unitById={unitById}
                                battlefleets={battlefleets}
                                selectedListInstanceId={selectedListInstanceId}
                                showGuardianPool={showGuardianPool}
                                tone="warning"
                                onSelectUnit={selectListUnit}
                                onRemoveUnit={removeUnitFromList}
                                onMoveUnit={setUnitBattlefleet}
                                unitIssuesByInstanceId={unitIssuesByInstanceId}
                            />
                        ) : null}
                        <button
                            type="button"
                            onClick={() => onOpenUnitPicker(null, 'Unassigned units')}
                            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-3 py-3 text-[12px] font-semibold text-neutral-700 shadow-sm transition hover:border-[var(--navy)] hover:bg-[var(--detail-panel)] hover:text-[var(--navy)]"
                        >
                            <Plus size={18} />
                            Add unit without Battlefleet
                        </button>
                    </>
                )}
            </div>

            <button
                type="button"
                onClick={selectListGlossary}
                className={`mt-3 flex w-full items-center justify-between gap-3 rounded-lg border p-2.5 text-left shadow-sm transition ${selectedListGlossary ? 'border-[var(--navy)] bg-[var(--navy)] text-white ring-2 ring-[var(--gold)]/40' : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50'}`}
            >
                <span className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-md ${selectedListGlossary ? 'bg-white/12 text-white' : 'bg-[var(--detail-panel)] text-[var(--navy)]'}`}>
                        <BookOpenText size={15} />
                    </span>
                    <span className="min-w-0">
                        <span className={`block text-[13px] font-semibold ${selectedListGlossary ? 'text-white' : 'text-neutral-900'}`}>Glossary</span>
                        <span className={`block text-[11px] ${selectedListGlossary ? 'text-white/70' : 'text-neutral-500'}`}>
                            {listGlossaryCount} {listGlossaryCount === 1 ? 'rule' : 'rules'} used by this list
                        </span>
                    </span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${selectedListGlossary ? 'bg-white/12 text-white' : 'bg-neutral-100 text-[var(--navy)]'}`}>
                    View
                </span>
            </button>
        </div>
    )
}
