import type { ArmyUnit, Unit } from '../../types/index'
import { useAppStore } from '../../store'
import HardpointPicker from './HardpointPicker'
import OptionsPicker from './OptionsPicker'

interface Props {
    armyUnit: ArmyUnit
    unit: Unit
}

export default function UnitConfigurator({ armyUnit, unit }: Props) {
    const updateUnitQuantity = useAppStore((state) => state.updateUnitQuantity)

    return (
        <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/90 p-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
                <label className="space-y-2 text-sm text-slate-300">
                    <span>Quantité</span>
                    <input
                        type="number"
                        min={1}
                        max={unit.models}
                        value={armyUnit.quantity}
                        onChange={(event) => updateUnitQuantity(armyUnit.instanceId, Number(event.target.value))}
                        className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 focus:border-slate-500 focus:outline-none"
                    />
                </label>
                <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-300">
                    <p className="font-semibold text-white">Total par unité</p>
                    <p className="mt-2">{unit.point_cost_per_model} pts</p>
                </div>
            </div>

            <div className="mt-6 space-y-6">
                <div>
                    <h4 className="text-lg font-semibold text-white">Hardpoints</h4>
                    <div className="mt-4 space-y-4">
                        {armyUnit.hardpoints.map((hardpoint) => (
                            <HardpointPicker
                                key={hardpoint.slot}
                                unit={unit}
                                armyUnit={armyUnit}
                                hardpoint={hardpoint}
                            />
                        ))}
                    </div>
                </div>

                <div>
                    <h4 className="text-lg font-semibold text-white">Options & upgrades</h4>
                    <div className="mt-4 space-y-4">
                        {unit.options_and_upgrades.map((option) => (
                            <OptionsPicker
                                key={option.tag}
                                armyUnit={armyUnit}
                                option={option}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
