import type { Unit } from '../../types/index'

interface Props {
    unit: Unit
    active: boolean
    onSelect: () => void
    onAdd: () => void
}

export default function UnitCard({ unit, active, onSelect, onAdd }: Props) {
    return (
        <article
            className={`rounded-3xl border p-5 shadow-xl shadow-slate-950/10 transition ${active ? 'border-sky-500 bg-slate-800/90' : 'border-slate-800 bg-slate-900/90 hover:-translate-y-0.5 hover:border-slate-600'}`}
            onClick={onSelect}
        >
            <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">{unit.name}</h3>
                    <p className="text-sm text-slate-400">{unit.sub_name}</p>
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation()
                        onAdd()
                    }}
                    className="rounded-full bg-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:bg-slate-600"
                >
                    +
                </button>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-300">
                <span className="rounded-full bg-slate-800 px-3 py-1">{unit.role}</span>
                {unit.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-slate-800 px-3 py-1">
                        {tag}
                    </span>
                ))}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                <span>{unit.models} modèle(s)</span>
                <span>{unit.point_cost_per_model} pts / modèle</span>
            </div>
        </article>
    )
}
