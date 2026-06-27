import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import ArmyListPanel from '../army/ArmyListPanel'

const linkClass = 'text-sm font-semibold text-slate-200 hover:text-white'
const activeClass = 'text-white underline decoration-slate-400/50 underline-offset-4'

export default function AppShell() {
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const factions = useAppStore((state) => state.factions)
    const currentList = useAppStore((state) => state.currentList)
    const createNewList = useAppStore((state) => state.createNewList)
    const navigate = useNavigate()

    const activeFaction = factions.find((item) => item.id === selectedFactionId)

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-20">
                <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Dystopian Wars Builder</p>
                        <h1 className="text-2xl font-bold tracking-tight">{activeFaction?.name ?? 'Choisissez une faction'}</h1>
                    </div>
                    <div className="flex items-center gap-3 text-slate-300">
                        <button
                            type="button"
                            className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm transition hover:border-slate-500 hover:bg-slate-700"
                            onClick={() => {
                                const factionId = selectedFactionId ?? factions[0]?.id
                                if (factionId) {
                                    createNewList(factionId, `Liste ${new Date().toLocaleDateString()}`)
                                    navigate(`/faction/${factionId}`)
                                }
                            }}
                        >
                            Nouvelle liste
                        </button>
                        <NavLink to="/lists" className={({ isActive }) => `${linkClass} ${isActive ? activeClass : ''}`}>
                            Listes
                        </NavLink>
                    </div>
                </div>
            </header>

            <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-8">
                <aside className="space-y-4">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-slate-950/20">
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Faction active</p>
                        <div className="mt-4 space-y-2">
                            <p className="text-lg font-semibold text-white">{activeFaction?.name ?? 'Aucune faction'}</p>
                            <p className="text-sm text-slate-400">{activeFaction?.description ?? 'Sélectionnez une faction pour commencer.'}</p>
                        </div>
                    </div>
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-slate-950/20">
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Liste en cours</p>
                        <div className="mt-4 space-y-2">
                            <p className="text-lg font-semibold text-white">{currentList?.name ?? 'Aucune liste'}</p>
                            <p className="text-sm text-slate-400">{currentList ? `${currentList.units.length} unité(s)` : 'Créez une liste pour lister vos unités.'}</p>
                        </div>
                    </div>
                </aside>

                <section className="space-y-6">
                    <Outlet />
                </section>

                <aside className="space-y-4">
                    <ArmyListPanel />
                </aside>
            </main>
        </div>
    )
}
