import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getGeneratorsForFaction } from '../../store/selectors'
import { RuleWord } from '../ui/RuleWord'
import { computeModelPoints, computeTotalPoints, isUnitLevelOption } from '../../utils/pointsCalc'
import { unitCanTakeGenerator } from '../../utils/unitHelpers'
import { getFactionSpecialRules } from '../../utils/factionSpecialRules'
import { getAvailableFleetDoctrines } from '../../utils/fleetDoctrines'
import { RuleModal } from '../ui/RuleModal'
import type { ArmyUnit, FleetDoctrine, Generator, Unit } from '../../types/index'

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

function getGeneratorChoices(unit: Unit, factionGenerators: Generator[], slot: string | undefined): Generator[] {
    const optionTags = new Set(unit.options_and_upgrades.map((option) => option.tag))
    const fixedChoices: Generator[] = []
    const magmaCastOption = unit.options_and_upgrades.find((option) => option.tag === 'MAGMA_CAST_GENERATOR')
    const freeGeneratorOption = unit.options_and_upgrades.find((option) => option.tag === 'EMPIRE_FREE_GENERATOR')

    if (optionTags.has('TRIDENT_GENERATOR') && slot === 'H') {
        fixedChoices.push({ name: 'Trident Generator', point_cost: 0 })
    }
    if ((optionTags.has('GUARDIAN_GENERATOR') && slot === 'L') || (optionTags.has('ADDITIONAL_GUARDIAN_GENERATOR') && slot === 'H')) {
        fixedChoices.push({ name: 'Guardian Generator', point_cost: 0 })
    }
    if (optionTags.has('FREYA_ARRAY') && slot === 'L') {
        fixedChoices.push({ name: 'Freya Array', point_cost: 0 })
    }
    if (magmaCastOption && slot === 'H') {
        fixedChoices.push({ name: 'Magma Cast Generator', point_cost: magmaCastOption.cost_per_unit ?? 0 })
    }
    if (freeGeneratorOption && slot === 'H') {
        return [
            ...factionGenerators.map((generator) => ({ ...generator, point_cost: 0 })),
            ...fixedChoices,
        ]
    }
    if (magmaCastOption && optionTags.has('GENERATOR') && slot === 'H') {
        return [...factionGenerators, ...fixedChoices]
    }
    if (fixedChoices.length > 0) return fixedChoices

    return optionTags.has('GENERATOR') && slot === 'H' ? factionGenerators : []
}

