import { Check, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Faction, Unit } from '../../types/index'
import TagChip from '../ui/TagChip'

interface Props {
    unit: Unit
    faction?: Faction
    active: boolean
    onSelect: () => void
    onAdd?: () => void
}

export default function UnitCard({ unit, faction, active, onSelect, onAdd }: Props) {
    const [added, setAdded] = useState(false)
    const addedTimer = useRef<number | null>(null)

    useEffect(() => () => {
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current)
    }, [])

    const addUnit = () => {
        onAdd?.()
        setAdded(true)
        if (addedTimer.current != null) window.clearTimeout(addedTimer.current)
        addedTimer.current = window.setTimeout(() => setAdded(false), 650)
    }

    return (
        <div
            className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-sky-500 bg-sky-50 shadow-sm ring-1 ring-sky-200' : 'border-neutral-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'}`}
            style={{ borderLeft: `3px solid ${faction?.color ?? 'var(--navy)'}` }}
        >
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={onSelect}
                    className="min-w-0 flex-1 text-left"
                >
                    <div className="truncate text-sm font-medium text-neutral-900">{unit.name}</div>
                    <div className="text-[11px] text-neutral-500">{unit.sub_name}</div>
                </button>
                {onAdd ? (
                    <button
                        type="button"
                        title={added ? 'Added' : 'Add to list'}
                        onClick={addUnit}
                        className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold transition ${added ? 'scale-105 bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200' : 'text-[var(--navy)] hover:bg-blue-50'}`}
                    >
                        {added ? <Check size={15} /> : <Plus size={15} />}
                        {added ? <span>Added</span> : null}
                    </button>
                ) : null}
            </div>
            <button
                type="button"
                onClick={onSelect}
                className="mt-2 flex w-full items-center justify-between gap-2 text-left"
            >
                <span className="text-[11px] font-medium text-[var(--navy)]">{unit.point_cost_per_model ?? '—'} pts · {unit.vpr} VPR</span>
            </button>
            <button
                type="button"
                onClick={onSelect}
                className="mt-2 flex w-full flex-wrap items-center gap-1 text-left"
            >
                {unit.tags.map((tag) => (
                    <TagChip key={tag} label={tag} />
                ))}
            </button>
        </div>
    )
}
