import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getGeneratorsForFaction } from '../../store/selectors'
import { RuleWord } from '../ui/RuleWord'
import { computeModelPoints, computeTotalPoints, isUnitLevelOption } from '../../utils/pointsCalc'
import { unitCanTakeGenerator } from '../../utils/unitHelpers'
import type { ArmyUnit } from '../../types/index'

function formatValue(value: number | string | null | undefined) {
    return value == null ? '—' : String(value)
}

function formatModelRange(unit: { min?: number; max?: number; models: number | string }) {
    if (typeof unit.min === 'number' && typeof unit.max === 'number') {
        return unit.min === unit.max ? `${unit.min}` : `${unit.min}-${unit.max}`
    }
    return String(unit.models)
}

function modelLabel(unit: { min?: number; max?: number; models: number | string }) {
    if (typeof unit.min === 'number' && typeof unit.max === 'number') {
        return unit.min === 1 && unit.max === 1 ? 'model' : 'models'
    }
    return typeof unit.models === 'number' && unit.models === 1 ? 'model' : 'models'
}

function findEntry(entries: ArmyUnit[], instanceId: string | null): ArmyUnit | null {
    if (!instanceId) return null
    for (const entry of entries) {
        if (entry.instanceId === instanceId) return entry
        const nested = findEntry(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

function findParent(entries: ArmyUnit[], instanceId: string | null): ArmyUnit | null {
    if (!instanceId) return null
    for (const entry of entries) {
        if ((entry.attachedUnits ?? []).some((attachment) => attachment.instanceId === instanceId)) return entry
        const nested = findParent(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

export default function UnitDetail() {
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const units = useAppStore((state) => state.units)
    const generators = useAppStore((state) => state.generators)
    const currentList = useAppStore((state) => state.currentList)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedModelId = useAppStore((state) => state.selectedModelId)
    const activeUnitConfig = useAppStore((state) => state.activeUnitConfig)
    const setHardpointSelection = useAppStore((state) => state.setHardpointSelection)
    const setGeneratorSelection = useAppStore((state) => state.setGeneratorSelection)
    const setOptionQuantity = useAppStore((state) => state.setOptionQuantity)
    const selectModel = useAppStore((state) => state.selectModel)
    const addModelToListUnit = useAppStore((state) => state.addModelToListUnit)
    const removeModelFromListUnit = useAppStore((state) => state.removeModelFromListUnit)
    const [openHardpointKey, setOpenHardpointKey] = useState<string | null>(null)

    const unit = useMemo(() => units.find((item) => item.id === selectedUnitId), [units, selectedUnitId])
    const selectedEntry = useMemo(
        () => currentList ? findEntry(currentList.units, selectedListInstanceId) : null,
        [currentList, selectedListInstanceId],
    )
    const selectedEntryParent = useMemo(
        () => currentList ? findParent(currentList.units, selectedListInstanceId) : null,
        [currentList, selectedListInstanceId],
    )

    if (!unit) {
        return (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white/70 p-4 text-sm text-neutral-500">
                Select a unit to view its details.
            </div>
        )
    }

    const statEntries = Object.entries(unit.stats)
    const factionGenerators = getGeneratorsForFaction(generators, unit.faction_id)
    const canTakeGenerator = unitCanTakeGenerator(unit)
    const generatorSelection = activeUnitConfig.generatorSelection
    const totalCost = selectedEntry ? selectedEntry.totalPoints : computeTotalPoints(unit, activeUnitConfig)
    const selectedModelCost = computeModelPoints(unit, activeUnitConfig)
    const minModels = unit.min ?? (typeof unit.models === 'number' ? unit.models : 1)
    const normalMaxModels = unit.max ?? (typeof unit.models === 'number' ? unit.models : minModels)
    const siblingAttachmentModels = selectedEntryParent && selectedEntry
        ? (selectedEntryParent.attachedUnits ?? [])
            .filter((attachment) => attachment.unitId === unit.id && attachment.instanceId !== selectedEntry.instanceId)
            .reduce((sum, attachment) => sum + attachment.models.length, 0)
        : 0
    const maxModels = selectedEntryParent ? (unit.attachment?.max_models ?? normalMaxModels) - siblingAttachmentModels : normalMaxModels
    const canAddModel = Boolean(selectedEntry && selectedEntry.models.length < maxModels)
    const canRemoveModel = Boolean(selectedEntry && selectedEntry.models.length > minModels)
    const hasOptions = unit.options_and_upgrades.length > 0
    const costBreakdown = [
        ...(selectedEntry ? [`Selected model: ${selectedModelCost} pts`] : []),
        ...(generatorSelection ? [`Generator (${generatorSelection.generatorName}): +${generatorSelection.generatorCost} pts`] : []),
        ...unit.options_and_upgrades.flatMap((option) => {
            const config = isUnitLevelOption(option.tag) && selectedEntry ? selectedEntry.config : activeUnitConfig
            const qty = config.optionQuantities[option.tag] ?? 0
            if (qty <= 0 || option.cost_per_unit == null) {
                return []
            }
            return [`${option.tag} ×${qty}: +${qty * option.cost_per_unit} pts`]
        }),
    ]

    return (
        <div className="space-y-2">
            <section className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Detail</div>
                        <h2 className="mt-1 text-lg font-semibold text-neutral-900">{unit.name}</h2>
                        <p className="text-sm text-neutral-600">{unit.sub_name}</p>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <div className="text-sm text-neutral-700">{unit.point_cost_per_model ?? 0} pts</div>
                        <div className="mt-2 flex flex-col items-end gap-1 text-[11px] text-neutral-500">
                            {costBreakdown.length > 0 ? (
                                <>
                                    {costBreakdown.map((line) => (
                                        <div key={line}>{line}</div>
                                    ))}
                                </>
                            ) : null}
                            <div className="rounded-full bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white">Total: {totalCost} pts</div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-600">
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">{unit.role}</span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">
                        {formatModelRange(unit)} {modelLabel(unit)}
                    </span>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1">{unit.faction}</span>
                </div>
                {selectedEntry ? (
                    <div className="mt-3 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Models</div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    className="h-6 w-6 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => removeModelFromListUnit(selectedEntry.instanceId, selectedModelId ?? '')}
                                    disabled={!canRemoveModel || !selectedModelId}
                                    title="Remove selected model"
                                >
                                    −
                                </button>
                                <span className="min-w-12 text-center text-[11px] text-neutral-600">
                                    {selectedEntry.models.length}/{maxModels}
                                </span>
                                <button
                                    type="button"
                                    className="h-6 w-6 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => addModelToListUnit(selectedEntry.instanceId)}
                                    disabled={!canAddModel}
                                    title="Add model"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                            {selectedEntry.models.map((model, index) => {
                                const active = selectedModelId === model.modelId
                                return (
                                    <button
                                        key={model.modelId}
                                        type="button"
                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${active ? 'border-[var(--navy)] bg-[var(--navy)] text-white' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100'}`}
                                        onClick={() => selectModel(model.modelId)}
                                    >
                                        Model {index + 1}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ) : null}
            </section>

            <section className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Stats</div>
                <div className="mt-1.5 overflow-x-auto">
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

            <section className="grid items-start gap-2 md:grid-cols-2">
                <div className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Properties</div>
                    <div className="mt-1.5 divide-y divide-neutral-100">
                        {unit.properties.length > 0 ? (
                            unit.properties.map((property) => (
                                <div key={property.name} className="flex min-h-7 items-center justify-between gap-2 py-1 text-sm text-neutral-700">
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

                <div className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Systems</div>
                    <div className="mt-1.5 divide-y divide-neutral-100">
                        {unit.systems.length > 0 ? (
                            unit.systems.map((system) => (
                                <div key={system.name} className="flex min-h-7 items-center justify-between gap-2 py-1 text-sm text-neutral-700">
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

            <section className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Weapons</div>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-1.5 text-sm">
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
                                const selectedName = activeUnitConfig.hardpointSelections[index] ?? weapon.name
                                const options = weapon.slot ? unit.hardpoint_options?.[weapon.slot] ?? [] : []
                                const displayWeapon = options.find((option) => option.name === selectedName) ?? weapon
                                const isOpen = openHardpointKey === weaponKey
                                const displayArc = weapon.arc ?? displayWeapon.arc ?? '—'
                                const isGeneratorSlot = generatorSelection?.weaponIndex === index
                                const canShowGeneratorSection = canTakeGenerator && weapon.slot === 'H' && (generatorSelection == null || generatorSelection.weaponIndex === index)
                                const showGeneratorRow = weapon.slot === 'H' && isGeneratorSlot

                                if (showGeneratorRow && generatorSelection) {
                                    return (
                                        <tr key={weaponKey} className="bg-amber-50 align-top">
                                            <td className="rounded-l-lg px-2 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-neutral-900">{generatorSelection.generatorName}</span>
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">+{generatorSelection.generatorCost} pts</span>
                                                    <button
                                                        type="button"
                                                        className="text-[10px] font-medium text-neutral-500 underline-offset-2 hover:underline"
                                                        onClick={() => setGeneratorSelection(null)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-2 py-2 text-neutral-600">—</td>
                                            <td className="px-2 py-2 text-neutral-600">—</td>
                                            <td className="px-2 py-2 text-neutral-600">—</td>
                                            <td className="px-2 py-2 text-neutral-600">—</td>
                                            <td className="rounded-r-lg px-2 py-2 text-neutral-600">
                                                <span className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] text-neutral-600">(Generator)</span>
                                            </td>
                                        </tr>
                                    )
                                }

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
                                                        <div className="rounded border border-neutral-200 bg-white p-2 text-[11px] text-neutral-700 shadow-sm">
                                                            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Default</div>
                                                            <label className="mt-1 flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name={`slot-${selectedModelId ?? 'preview'}-${index}`}
                                                                    checked={selectedName === weapon.name}
                                                                    onChange={() => {
                                                                        setHardpointSelection(index, weapon.name)
                                                                        setOpenHardpointKey(null)
                                                                        if (generatorSelection?.weaponIndex === index) {
                                                                            setGeneratorSelection(null)
                                                                        }
                                                                    }}
                                                                />
                                                                <span>{weapon.name}</span>
                                                            </label>
                                                            {options.length > 0 ? (
                                                                <>
                                                                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Hardpoint Alternatives</div>
                                                                    {options.map((option) => (
                                                                        <label key={option.name} className="mt-1 flex items-center gap-2">
                                                                            <input
                                                                                type="radio"
                                                                                name={`slot-${selectedModelId ?? 'preview'}-${index}`}
                                                                                checked={selectedName === option.name}
                                                                                onChange={() => {
                                                                                    setHardpointSelection(index, option.name)
                                                                                    setOpenHardpointKey(null)
                                                                                    if (generatorSelection?.weaponIndex === index) {
                                                                                        setGeneratorSelection(null)
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <span>{option.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </>
                                                            ) : null}
                                                            {canShowGeneratorSection && factionGenerators.length > 0 ? (
                                                                <>
                                                                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Generators</div>
                                                                    {factionGenerators.map((generator) => (
                                                                        <label key={generator.name} className="mt-1 flex items-center justify-between gap-2">
                                                                            <span className="flex items-center gap-2">
                                                                                <input
                                                                                    type="radio"
                                                                                    name={`slot-${selectedModelId ?? 'preview'}-${index}`}
                                                                                    checked={generatorSelection?.weaponIndex === index && generatorSelection?.generatorName === generator.name}
                                                                                    onChange={() => {
                                                                                        setGeneratorSelection({ weaponIndex: index, generatorName: generator.name, generatorCost: generator.point_cost })
                                                                                        setOpenHardpointKey(null)
                                                                                    }}
                                                                                />
                                                                                <span>{generator.name}</span>
                                                                            </span>
                                                                            <span className="text-[10px] text-neutral-500">+{generator.point_cost} pts</span>
                                                                        </label>
                                                                    ))}
                                                                </>
                                                            ) : null}
                                                        </div>
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

            {hasOptions ? (
                <section className="rounded-xl border border-neutral-200 bg-white p-2.5 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">Options & Upgrades</div>
                    <div className="mt-1.5 divide-y divide-neutral-100">
                        {unit.options_and_upgrades.map((option) => {
                            const unitLevel = isUnitLevelOption(option.tag)
                            const config = unitLevel && selectedEntry ? selectedEntry.config : activeUnitConfig
                            const qty = config.optionQuantities[option.tag] ?? 0
                            const max = unitLevel ? option.max : option.max ?? 1
                            const canIncrease = max == null || qty < max
                            const isGeneratorOption = option.tag === 'GENERATOR'

                            return (
                                <div key={option.tag} className="flex items-center justify-between gap-3 py-1.5">
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-neutral-900">{option.tag}</div>
                                        <div className="text-[11px] text-neutral-500">{option.description}</div>
                                    </div>
                                    {isGeneratorOption ? (
                                        <div className="text-[11px] text-neutral-400">—</div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="h-6 w-6 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                onClick={() => setOptionQuantity(option.tag, qty - 1)}
                                                disabled={qty === 0}
                                            >
                                                −
                                            </button>
                                            <div className="min-w-6 text-center text-sm font-medium text-neutral-900">{qty}</div>
                                            <button
                                                type="button"
                                                className="h-6 w-6 rounded-full border border-neutral-200 bg-white text-sm text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                onClick={() => {
                                                    if (canIncrease) {
                                                        setOptionQuantity(option.tag, qty + 1)
                                                    }
                                                }}
                                                disabled={!canIncrease}
                                            >
                                                +
                                            </button>
                                            <div className="text-[11px] text-neutral-500">{max != null ? `Max ${max}` : 'Unlimited'}</div>
                                        </div>
                                    )}
                                    <div className="text-right text-[11px] text-neutral-600">
                                        {option.cost_per_unit == null ? '—' : `${qty * option.cost_per_unit} pts`}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </section>
            ) : null}
        </div>
    )
}
