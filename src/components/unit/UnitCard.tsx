import { Plus } from 'lucide-react'
import type { Faction, Unit } from '../../types/index'
import TagChip from '../ui/TagChip'

interface Props {
    unit: Unit
    faction?: Faction
    active: boolean
    onSelect: () => void
    onAdd?: () => void
    attachmentTargets?: { instanceId: string; label: string }[]
    onAttach?: (parentInstanceId: string) => void
}

export default function UnitCard({ unit, faction, active, onSelect, onAdd, attachmentTargets = [], onAttach }: Props) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`w-full rounded-xl border p-3 text-left transition ${active ? 'border-sky-500 bg-sky-50 shadow-sm ring-1 ring-sky-200' : 'border-neutral-200 bg-white hover:border-sky-200 hover:bg-sky-50/40'}`}
            style={{ borderLeft: `3px solid ${faction?.color ?? 'var(--navy)'}` }}
        >
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-900">{unit.name}</div>
                    <div className="text-[11px] text-neutral-500">{unit.sub_name}</div>
                </div>
                {onAdd ? (
                    <span
                        role="button"
                        tabIndex={0}
                        title="Add to list"
                        onClick={(event) => {
                            event.stopPropagation()
                            onAdd()
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                event.stopPropagation()
                                onAdd()
                            }
                        }}
                        className="rounded-md px-1.5 py-1 text-[var(--navy)] hover:bg-blue-50"
                    >
                        <Plus size={15} />
                    </span>
                ) : null}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1">
                {unit.tags.slice(0, 2).map((tag) => (
                    <TagChip key={tag} label={tag} />
                ))}
                <span className="ml-auto text-[11px] font-medium text-[var(--navy)]">{unit.point_cost_per_model ?? 0} pts</span>
            </div>
            {attachmentTargets.length > 0 && onAttach ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {attachmentTargets.map((target) => (
                        <span
                            key={target.instanceId}
                            role="button"
                            tabIndex={0}
                            title={`Attach to ${target.label}`}
                            onClick={(event) => {
                                event.stopPropagation()
                                onAttach(target.instanceId)
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault()
                                    event.stopPropagation()
                                    onAttach(target.instanceId)
                                }
                            }}
                            className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100"
                        >
                            Attach to {target.label}
                        </span>
                    ))}
                </div>
            ) : null}
        </button>
    )
}
