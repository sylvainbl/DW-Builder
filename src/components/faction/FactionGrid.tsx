import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import type { Faction } from '../../types/index'

export default function FactionGrid() {
    const factions = useAppStore((state) => state.factions)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const navigate = useNavigate()

    const cards = useMemo(() => factions, [factions])

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <h2 className="text-xl font-semibold text-white">Choisissez votre faction</h2>
                <p className="mt-2 text-slate-400">Parcourez les factions et commencez la construction de votre liste.</p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((faction: Faction) => (
                    <button
                        key={faction.id}
                        type="button"
                        onClick={() => {
                            setSelectedFactionId(faction.id)
                            navigate(`/faction/${faction.id}`)
                        }}
                        className="group rounded-3xl border border-slate-800 bg-slate-900/90 p-5 text-left shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5 hover:border-slate-600"
                        style={{ backgroundColor: faction.color, color: '#fff' }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-lg font-semibold">{faction.name}</h3>
                        </div>
                        <p className="mt-4 text-sm leading-6 text-white/90">{faction.description}</p>
                    </button>
                ))}
            </div>
        </div>
    )
}
