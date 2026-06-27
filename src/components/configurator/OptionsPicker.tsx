import type { ArmyUnit, OptionUpgrade } from '../../types/index'
import { useAppStore } from '../../store'

interface Props {
    armyUnit: ArmyUnit
    option: OptionUpgrade
}

export default function OptionsPicker({ armyUnit, option }: Props) {
    const setOption = useAppStore((state) => state.setOption)
    const selection = armyUnit.options.find((item) => item.tag === option.tag)
    const quantity = selection?.quantity ?? 0

    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="font-semibold text-white">{option.tag}</p>
                    <p className="text-sm text-slate-400">{option.description}</p>
                </div>
                <span className="text-sm text-slate-400">{option.cost_per_unit === null ? 'Voir règles' : `${option.cost_per_unit} pts / unité`}</span>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <button
                    type="button"
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                    onClick={() => setOption(armyUnit.instanceId, option.tag, Math.max(0, quantity - 1))}
                >
                    −
                </button>
                <span className="min-w-[2rem] text-center text-lg font-semibold text-white">{quantity}</span>
                <button
                    type="button"
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500"
                    onClick={() => setOption(armyUnit.instanceId, option.tag, Math.min(option.max, quantity + 1))}
                >
                    +
                </button>
            </div>
        </div>
    )
}
