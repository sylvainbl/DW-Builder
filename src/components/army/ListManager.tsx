import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getTotalPoints, getTotalVPR } from '../../store/selectors'

export default function ListManager() {
    const savedLists = useAppStore((state) => state.savedLists)
    const loadList = useAppStore((state) => state.loadList)
    const deleteList = useAppStore((state) => state.deleteList)
    const units = useAppStore((state) => state.units)
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const selected = savedLists.find((item) => item.id === selectedId) ?? null
    const totalPoints = useMemo(() => getTotalPoints({ currentList: selected, units }), [selected, units])
    const totalVPR = useMemo(() => getTotalVPR({ currentList: selected, units }), [selected, units])

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <h2 className="text-2xl font-semibold text-white">Gestion des listes</h2>
                <p className="mt-2 text-slate-400">Chargez, supprimez et inspectez vos listes sauvegardées.</p>
            </section>

            <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-6 shadow-xl shadow-slate-950/20">
                    <h3 className="text-xl font-semibold text-white">Listes sauvegardées</h3>
                    <div className="mt-4 space-y-3">
                        {savedLists.length === 0 ? (
                            <p className="text-slate-400">Aucune liste enregistrée pour le moment.</p>
                        ) : (
                            savedLists.map((list) => (
                                <div key={list.id} className="flex items-center justify-between gap-3 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
                                    <button
                                        type="button"
                                        className="text-left text-sm text-slate-100 transition hover:text-white"
                                        onClick={() => setSelectedId(list.id)}
                                    >
                                        {list.name}
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-full border border-slate-600 bg-slate-800/90 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
                                        onClick={() => {
                                            setSelectedId(list.id)
                                            loadList(list.id)
                                        }}
                                    >
                                        Charger
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-full border border-slate-600 bg-slate-800/90 px-3 py-2 text-sm text-slate-100 transition hover:bg-slate-700"
                                        onClick={() => loadList(list.id)}
                                    >
                                        Charger
                                    </button>
                                    <button
                                        type="button"
                                        className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20"
                                        onClick={() => deleteList(list.id)}
                                    >
                                        Supprimer
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                    <h3 className="text-xl font-semibold text-white">Aperçu</h3>
                    {selected ? (
                        <div className="mt-4 space-y-4 text-slate-300">
                            <p className="text-sm text-slate-400">Faction: {selected.faction_id}</p>
                            <p className="text-sm text-slate-400">Créée le {new Date(selected.createdAt).toLocaleDateString()}</p>
                            <p className="text-sm text-slate-400">Unités: {selected.units.length}</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="rounded-3xl bg-slate-950/80 p-4">
                                    <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Points</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{totalPoints}</p>
                                </div>
                                <div className="rounded-3xl bg-slate-950/80 p-4">
                                    <p className="text-sm uppercase tracking-[0.35em] text-slate-500">VPR</p>
                                    <p className="mt-2 text-2xl font-semibold text-white">{totalVPR}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="mt-4 text-slate-400">Sélectionnez une liste pour voir son détail.</p>
                    )}
                </div>
            </section>
        </div>
    )
}
