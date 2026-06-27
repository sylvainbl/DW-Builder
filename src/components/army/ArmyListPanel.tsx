import { useMemo } from 'react'
import { useAppStore } from '../../store'
import { getTotalPoints, getTotalVPR, resolveArmyUnit } from '../../store/selectors'
import ArmyUnitRow from './ArmyUnitRow'

export default function ArmyListPanel() {
    const currentList = useAppStore((state) => state.currentList)
    const units = useAppStore((state) => state.units)
    const saveCurrentList = useAppStore((state) => state.saveCurrentList)

    const totalPoints = useMemo(() => getTotalPoints({ currentList, units }), [currentList, units])
    const totalVPR = useMemo(() => getTotalVPR({ currentList, units }), [currentList, units])

    if (!currentList) {
        return (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <p className="text-slate-300">Aucune liste active. Créez une liste pour commencer à ajouter des unités.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Liste</p>
                        <h2 className="text-2xl font-semibold text-white">{currentList.name}</h2>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
                        onClick={saveCurrentList}
                    >
                        Sauvegarder
                    </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-slate-950/80 p-4 text-slate-100">
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Points totaux</p>
                        <p className="mt-2 text-3xl font-semibold">{totalPoints}</p>
                    </div>
                    <div className="rounded-3xl bg-slate-950/80 p-4 text-slate-100">
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">VPR total</p>
                        <p className="mt-2 text-3xl font-semibold">{totalVPR}</p>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold text-neutral-900">Unités</h3>
                <div className="mt-4 space-y-3">
                    {currentList.units.length === 0 ? (
                        <p className="text-slate-400">Aucune unité ajoutée pour le moment.</p>
                    ) : (
                        currentList.units.map((armyUnit) => {
                            const resolved = resolveArmyUnit(armyUnit, units)
                            if (!resolved) return null
                            return <ArmyUnitRow key={armyUnit.instanceId} armyUnit={armyUnit} unit={resolved.unit} points={resolved.totalPoints} />
                        })
                    )}
                </div>
            </section>
        </div>
    )
}
