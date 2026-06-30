import { Plus } from 'lucide-react'
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
                        title="Add to list"
                        onClick={onAdd}
                        className="rounded-md px-1.5 py-1 text-[var(--navy)] hover:bg-blue-50"
                    >
                        <Plus size={15} />
                    </button>
                ) : null}
            </div>
            <button
                type="button"
                onClick={onSelect}
                className="mt-2 flex w-full items-center justify-between gap-2 text-left"
            >
                <span className="text-[11px] font-medium text-[var(--navy)]">{unit.point_cost_per_model ?? '—'} pts</span>
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
