import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { RuleWord } from '../ui/RuleWord'

function formatValue(value: number | string | null | undefined) {
    return value == null ? '—' : String(value)
}

export default function UnitDetail() {
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const units = useAppStore((state) => state.units)
    const [selectedHardpoints, setSelectedHardpoints] = useState<Record<string, string>>({})
    const [openHardpointKey, setOpenHardpointKey] = useState<string | null>(null)
    const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({})

    const unit = useMemo(() => units.find((item) => item.id === selectedUnitId), [units, selectedUnitId])

    useEffect(() => {
        setSelectedHardpoints({})
        setOpenHardpointKey(null)
        setSelectedOptions({})
    }, [selectedUnitId])

    if (!unit) {
        return (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/70 p-4 text-sm text-neutral-500">
                Sélectionnez une unité pour afficher ses détails.
            </div>
        )
    }

    const statEntries = Object.entries(unit.stats)

    return (
        <div className="space-y-4">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Détail</div>
                        <h2 className="mt-1 text-lg font-semibold text-neutral-900">{unit.name}</h2>
                        <p className="text-sm text-neutral-600">{unit.sub_name}</p>
                    </div>
                    <span className="rounded-full bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white">{unit.point_cost_per_model} pts</span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-neutral-600">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">{unit.role}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">{unit.models} modèle(s)</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">{unit.faction}</span>
                </div>

                <p className="mt-3 text-sm leading-6 text-neutral-600">{unit.lore}</p>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Stats</div>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border border-neutral-200 text-center">
                        <tbody>
                            <tr>
                                {statEntries.map(([key, value]) => (
                                    <td key={key} className="w-16 border-r border-neutral-200 px-1 py-1 last:border-r-0">
                                        <div className="text-[13px] font-medium leading-none text-neutral-900">{formatValue(value)}</div>
                                    </td>
                                ))}
                            </tr>
                            <tr>
                                {statEntries.map(([key]) => (
                                    <td key={key} className="border-r border-neutral-200 px-1 pb-1 last:border-r-0">
                                        <div className="text-[9px] uppercase tracking-[0.16em] text-neutral-400">{key}</div>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Properties</div>
                    <div className="mt-2 space-y-1">
                        {unit.properties.length > 0 ? (
                            unit.properties.map((property) => (
                                <div key={property.name} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-1 text-sm text-neutral-700 last:border-b-0">
                                    <span className="font-medium text-neutral-900">
                                        <RuleWord category="properties" name={property.name} value={property.value} />
                                    </span>
                                    {property.value != null ? <span className="text-[11px] text-neutral-500">{property.value}</span> : null}
                                </div>
                            ))
                        ) : (
                            <div className="py-1 text-sm text-neutral-500">None</div>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Systems</div>
                    <div className="mt-2 space-y-1">
                        {unit.systems.length > 0 ? (
                            unit.systems.map((system) => (
                                <div key={system.name} className="flex items-center justify-between gap-2 border-b border-neutral-100 py-1 text-sm text-neutral-700 last:border-b-0">
                                    <span className="font-medium text-neutral-900">
                                        <RuleWord category="systems" name={system.name} value={system.value} />
                                    </span>
                                    {system.value != null ? <span className="text-[11px] text-neutral-500">{system.value}</span> : null}
                                </div>
                            ))
                        ) : (
                            <div className="py-1 text-sm text-neutral-500">None</div>
                        )}
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Weapons</div>
                <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                                <th className="px-2 py-1">Name</th>
                                <th className="px-2 py-1">Arc</th>
                                <th className="px-2 py-1">C</th>
                                <th className="px-2 py-1">S</th>
                                <th className="px-2 py-1">E</th>
                                <th className="px-2 py-1">Rules</th>
                            </tr>
                        </thead>
                        <tbody>
                            {unit.weapons.map((weapon, index) => {
                                const weaponKey = `${unit.id}-${index}-${weapon.slot ?? 'base'}`
                                const selectedName = selectedHardpoints[weaponKey] ?? weapon.name
                                const options = weapon.slot ? unit.hardpoint_options?.[weapon.slot] ?? [] : []
                                const displayWeapon = options.find((option) => option.name === selectedName) ?? weapon
                                const isOpen = openHardpointKey === weaponKey
                                const displayArc = weapon.arc ?? displayWeapon.arc ?? '—'

                                return (
                                    <tr key={weaponKey} className="bg-neutral-50 align-top">
                                        <td className="rounded-l-lg px-2 py-2">
                                            {options.length > 0 ? (
                                                <div className="space-y-1">
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-left text-[11px] font-medium text-neutral-900"
                                                        onClick={() => setOpenHardpointKey((current) => (current === weaponKey ? null : weaponKey))}
                                                    >
                                                        <span>{displayWeapon.name}</span>
                                                        <span className="text-[10px] text-neutral-400">▾</span>
                                                    </button>
                                                    {isOpen ? (
                                                        <select
                                                            value={selectedName}
                                                            onChange={(event) => {
                                                                setSelectedHardpoints((current) => ({ ...current, [weaponKey]: event.target.value }))
                                                                setOpenHardpointKey(null)
                                                            }}
                                                            className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] text-neutral-700"
                                                        >
                                                            <option value={weapon.name}>{weapon.name}</option>
                                                            {options.map((option) => (
                                                                <option key={option.name} value={option.name}>
                                                                    {option.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : null}
                                                </div>
                                            ) : (
                                                <span className="font-medium text-neutral-900">{displayWeapon.name}</span>
                                            )}
                                        </td>
                                        <td className="px-2 py-2 text-neutral-600">{displayArc}</td>
                                        <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.C)}</td>
                                        <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.S)}</td>
                                        <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.E)}</td>
                                        <td className="rounded-r-lg px-2 py-2 text-neutral-600">
                                            {displayWeapon.qualities.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {displayWeapon.qualities.map((quality) => (
                                                        <span key={quality.name} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-600">
                                                            <RuleWord category="qualities" name={quality.name} value={quality.value} />
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                '—'
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Options & Upgrades</div>
                    <div className="text-[11px] text-neutral-500">
                        Total: <span className="font-semibold text-neutral-900">{unit.options_and_upgrades.reduce((sum, option) => {
                            const qty = selectedOptions[option.tag] ?? 0
                            return sum + (option.cost_per_unit != null ? qty * option.cost_per_unit : 0)
                        }, 0)} pts</span>
                    </div>
                </div>
                <div className="mt-3 space-y-2">
                    {unit.options_and_upgrades.map((option) => {
                        const qty = selectedOptions[option.tag] ?? 0
                        const max = option.max
                        const canIncrease = max == null || qty < max

                        return (
                            <div key={option.tag} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="font-medium text-neutral-900">{option.tag}</div>
                                        <div className="mt-1 text-xs text-neutral-500">{option.description}</div>
                                    </div>
                                    <div className="text-right text-[11px] text-neutral-600">
                                        <div>{option.cost_per_unit == null ? 'See rules' : `${option.cost_per_unit} pts each`}</div>
                                        <div className="mt-1 font-medium text-neutral-900">{option.cost_per_unit == null ? '—' : `${qty * option.cost_per_unit} pts`}</div>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() => setSelectedOptions((current) => ({ ...current, [option.tag]: Math.max(0, (current[option.tag] ?? 0) - 1) }))}
                                        disabled={qty === 0}
                                    >
                                        −
                                    </button>
                                    <div className="min-w-8 text-center text-sm font-medium text-neutral-900">{qty}</div>
                                    <button
                                        type="button"
                                        className="h-7 w-7 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={() => {
                                            if (canIncrease) {
                                                setSelectedOptions((current) => ({ ...current, [option.tag]: (current[option.tag] ?? 0) + 1 }))
                                            }
                                        }}
                                        disabled={!canIncrease}
                                    >
                                        +
                                    </button>
                                    <div className="ml-2 text-[11px] text-neutral-500">{max != null ? `Max ${max}` : 'Unlimited'}</div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
