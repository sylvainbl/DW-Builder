import { useState } from 'react'
import type { ArmyUnit, Unit } from '../../types/index'
import { useAppStore } from '../../store'
import UnitConfigurator from '../configurator/UnitConfigurator'

interface Props {
    armyUnit: ArmyUnit
    unit: Unit
    points: number
}

export default function ArmyUnitRow({ armyUnit, unit, points }: Props) {
    const [open, setOpen] = useState(false)
    const removeUnitFromList = useAppStore((state) => state.removeUnitFromList)

    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-lg font-semibold text-white">{unit.name}</p>
                    <p className="text-sm text-slate-400">{armyUnit.quantity} × {unit.point_cost_per_model} pts</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
                        onClick={() => setOpen((current) => !current)}
                    >
                        Configurer
                    </button>
                    <button
                        type="button"
                        className="rounded-full border border-rose-500 bg-rose-500/10 px-3 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20"
                        onClick={() => removeUnitFromList(armyUnit.instanceId)}
                    >
                        ×
                    </button>
                </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2 text-sm text-slate-300">
                <span>{unit.role} • {unit.models} modèle(s)</span>
                <span>{points} pts</span>
            </div>

            {open ? <UnitConfigurator armyUnit={armyUnit} unit={unit} /> : null}
        </div>
    )
}