export default function UnitDetail() {
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const units = useAppStore((state) => state.units)
    const generators = useAppStore((state) => state.generators)
    const fleetDoctrines = useAppStore((state) => state.fleetDoctrines)
    const currentList = useAppStore((state) => state.currentList)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedModelId = useAppStore((state) => state.selectedModelId)
    const activeUnitConfig = useAppStore((state) => state.activeUnitConfig)
    const setHardpointSelection = useAppStore((state) => state.setHardpointSelection)
    const setGeneratorSelection = useAppStore((state) => state.setGeneratorSelection)
    const setFleetDoctrineSelection = useAppStore((state) => state.setFleetDoctrineSelection)
    const setOptionQuantity = useAppStore((state) => state.setOptionQuantity)
    const selectModel = useAppStore((state) => state.selectModel)
    const addModelToListUnit = useAppStore((state) => state.addModelToListUnit)
    const removeModelFromListUnit = useAppStore((state) => state.removeModelFromListUnit)
    const [openHardpointKey, setOpenHardpointKey] = useState<string | null>(null)
    const [openDoctrine, setOpenDoctrine] = useState<FleetDoctrine | null>(null)

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
    const availableFleetDoctrines = getAvailableFleetDoctrines(unit, fleetDoctrines)
    const canTakeGenerator = unitCanTakeGenerator(unit)
    const generatorSelection = activeUnitConfig.generatorSelection
    const factionSpecialRules = getFactionSpecialRules(unit, generatorSelection?.generatorName ?? null)
    const fleetDoctrineSelection = selectedEntry?.config.fleetDoctrineSelection ?? null
    const selectedDoctrine = availableFleetDoctrines.find((doctrine) => doctrine.name === fleetDoctrineSelection?.doctrineName) ?? null
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
    const srsProperty = unit.properties.find((property) => property.name === 'SRS')
    const srsTypeNames = srsProperty?.detail
        ?.split(/[,/]/)
        .map((name) => name.trim())
        .filter(Boolean) ?? []
    const visibleSquadrons = unit.short_range_squadrons?.filter((squadron) => (
        srsTypeNames.length === 0 || srsTypeNames.includes(squadron.name)
    )) ?? []
    const hasCarrierSrs = unit.properties.some((property) => property.name === 'Carrier' || property.name === 'Underwater Carrier') && visibleSquadrons.length > 0
    const attachmentPoints = selectedEntry
        ? (selectedEntry.attachedUnits ?? []).reduce((sum, attachment) => sum + attachment.totalPoints, 0)
        : 0
    const modelInfo = selectedEntry
        ? `${selectedEntry.models.length}/${maxModels} ${selectedEntry.models.length === 1 ? 'model' : 'models'}`
        : `${formatModelRange(unit)} ${modelLabel(unit)}`
    const costBreakdown = [
        ...(selectedEntry ? [`Selected model: ${selectedModelCost} pts`] : []),
        ...(fleetDoctrineSelection ? [`Doctrine (${fleetDoctrineSelection.doctrineName}): +${fleetDoctrineSelection.doctrineCost} pts`] : []),
        ...(generatorSelection ? [`Generator (${generatorSelection.generatorName}): +${generatorSelection.generatorCost} pts`] : []),
        ...unit.options_and_upgrades.flatMap((option) => {
            const config = isUnitLevelOption(option.tag) && selectedEntry ? selectedEntry.config : activeUnitConfig
            const qty = config.optionQuantities[option.tag] ?? 0
            if (qty <= 0 || option.cost_per_unit == null) {
                return []
            }
            return [`${option.tag} ×${qty}: +${qty * option.cost_per_unit} pts`]
        }),
        ...(attachmentPoints > 0 ? [`Attachments: +${attachmentPoints} pts`] : []),
    ]

    return (
        <div className="space-y-2">
            <section className="unit-detail-section unit-detail-hero rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.2em]">Detail</div>
                        <h2 className="mt-1 text-lg font-semibold text-white">{unit.name}</h2>
                        <p className="text-sm text-white/78">{unit.sub_name}</p>
                        <p className="mt-1 text-[11px] font-medium text-white/65">Models: {modelInfo}</p>
                    </div>
                    <div className="flex flex-col items-end text-right">
                        <div className="text-sm font-medium text-white">{unit.point_cost_per_model ?? '—'} pts</div>
                        <div className="mt-2 flex flex-col items-end gap-1 text-[11px] text-white/75">
                            {costBreakdown.length > 0 ? (
                                <>
                                    {costBreakdown.map((line) => (
                                        <div key={line}>{line}</div>
                                    ))}
                                </>
                            ) : null}
                            <div className="rounded-full border border-white/20 bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">Total: {totalCost} pts</div>
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--navy)]">
                    <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">{unit.role}</span>
                    <span className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">{unit.faction}</span>
                </div>
                {selectedEntry ? (
                    <div className="mt-3 rounded-lg border border-white/20 bg-white/12 p-2">
                        <div className="flex items-center justify-between gap-2">
                            <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.16em]">Models</div>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    className="h-6 w-6 rounded-full border border-white/40 bg-white text-sm text-[var(--navy)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                    onClick={() => removeModelFromListUnit(selectedEntry.instanceId, selectedModelId ?? '')}
                                    disabled={!canRemoveModel || !selectedModelId}
                                    title="Remove selected model"
                                >
                                    −
                                </button>
                                <span className="min-w-12 text-center text-[11px] font-medium text-white">
                                    {selectedEntry.models.length}/{maxModels}
                                </span>
                                <button
                                    type="button"
                                    className="h-6 w-6 rounded-full border border-white/40 bg-white text-sm text-[var(--navy)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
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
                                        className={`rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm ${active ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)]' : 'border-white/40 bg-white text-[var(--navy)] hover:bg-[var(--gold-light)]'}`}
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

            <section className="unit-detail-section unit-detail-stat rounded-xl p-2.5 shadow-sm">
                <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Stats</div>
                <div className="mt-1.5 overflow-x-auto">
                    <table className="min-w-full border border-white/40 bg-white text-center shadow-sm">
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
                <div className="unit-detail-section unit-detail-panel rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Properties</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {unit.properties.length > 0 ? (
                            unit.properties.map((property) => (
                                <div key={property.name} className="unit-detail-rule-row">
                                    <span className="min-w-0 font-medium text-neutral-900">
                                        <RuleWord category="properties" name={property.name} value={property.value} showValue={false} />
                                    </span>
                                    {property.detail ? <span className="unit-detail-rule-detail">{property.detail}</span> : null}
                                    {property.value != null ? <span className="unit-detail-rule-value">{property.value}</span> : null}
                                </div>
                            ))
                        ) : (
                            <div className="unit-detail-empty">None</div>
                        )}
                    </div>
                </div>

                <div className="unit-detail-section unit-detail-panel rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Systems</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                        {unit.systems.length > 0 || factionSpecialRules.length > 0 ? (
                            <>
                                {unit.systems.map((system) => (
                                    <div key={system.name} className="unit-detail-rule-row">
                                        <span className="min-w-0 font-medium text-neutral-900">
                                            <RuleWord category="systems" name={system.name} value={system.value} showValue={false} />
                                        </span>
                                        {system.value != null ? <span className="unit-detail-rule-value">{system.value}</span> : null}
                                    </div>
                                ))}
                                {factionSpecialRules.map((rule) => (
                                    <div key={rule.name} className="unit-detail-rule-row">
                                        <span className="min-w-0 font-medium text-neutral-900">
                                            <RuleWord category="systems" name={rule.name} value={rule.value} showValue={false} />
                                        </span>
                                        {rule.detail ? <span className="unit-detail-rule-detail">{rule.detail}</span> : null}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="unit-detail-empty">None</div>
                        )}
                    </div>
                </div>
            </section>

            <section className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Weapons</div>
                <div className="mt-2 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-y-1.5 text-sm">
                        <thead>
                            <tr className="text-left text-[11px] uppercase tracking-[0.2em] text-[var(--detail-ink)]/75">
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
                                const generatorChoices = canTakeGenerator ? getGeneratorChoices(unit, factionGenerators, weapon.slot) : []
                                const canShowGeneratorSection = generatorChoices.length > 0 && (generatorSelection == null || generatorSelection.weaponIndex === index)
                                const showGeneratorRow = Boolean(weapon.slot) && isGeneratorSlot

                                if (showGeneratorRow && generatorSelection) {
                                    return (
                                        <tr key={weaponKey} className="align-top unit-detail-weapon-row">
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
                                    <tr key={weaponKey} className="align-top unit-detail-weapon-row">
                                        <td className="rounded-l-lg px-2 py-2">
                                            {options.length > 0 || canShowGeneratorSection ? (
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
                                                            {canShowGeneratorSection ? (
                                                                <>
                                                                    <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Generators</div>
                                                                    {generatorChoices.map((generator) => (
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

            {hasOptions || (selectedEntry && availableFleetDoctrines.length > 0) ? (
                <section className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
                    {hasOptions ? (
                        <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                            <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Options & Upgrades</div>
                            <div className="unit-detail-line mt-1.5 divide-y">
                                {unit.options_and_upgrades.map((option) => {
                                    const unitLevel = isUnitLevelOption(option.tag)
                                    const config = unitLevel && selectedEntry ? selectedEntry.config : activeUnitConfig
                                    const qty = config.optionQuantities[option.tag] ?? 0
                                    const max = unitLevel ? option.max : option.max ?? 1
                                    const canIncrease = max == null || qty < max
                                    const isGeneratorOption = option.tag === 'GENERATOR'
                                        || option.tag === 'TRIDENT_GENERATOR'
                                        || option.tag === 'GUARDIAN_GENERATOR'
                                        || option.tag === 'ADDITIONAL_GUARDIAN_GENERATOR'
                                        || option.tag === 'FREYA_ARRAY'
                                        || option.tag === 'MAGMA_CAST_GENERATOR'
                                        || option.tag === 'EMPIRE_FREE_GENERATOR'

                                    return (
                                        <div key={option.tag} className="flex items-center justify-between gap-3 py-1.5 text-[var(--detail-ink)]">
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-semibold text-neutral-900">{option.tag}</div>
                                                <div className="text-[11px] leading-tight text-[var(--detail-ink)]">{option.description}</div>
                                            </div>
                                            {isGeneratorOption ? (
                                                <div className="text-[11px] text-[var(--detail-ink)]/70">—</div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        className="h-6 w-6 rounded-full border border-white/70 bg-white text-sm text-[var(--navy)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                                        onClick={() => setOptionQuantity(option.tag, qty - 1)}
                                                        disabled={qty === 0}
                                                    >
                                                        −
                                                    </button>
                                                    <div className="min-w-6 text-center text-sm font-semibold text-neutral-900">{qty}</div>
                                                    <button
                                                        type="button"
                                                        className="h-6 w-6 rounded-full border border-white/70 bg-white text-sm text-[var(--navy)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                                        onClick={() => {
                                                            if (canIncrease) {
                                                                setOptionQuantity(option.tag, qty + 1)
                                                            }
                                                        }}
                                                        disabled={!canIncrease}
                                                    >
                                                        +
                                                    </button>
                                                    <div className="text-[11px] text-[var(--detail-ink)]/75">{max != null ? `Max ${max}` : 'Unlimited'}</div>
                                                </div>
                                            )}
                                            <div className="text-right text-[11px] font-medium text-[var(--navy)]">
                                                {option.cost_per_unit == null ? '—' : `${qty * option.cost_per_unit} pts`}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : null}

                    {selectedEntry && availableFleetDoctrines.length > 0 ? (
                        <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                                <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Fleet Doctrine</div>
                                {fleetDoctrineSelection ? (
                                    <span className="rounded-full border border-white/70 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--navy)]">
                                        +{fleetDoctrineSelection.doctrineCost}
                                    </span>
                                ) : null}
                            </div>
                            <select
                                className="mt-2 w-full rounded-md border border-white/80 bg-white px-2 py-1.5 text-sm font-medium text-neutral-900 shadow-sm outline-none focus:border-[var(--navy)]"
                                value={fleetDoctrineSelection?.doctrineName ?? ''}
                                onChange={(event) => {
                                    const doctrine = availableFleetDoctrines.find((item) => item.name === event.target.value)
                                    setFleetDoctrineSelection(doctrine ? { doctrineName: doctrine.name, doctrineCost: doctrine.point_cost } : null)
                                }}
                            >
                                <option value="">None</option>
                                {availableFleetDoctrines.map((doctrine) => (
                                    <option key={doctrine.name} value={doctrine.name}>
                                        {doctrine.name} (+{doctrine.point_cost})
                                    </option>
                                ))}
                            </select>
                            {selectedDoctrine ? (
                                <button
                                    type="button"
                                    className="mt-2 max-w-full truncate text-left text-[11px] font-semibold text-[var(--navy)] underline-offset-2 hover:underline"
                                    onClick={() => setOpenDoctrine(selectedDoctrine)}
                                >
                                    {selectedDoctrine.name}
                                </button>
                            ) : (
                                <div className="mt-2 text-[11px] text-[var(--detail-ink)]/60">No doctrine selected.</div>
                            )}
                        </div>
                    ) : null}
                </section>
            ) : null}

            {hasCarrierSrs ? (
                <section className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                    <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Short Range Squadrons</div>
                    <div className="mt-2 overflow-x-auto">
                        <table className="unit-detail-srs-table min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-[10px] uppercase tracking-[0.16em]">
                                    <th className="px-2 py-1.5">Squadron Type</th>
                                    <th className="px-2 py-1.5 text-center">Atk</th>
                                    <th className="px-2 py-1.5 text-center">Int</th>
                                    <th className="px-2 py-1.5 text-center">Spt</th>
                                    <th className="px-2 py-1.5 text-center">Res</th>
                                    <th className="px-2 py-1.5">SRS Properties</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleSquadrons.map((squadron) => (
                                    <tr key={squadron.name}>
                                        <td className="px-2 py-2 font-semibold text-neutral-900">{squadron.name}</td>
                                        <td className="px-2 py-2 text-center font-semibold">{squadron.attack}</td>
                                        <td className="px-2 py-2 text-center font-semibold">{squadron.intercept}</td>
                                        <td className="px-2 py-2 text-center font-semibold">{squadron.support}</td>
                                        <td className="px-2 py-2 text-center font-semibold">{squadron.resilience}</td>
                                        <td className="px-2 py-2">
                                            {squadron.properties.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {squadron.properties.map((property) => (
                                                        <span key={`${squadron.name}-${property.name}`} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] text-neutral-600">
                                                            <RuleWord category="properties" name={property.name} value={property.value} />
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-neutral-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : null}

            {openDoctrine ? (
                <RuleModal
                    name={openDoctrine.name}
                    value={openDoctrine.point_cost}
                    category="Fleet Doctrine"
                    text={openDoctrine.text}
                    onClose={() => setOpenDoctrine(null)}
                />
            ) : null}
        </div>
    )
}
