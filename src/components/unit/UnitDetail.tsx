import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../../store'
import StatBlock from '../ui/StatBlock'
import WeaponTable from '../ui/WeaponTable'
import RuleTag from '../glossary/RuleTag'

export default function UnitDetail() {
    const { unitId } = useParams()
    const units = useAppStore((state) => state.units)

    const unit = useMemo(() => units.find((item) => item.id === unitId), [units, unitId])

    if (!unit) {
        return (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <p className="text-slate-300">Sélectionnez une unité pour voir le détail.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                        <span className="rounded-full bg-slate-800 px-3 py-1">{unit.faction}</span>
                        <span className="rounded-full bg-slate-800 px-3 py-1">{unit.role}</span>
                        <span className="rounded-full bg-slate-800 px-3 py-1">{unit.models} modèle(s)</span>
                    </div>
                    <h2 className="text-3xl font-semibold text-white">{unit.name}</h2>
                    <p className="text-lg text-slate-300">{unit.sub_name}</p>
                    <p className="text-slate-400 italic">{unit.lore}</p>
                </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <h3 className="text-xl font-semibold text-white">Stats</h3>
                <div className="mt-4">
                    <StatBlock stats={unit.stats} />
                </div>
            </section>

            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Armes de base</h3>
                    <span className="text-sm text-slate-500">{unit.weapons.length} arme(s)</span>
                </div>
                <div className="mt-5">
                    <WeaponTable weapons={unit.weapons} />
                </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                    <h3 className="text-xl font-semibold text-white">Propriétés</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {unit.properties.map((property) => (
                            <RuleTag key={property.name} category="properties" name={property.name} value={property.value} />
                        ))}
                    </div>
                </div>

                <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                    <h3 className="text-xl font-semibold text-white">Systèmes</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                        {unit.systems.map((system) => (
                            <RuleTag key={system.name} category="systems" name={system.name} value={system.value} />
                        ))}
                    </div>
                </div>
            </section>

            {Object.keys(unit.hardpoint_options).length > 0 ? (
                <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                    <h3 className="text-xl font-semibold text-white">Options de hardpoints</h3>
                    <div className="mt-4 space-y-3 text-slate-300">
                        {Object.entries(unit.hardpoint_options).map(([slot, options]) => (
                            <div key={slot} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                                <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Slot {slot}</p>
                                <div className="mt-3 space-y-2">
                                    {options.map((weapon) => (
                                        <div key={weapon.name} className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3 text-sm text-slate-200">
                                            <div className="font-semibold">{weapon.name}</div>
                                            <div className="mt-1 text-slate-400">Arc: {weapon.arc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ) : null}

            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <h3 className="text-xl font-semibold text-white">Upgrades</h3>
                <div className="mt-4 space-y-3 text-slate-300">
                    {unit.options_and_upgrades.map((option) => (
                        <div key={option.tag} className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-semibold text-white">{option.tag}</p>
                                    <p className="text-sm text-slate-400">{option.description}</p>
                                </div>
                                <span className="text-sm text-slate-400">{option.cost_per_unit === null ? 'Voir règles' : `${option.cost_per_unit} pts / unité`}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
