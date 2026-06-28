import { Download, Minus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { downloadList } from '../../utils/localStorage'

export default function ActiveListPanel() {
    const currentList = useAppStore((state) => state.currentList)
    const factions = useAppStore((state) => state.factions)
    const units = useAppStore((state) => state.units)
    const closeList = useAppStore((state) => state.closeList)
    const renameList = useAppStore((state) => state.renameList)
    const removeUnitFromList = useAppStore((state) => state.removeUnitFromList)
    const selectListUnit = useAppStore((state) => state.selectListUnit)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const [editingName, setEditingName] = useState(false)
    const [draftName, setDraftName] = useState('')

    const factionName = useMemo(() => {
        if (!currentList) return ''
        return factions.find((faction) => faction.id === currentList.faction_id)?.name ?? currentList.faction_id
    }, [currentList, factions])
    const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units])

    if (!currentList) return null

    const totalPoints = currentList.units.reduce((sum, unit) => sum + unit.totalPoints, 0)
    const commitName = () => {
        renameList(currentList.id, draftName)
        setEditingName(false)
    }

    return (
        <div className="p-3">
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
                    <div className="text-[12px] font-medium text-[var(--navy)]">Total: {totalPoints.toLocaleString('fr-FR')} pts</div>
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
                        title="Close"
                        onClick={closeList}
                        className="rounded border border-neutral-200 bg-white p-1.5 text-neutral-600 hover:bg-neutral-50"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            <div className="mt-3 space-y-1.5">
                {currentList.units.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-500">
                        No units added.
                    </div>
                ) : (
                    currentList.units.map((entry) => {
                        const unit = unitById.get(entry.unitId)
                        const active = selectedListInstanceId === entry.instanceId
                        return (
                            <button
                                key={entry.instanceId}
                                type="button"
                                onClick={() => selectListUnit(entry.instanceId)}
                                className={`w-full rounded-lg border p-2 text-left transition ${active ? 'border-blue-200 bg-blue-50' : 'border-neutral-200 bg-white hover:bg-neutral-50'}`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-neutral-900">{unit?.name ?? entry.unitId}</div>
                                        <div className="text-[11px] text-neutral-500">{unit?.role ?? 'Unit'}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="whitespace-nowrap text-[11px] font-medium text-[var(--navy)]">{entry.totalPoints} pts</span>
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            title="Remove"
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                removeUnitFromList(entry.instanceId)
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault()
                                                    event.stopPropagation()
                                                    removeUnitFromList(entry.instanceId)
                                                }
                                            }}
                                            className="rounded p-1 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
                                        >
                                            <Minus size={13} />
                                        </span>
                                    </div>
                                </div>
                            </button>
                        )
                    })
                )}
            </div>
        </div>
    )
}
