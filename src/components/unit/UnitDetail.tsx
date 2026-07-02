import { Minus, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useAppStore } from '../../store'
import { getGeneratorsForFaction } from '../../store/selectors'
import { RuleWord } from '../ui/RuleWord'
import { computeModelPoints, computeOptionPoints, computeTotalPoints, hasChitaSwarmEscortDiscount, isUnitLevelOption } from '../../utils/pointsCalc'
import { unitCanTakeGenerator } from '../../utils/unitHelpers'
import { getFactionSpecialRules } from '../../utils/factionSpecialRules'
import { getAvailableFleetDoctrines } from '../../utils/fleetDoctrines'
import { formatOptionName, getEffectiveGeneratorSelections, getSelectedOptionRuleEffects, getSelectedRemovedWeaponNames, getSelectedTags, getSystemGeneratorSlotCount, mergeNamedValues, SYSTEM_GENERATOR_WEAPON_INDEX } from '../../utils/optionRuleEffects'
import { getVisibleSrsSquadrons } from '../../utils/srs'
import { canAttachToParent, getAttachmentKeyword, getAttachmentModelLimitForUnit, getMinimumModelsForUnit } from '../../utils/attachments'
import { computeArmyUnitGuardianPool, computeArmyUnitGuardianSurge, computeModelGuardianPool, computeModelGuardianSurge, isCrownFaction } from '../../utils/guardianPool'
import { RuleModal } from '../ui/RuleModal'
import type { ArmyUnit, FleetDoctrine, Generator, OptionUpgrade, Unit, Weapon } from '../../types/index'
import BattlefleetDetail from '../lists/BattlefleetDetail'
import ListGlossaryDetail from '../lists/ListGlossaryDetail'

const KAGUTSUCHI_BATTLEFLEET_ID = 'empire-kagutsuchi-volcanic'
const KAGUTSUCHI_MAGMA_CAST_COST = 45

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

function unitHasNativeMagmaCastOption(unit: Unit): boolean {
    return unit.options_and_upgrades.some((option) => option.tag === 'MAGMA_CAST_GENERATOR')
}

function getRestrictedGeneratorNames(unit: Unit): Set<string> {
    return new Set(unit.options_and_upgrades.flatMap((option) => option.restrictions ?? []))
}

function filterRestrictedGenerators(generators: Generator[], restrictedGeneratorNames: Set<string>): Generator[] {
    return generators.filter((generator) => !restrictedGeneratorNames.has(generator.name))
}

function getGeneratorChoices(unit: Unit, factionGenerators: Generator[], slot: string | undefined, extraMagmaCastCost: number | null = null): Generator[] {
    const weaponGeneratorOptions = unit.options_and_upgrades.filter((option) => option.generator_replaces_weapon !== false)
    const optionTags = new Set(weaponGeneratorOptions.map((option) => option.tag))
    const restrictedGeneratorNames = getRestrictedGeneratorNames(unit)
    const fixedChoices: Generator[] = []
    const magmaCastOption = weaponGeneratorOptions.find((option) => option.tag === 'MAGMA_CAST_GENERATOR')
    const freeGeneratorOption = weaponGeneratorOptions.find((option) => option.tag === 'EMPIRE_FREE_GENERATOR')
        ?? weaponGeneratorOptions.find((option) => option.tag === 'FREE_GENERATOR')

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
    if (!magmaCastOption && extraMagmaCastCost != null && slot === 'H') {
        fixedChoices.push({ name: 'Magma Cast Generator', point_cost: extraMagmaCastCost })
    }
    if (freeGeneratorOption && slot === 'H') {
        return [
            ...filterRestrictedGenerators(factionGenerators, restrictedGeneratorNames).map((generator) => ({ ...generator, point_cost: 0 })),
            ...filterRestrictedGenerators(fixedChoices, restrictedGeneratorNames),
        ]
    }
    if (magmaCastOption && optionTags.has('GENERATOR') && slot === 'H') {
        return filterRestrictedGenerators([...factionGenerators, ...fixedChoices], restrictedGeneratorNames)
    }
    if (fixedChoices.length > 0) return filterRestrictedGenerators(fixedChoices, restrictedGeneratorNames)

    return optionTags.has('GENERATOR') && slot === 'H' ? filterRestrictedGenerators(factionGenerators, restrictedGeneratorNames) : []
}

function getSystemGeneratorChoices(unit: Unit, factionGenerators: Generator[], extraMagmaCastCost: number | null = null): Generator[] {
    const systemGeneratorOptions = unit.options_and_upgrades.filter((option) => option.generator_replaces_weapon === false)
    const restrictedGeneratorNames = getRestrictedGeneratorNames(unit)
    if (systemGeneratorOptions.length === 0) {
        return extraMagmaCastCost != null ? filterRestrictedGenerators([{ name: 'Magma Cast Generator', point_cost: extraMagmaCastCost }], restrictedGeneratorNames) : []
    }

    const optionTags = new Set(systemGeneratorOptions.map((option) => option.tag))
    const magmaCastOption = systemGeneratorOptions.find((option) => option.tag === 'MAGMA_CAST_GENERATOR')
    const choices = optionTags.has('GENERATOR') || optionTags.has('EMPIRE_FREE_GENERATOR') || optionTags.has('FREE_GENERATOR')
        ? factionGenerators.map((generator) => ({
            ...generator,
            point_cost: optionTags.has('EMPIRE_FREE_GENERATOR') || optionTags.has('FREE_GENERATOR') ? 0 : generator.point_cost,
        }))
        : []

    if (magmaCastOption) {
        choices.push({ name: 'Magma Cast Generator', point_cost: magmaCastOption.cost_per_unit ?? 0 })
    }
    if (!magmaCastOption && extraMagmaCastCost != null) {
        choices.push({ name: 'Magma Cast Generator', point_cost: extraMagmaCastCost })
    }

    return filterRestrictedGenerators(choices, restrictedGeneratorNames)
}

function optionUnavailableForAttachment(option: OptionUpgrade): boolean {
    return (option.restrictions ?? []).some((restriction) => restriction.toLowerCase().includes('attachment'))
}

function WeaponQualityChips({ qualities }: { qualities: Weapon['qualities'] }) {
    if (qualities.length === 0) return <span className="text-neutral-500">—</span>

    return (
        <div className="flex flex-wrap gap-1">
            {qualities.map((quality) => (
                <span key={`${quality.name}-${quality.value ?? ''}`} className="unit-detail-chip">
                    <RuleWord category="qualities" name={quality.name} value={quality.value} />
                </span>
            ))}
        </div>
    )
}

function WeaponChoiceRow({
    label,
    weapon,
    inheritedArc,
    checked,
    name,
    onChange,
}: {
    label: string
    weapon: Weapon
    inheritedArc: string | null | undefined
    checked: boolean
    name: string
    onChange: () => void
}) {
    const displayArc = weapon.arc ?? inheritedArc ?? '—'

    return (
        <label className={`unit-detail-choice-row ${checked ? 'unit-detail-choice-row-selected' : ''}`}>
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
            />
            <span className="unit-detail-choice-main">
                <span className="unit-detail-choice-name">{weapon.name}</span>
                <span className="unit-detail-choice-kind">{label}</span>
            </span>
            <span className="unit-detail-choice-stat">
                <span>Arc</span>
                <strong>{displayArc}</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>C</span>
                <strong>{formatValue(weapon.firepower.C)}</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>S</span>
                <strong>{formatValue(weapon.firepower.S)}</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>E</span>
                <strong>{formatValue(weapon.firepower.E)}</strong>
            </span>
            <span className="unit-detail-choice-rules">
                <WeaponQualityChips qualities={weapon.qualities} />
            </span>
        </label>
    )
}

function GeneratorChoiceRow({
    generator,
    checked,
    name,
    onChange,
}: {
    generator: Generator
    checked: boolean
    name: string
    onChange: () => void
}) {
    return (
        <label className={`unit-detail-choice-row ${checked ? 'unit-detail-choice-row-selected' : ''}`}>
            <input
                type="radio"
                name={name}
                checked={checked}
                onChange={onChange}
            />
            <span className="unit-detail-choice-main">
                <span className="unit-detail-choice-name">{generator.name}</span>
                <span className="unit-detail-choice-kind">Generator</span>
            </span>
            <span className="unit-detail-choice-stat">
                <span>Arc</span>
                <strong>—</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>C</span>
                <strong>—</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>S</span>
                <strong>—</strong>
            </span>
            <span className="unit-detail-choice-stat">
                <span>E</span>
                <strong>—</strong>
            </span>
            <span className="unit-detail-choice-rules">
                <span className="unit-detail-chip">
                    <RuleWord category="systems" name={generator.name} showValue={false} />
                </span>
                <span className="unit-detail-chip unit-detail-chip-cost">+{generator.point_cost} pts</span>
            </span>
        </label>
    )
}

export default function UnitDetail() {
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const units = useAppStore((state) => state.units)
    const generators = useAppStore((state) => state.generators)
    const glossary = useAppStore((state) => state.glossary)
    const fleetDoctrines = useAppStore((state) => state.fleetDoctrines)
    const currentList = useAppStore((state) => state.currentList)
    const battlefleetDefinitions = useAppStore((state) => state.battlefleetDefinitions)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedBattlefleetInstanceId = useAppStore((state) => state.selectedBattlefleetInstanceId)
    const selectedListGlossary = useAppStore((state) => state.selectedListGlossary)
    const selectedModelId = useAppStore((state) => state.selectedModelId)
    const activeUnitConfig = useAppStore((state) => state.activeUnitConfig)
    const setHardpointSelection = useAppStore((state) => state.setHardpointSelection)
    const setGeneratorSelection = useAppStore((state) => state.setGeneratorSelection)
    const setSystemGeneratorSelection = useAppStore((state) => state.setSystemGeneratorSelection)
    const setFleetDoctrineSelection = useAppStore((state) => state.setFleetDoctrineSelection)
    const setOptionQuantity = useAppStore((state) => state.setOptionQuantity)
    const selectModel = useAppStore((state) => state.selectModel)
    const addAttachmentToListUnit = useAppStore((state) => state.addAttachmentToListUnit)
    const removeUnitFromList = useAppStore((state) => state.removeUnitFromList)
    const addModelToListUnit = useAppStore((state) => state.addModelToListUnit)
    const removeModelFromListUnit = useAppStore((state) => state.removeModelFromListUnit)
    const renameListUnit = useAppStore((state) => state.renameListUnit)
    const renameModel = useAppStore((state) => state.renameModel)
    const [openHardpointKey, setOpenHardpointKey] = useState<string | null>(null)
    const [openDoctrine, setOpenDoctrine] = useState<FleetDoctrine | null>(null)
    const [editingUnitName, setEditingUnitName] = useState(false)
    const [unitDraftName, setUnitDraftName] = useState('')
    const [editingModelName, setEditingModelName] = useState(false)
    const [modelDraftName, setModelDraftName] = useState('')

    const unit = useMemo(() => units.find((item) => item.id === selectedUnitId), [units, selectedUnitId])
    const selectedBattlefleet = useMemo(
        () => currentList?.battlefleets?.find((battlefleet) => battlefleet.instanceId === selectedBattlefleetInstanceId) ?? null,
        [currentList?.battlefleets, selectedBattlefleetInstanceId],
    )
    const selectedBattlefleetDefinition = useMemo(
        () => battlefleetDefinitions.find((definition) => definition.id === selectedBattlefleet?.definitionId) ?? null,
        [battlefleetDefinitions, selectedBattlefleet],
    )
    const selectedBattlefleetEntries = useMemo(
        () => currentList && selectedBattlefleet
            ? currentList.units.filter((entry) => entry.battlefleetInstanceId === selectedBattlefleet.instanceId)
            : [],
        [currentList, selectedBattlefleet],
    )
    const selectedEntry = useMemo(
        () => currentList ? findEntry(currentList.units, selectedListInstanceId) : null,
        [currentList, selectedListInstanceId],
    )
    const selectedEntryParent = useMemo(
        () => currentList ? findParent(currentList.units, selectedListInstanceId) : null,
        [currentList, selectedListInstanceId],
    )
    const selectedModel = useMemo(
        () => selectedEntry?.models.find((model) => model.modelId === selectedModelId) ?? null,
        [selectedEntry, selectedModelId],
    )
    const selectedEntryGeneratedByOption = Boolean(selectedEntry?.generatedByOption)

    if (!unit) {
        if (currentList && selectedListGlossary) {
            return (
                <ListGlossaryDetail
                    list={currentList}
                    units={units}
                    glossary={glossary}
                />
            )
        }

        if (currentList && selectedBattlefleet && selectedBattlefleetDefinition) {
            return (
                <BattlefleetDetail
                    battlefleet={selectedBattlefleet}
                    definition={selectedBattlefleetDefinition}
                    forceFactionId={currentList.faction_id}
                    entries={selectedBattlefleetEntries}
                    units={units}
                    fleetDoctrines={fleetDoctrines}
                />
            )
        }

        return (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white/70 p-4 text-sm text-neutral-500">
                Select a unit or Battlefleet to view its details.
            </div>
        )
    }

    const statEntries = Object.entries(unit.stats)
    const factionGenerators = getGeneratorsForFaction(generators, unit.faction_id)
    const availableFleetDoctrines = getAvailableFleetDoctrines(unit, fleetDoctrines)
    const selectedEntryBattlefleet = currentList?.battlefleets?.find((battlefleet) => battlefleet.instanceId === selectedEntry?.battlefleetInstanceId) ?? null
    const isKagutsuchiEntry = selectedEntryBattlefleet?.definitionId === KAGUTSUCHI_BATTLEFLEET_ID
    const extraMagmaCastCost = isKagutsuchiEntry && !unitHasNativeMagmaCastOption(unit) ? KAGUTSUCHI_MAGMA_CAST_COST : null
    const hasNativeGeneratorAccess = unitCanTakeGenerator(unit)
    const usesSystemGeneratorMount = unit.options_and_upgrades.some((option) => option.generator_replaces_weapon === false)
    const extraSystemMagmaCastCost = extraMagmaCastCost != null && (!hasNativeGeneratorAccess || usesSystemGeneratorMount) ? extraMagmaCastCost : null
    const canTakeGenerator = hasNativeGeneratorAccess || extraMagmaCastCost != null
    const generatorSelections = getEffectiveGeneratorSelections(unit, activeUnitConfig, selectedEntry?.config)
    const weaponGeneratorSelection = generatorSelections.find((selection) => selection.weaponIndex !== SYSTEM_GENERATOR_WEAPON_INDEX) ?? null
    const selectedSystemGenerators = generatorSelections.filter((selection) => selection.weaponIndex === SYSTEM_GENERATOR_WEAPON_INDEX)
    const systemGeneratorChoices = canTakeGenerator ? getSystemGeneratorChoices(unit, factionGenerators, extraSystemMagmaCastCost) : []
    const systemGeneratorSlotCount = systemGeneratorChoices.length > 0 ? getSystemGeneratorSlotCount(unit) : 0
    const factionSpecialRules = getFactionSpecialRules(unit, generatorSelections.map((selection) => selection.generatorName))
    const optionRuleEffects = getSelectedOptionRuleEffects(unit, activeUnitConfig, selectedEntry?.config)
    const removedWeaponNames = getSelectedRemovedWeaponNames(unit, activeUnitConfig, selectedEntry?.config)
    const displayedWeapons = unit.weapons
        .map((weapon, index) => ({ weapon, index }))
        .filter(({ weapon }) => !removedWeaponNames.has(weapon.name))
    const displayedProperties = mergeNamedValues(
        unit.properties.filter((property) => !optionRuleEffects.removedProperties.has(property.name)),
        optionRuleEffects.properties,
    )
    const displayedSystems = mergeNamedValues(
        unit.systems.filter((system) => !optionRuleEffects.removedSystems.has(system.name)),
        generatorSelections.map((selection) => ({ name: selection.generatorName, value: null })),
        optionRuleEffects.systems,
        factionSpecialRules,
    )
    const fleetDoctrineSelection = selectedEntry?.config.fleetDoctrineSelection ?? null
    const selectedDoctrine = availableFleetDoctrines.find((doctrine) => doctrine.name === fleetDoctrineSelection?.doctrineName) ?? null
    const totalCost = selectedEntry ? selectedEntry.totalPoints : computeTotalPoints(unit, activeUnitConfig)
    const selectedModelCost = computeModelPoints(unit, activeUnitConfig, selectedEntry?.config)
    const showGuardianPool = isCrownFaction(unit.faction_id)
    const guardianPool = showGuardianPool
        ? selectedEntry
            ? computeArmyUnitGuardianPool(selectedEntry, units)
            : computeModelGuardianPool(unit, activeUnitConfig)
        : 0
    const guardianSurge = showGuardianPool
        ? selectedEntry
            ? computeArmyUnitGuardianSurge(selectedEntry, units)
            : computeModelGuardianSurge(unit, activeUnitConfig)
        : 0
    const minModels = unit.min ?? (typeof unit.models === 'number' ? unit.models : 1)
    const normalMaxModels = unit.max ?? (typeof unit.models === 'number' ? unit.models : minModels)
    const siblingAttachmentModels = selectedEntryParent && selectedEntry
        ? (selectedEntryParent.attachedUnits ?? [])
            .filter((attachment) => attachment.unitId === unit.id && attachment.instanceId !== selectedEntry.instanceId)
            .reduce((sum, attachment) => sum + attachment.models.length, 0)
        : 0
    const maxModels = selectedEntryGeneratedByOption
        ? selectedEntry?.models.length ?? normalMaxModels
        : selectedEntryParent ? getAttachmentModelLimitForUnit(unit) - siblingAttachmentModels : normalMaxModels
    const canAddModel = Boolean(selectedEntry && !selectedEntryGeneratedByOption && selectedEntry.models.length < maxModels)
    const canRemoveModel = Boolean(selectedEntry && !selectedEntryGeneratedByOption && selectedEntry.models.length > minModels)
    const availableOptions = unit.options_and_upgrades.filter((option) => !(selectedEntryParent && optionUnavailableForAttachment(option)))
    const hasOptions = availableOptions.length > 0
    const displayedTags = getSelectedTags(unit, activeUnitConfig, selectedEntry?.config)
    const visibleSquadrons = getVisibleSrsSquadrons(unit, displayedProperties)
    const hasCarrierSrs = displayedProperties.some((property) => property.name === 'Carrier' || property.name === 'Underwater Carrier' || property.name === 'Flight Deck' || property.name === 'SRS') && visibleSquadrons.length > 0
    const attachmentPoints = selectedEntry
        ? (selectedEntry.attachedUnits ?? []).reduce((sum, attachment) => sum + attachment.totalPoints, 0)
        : 0
    const modelInfo = selectedEntry
        ? `${selectedEntry.models.length}/${maxModels} ${selectedEntry.models.length === 1 ? 'model' : 'models'}`
        : `${formatModelRange(unit)} ${modelLabel(unit)}`
    const costBreakdown = [
        ...(selectedEntry ? [`Selected model: ${selectedModelCost} pts`] : []),
        ...(fleetDoctrineSelection ? [`Doctrine (${fleetDoctrineSelection.doctrineName}): +${fleetDoctrineSelection.doctrineCost} pts`] : []),
        ...generatorSelections.map((selection, index) => [`Generator${generatorSelections.length > 1 ? ` ${index + 1}` : ''} (${selection.generatorName}): +${selection.generatorCost} pts`]).flat(),
        ...availableOptions.flatMap((option) => {
            const config = isUnitLevelOption(option.tag) && selectedEntry ? selectedEntry.config : activeUnitConfig
            const qty = config.optionQuantities[option.tag] ?? 0
            if (qty <= 0 || option.cost_per_unit == null) {
                return []
            }
            const points = computeOptionPoints(option, qty, Boolean(selectedEntry && hasChitaSwarmEscortDiscount(selectedEntry, currentList ?? undefined))) ?? 0
            return [`${formatOptionName(option)} ×${qty}: +${points} pts`]
        }),
    ]
    const canManageAttachments = Boolean(selectedEntry && !selectedEntryParent && !selectedEntryGeneratedByOption)
    const hasNormalAttachment = Boolean(selectedEntry?.attachedUnits?.some((attachment) => !attachment.generatedByOption))
    const attachmentChoices = canManageAttachments && selectedEntry
        ? units
            .filter((candidate) => {
                const isAttached = (selectedEntry.attachedUnits ?? []).some((attachment) => attachment.unitId === candidate.id)
                return isAttached || canAttachToParent(candidate, unit, { parentTags: displayedTags })
            })
            .map((candidate) => {
                const attachedEntries = (selectedEntry.attachedUnits ?? []).filter((attachment) => attachment.unitId === candidate.id)
                const removableEntries = attachedEntries.filter((attachment) => !attachment.generatedByOption)
                const usedModels = attachedEntries
                    .reduce((sum, attachment) => sum + attachment.models.length, 0)
                const remainingModels = getAttachmentModelLimitForUnit(candidate) - usedModels
                const eligible = canAttachToParent(candidate, unit, { parentTags: displayedTags })
                return {
                    unit: candidate,
                    removableEntry: removableEntries.at(-1) ?? null,
                    keyword: getAttachmentKeyword(candidate) ?? 'Attachment',
                    usedModels,
                    remainingModels,
                    eligible,
                    canAdd: eligible && !hasNormalAttachment && remainingModels >= getMinimumModelsForUnit(candidate),
                }
            })
            .sort((left, right) => left.unit.name.localeCompare(right.unit.name))
        : []
    const commitUnitName = () => {
        if (selectedEntry) renameListUnit(selectedEntry.instanceId, unitDraftName)
        setEditingUnitName(false)
    }
    const commitModelName = () => {
        if (selectedEntry && selectedModelId) renameModel(selectedEntry.instanceId, selectedModelId, modelDraftName)
        setEditingModelName(false)
    }

    return (
        <div className="space-y-2">
            <section className="unit-detail-section unit-detail-hero rounded-xl p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.2em]">Detail</div>
                        <div className="mt-1 flex min-w-0 items-center gap-2">
                            <h2 className="truncate text-lg font-semibold text-white">{unit.name}</h2>
                            {selectedEntry ? (
                                <button
                                    type="button"
                                    title={selectedEntry.customName ? 'Rename unit' : 'Add unit name'}
                                    onClick={() => {
                                        setUnitDraftName(selectedEntry.customName ?? '')
                                        setEditingUnitName(true)
                                    }}
                                    className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                                >
                                    <Pencil size={12} />
                                </button>
                            ) : null}
                        </div>
                        {editingUnitName ? (
                            <input
                                value={unitDraftName}
                                autoFocus
                                onChange={(event) => setUnitDraftName(event.target.value)}
                                onBlur={commitUnitName}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') commitUnitName()
                                    if (event.key === 'Escape') setEditingUnitName(false)
                                }}
                                className="mt-1 w-full max-w-xs rounded border border-white/30 bg-white px-2 py-1 text-sm font-semibold text-[var(--navy)] outline-none"
                            />
                        ) : selectedEntry?.customName ? (
                            <p className="truncate text-sm font-semibold text-white/90">{selectedEntry.customName}</p>
                        ) : null}
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
                            {showGuardianPool ? (
                                <div className="rounded-full border border-white/20 bg-[var(--navy)] px-2.5 py-1 text-[11px] font-medium text-white shadow-sm">
                                    Guardian Pool: {guardianPool} - Guardian Surge: {guardianSurge}
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-[var(--navy)]">
                    {displayedTags.map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-2.5 py-1 font-medium shadow-sm">{tag}</span>
                    ))}
                </div>
                {selectedEntry ? (
                    <div className="mt-3 rounded-lg border border-white/20 bg-white/12 p-2">
                        <div className={`grid gap-3 ${canManageAttachments ? 'lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]' : ''}`}>
                            <div className="min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex min-w-0 items-center gap-2">
                                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.16em]">Models</div>
                                        {selectedModel ? (
                                            <button
                                                type="button"
                                                title={selectedModel.customName ? 'Rename model' : 'Add model name'}
                                                onClick={() => {
                                                    setModelDraftName(selectedModel.customName ?? '')
                                                    setEditingModelName(true)
                                                }}
                                                className="flex h-5 w-5 flex-none items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
                                            >
                                                <Pencil size={11} />
                                            </button>
                                        ) : null}
                                    </div>
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
                                        const modelName = model.customName?.trim() || `Model ${index + 1}`
                                        return (
                                            <button
                                                key={model.modelId}
                                                type="button"
                                                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-sm ${active ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)]' : 'border-white/40 bg-white text-[var(--navy)] hover:bg-[var(--gold-light)]'}`}
                                                onClick={() => selectModel(model.modelId)}
                                            >
                                                {modelName}
                                            </button>
                                        )
                                    })}
                                </div>
                                {editingModelName ? (
                                    <input
                                        value={modelDraftName}
                                        autoFocus
                                        onChange={(event) => setModelDraftName(event.target.value)}
                                        onBlur={commitModelName}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') commitModelName()
                                            if (event.key === 'Escape') setEditingModelName(false)
                                        }}
                                        className="mt-2 w-full max-w-xs rounded border border-white/30 bg-white px-2 py-1 text-[11px] font-semibold text-[var(--navy)] outline-none"
                                    />
                                ) : null}
                            </div>
                            {canManageAttachments ? (
                                <div className="min-w-0 rounded-lg border border-white/15 bg-white/10 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="unit-detail-title text-[11px] font-semibold uppercase tracking-[0.16em]">Attachments</div>
                                        {attachmentPoints > 0 ? (
                                            <span className="rounded-full border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white">
                                                +{attachmentPoints}
                                            </span>
                                        ) : null}
                                    </div>
                                    {attachmentChoices.length > 0 ? (
                                        <div className="mt-2 grid gap-1.5">
                                            {attachmentChoices.map(({ unit: attachment, removableEntry, keyword, usedModels, remainingModels, eligible, canAdd }) => {
                                                const isSelected = usedModels > 0
                                                return (
                                                    <div
                                                        key={attachment.id}
                                                        className={`grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[var(--detail-ink)] shadow-sm transition ${isSelected ? 'border-[var(--gold)] bg-[var(--gold-light)]' : 'border-white/35 bg-white/90'}`}
                                                    >
                                                        <span className="min-w-0">
                                                            <span className="flex min-w-0 items-center gap-1.5">
                                                                <span className="truncate text-[12px] font-semibold text-neutral-900">
                                                                    {attachment.name} ({keyword})
                                                                </span>
                                                                {isSelected ? (
                                                                    <span className="flex-none rounded-full border border-[var(--gold)] bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--navy)]">
                                                                        Selected
                                                                    </span>
                                                                ) : null}
                                                            </span>
                                                            <span className="block truncate text-[11px] text-[var(--detail-ink)]/75">
                                                                {attachment.sub_name} · {attachment.point_cost_per_model ?? '—'} pts · {usedModels}/{getAttachmentModelLimitForUnit(attachment)} selected · {!eligible ? 'position mismatch' : hasNormalAttachment && !isSelected ? 'attachment limit reached' : `${remainingModels} available`}
                                                            </span>
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                title={`Remove ${attachment.name}`}
                                                                onClick={() => {
                                                                    if (removableEntry) removeUnitFromList(removableEntry.instanceId)
                                                                }}
                                                                disabled={!removableEntry}
                                                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-white text-[var(--navy)] shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                title={`Add ${attachment.name}`}
                                                                onClick={() => addAttachmentToListUnit(selectedEntry.instanceId, attachment.id)}
                                                                disabled={!canAdd}
                                                                className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-[var(--navy)] text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="mt-2 rounded-lg border border-dashed border-white/35 bg-white/10 p-2 text-[12px] text-white/70">
                                            No eligible attachments.
                                        </div>
                                    )}
                                </div>
                            ) : null}
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
                        {displayedProperties.length > 0 ? (
                            displayedProperties.map((property) => (
                                <div key={`${property.name}-${property.value ?? ''}-${property.detail ?? ''}`} className="unit-detail-rule-row">
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
                        {displayedSystems.length > 0 ? (
                            displayedSystems.map((system) => (
                                <div key={`${system.name}-${system.value ?? ''}-${system.detail ?? ''}`} className="unit-detail-rule-row">
                                    <span className="min-w-0 font-medium text-neutral-900">
                                        <RuleWord category="systems" name={system.name} value={system.value} showValue={false} />
                                    </span>
                                    {system.detail ? <span className="unit-detail-rule-detail">{system.detail}</span> : null}
                                    {system.value != null ? <span className="unit-detail-rule-value">{system.value}</span> : null}
                                </div>
                            ))
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
                            {displayedWeapons.map(({ weapon, index }) => {
                                const weaponKey = `${unit.id}-${index}-${weapon.slot ?? 'base'}`
                                const selectedName = activeUnitConfig.hardpointSelections[index] ?? weapon.name
                                const options = weapon.slot && !weapon.hardpoint_locked
                                    ? (unit.hardpoint_options?.[weapon.slot] ?? []).filter((option) => option.name !== weapon.name)
                                    : []
                                const displayWeapon = options.find((option) => option.name === selectedName) ?? weapon
                                const isOpen = openHardpointKey === weaponKey
                                const displayArc = weapon.arc ?? displayWeapon.arc ?? '—'
                                const radioName = `slot-${selectedModelId ?? 'preview'}-${index}`
                                const isGeneratorSlot = weaponGeneratorSelection?.weaponIndex === index
                                const generatorChoices = canTakeGenerator && !weapon.hardpoint_locked ? getGeneratorChoices(unit, factionGenerators, weapon.slot, extraMagmaCastCost) : []
                                const canShowGeneratorSection = generatorChoices.length > 0 && (weaponGeneratorSelection == null || weaponGeneratorSelection.weaponIndex === index)
                                const showGeneratorRow = Boolean(weapon.slot) && isGeneratorSlot

                                if (showGeneratorRow && weaponGeneratorSelection) {
                                    return (
                                        <tr key={weaponKey} className="align-top unit-detail-weapon-row">
                                            <td className="rounded-l-lg px-2 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-neutral-900">{weaponGeneratorSelection.generatorName}</span>
                                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">+{weaponGeneratorSelection.generatorCost} pts</span>
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
                                                <div className="flex flex-wrap gap-1">
                                                    <span className="unit-detail-chip">
                                                        <RuleWord category="systems" name={weaponGeneratorSelection.generatorName} showValue={false} />
                                                    </span>
                                                    <span className="unit-detail-chip unit-detail-chip-cost">Generator</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                }

                                return (
                                    <tr key={weaponKey} className="align-top unit-detail-weapon-row">
                                        <td colSpan={isOpen ? 6 : undefined} className={`${isOpen ? 'rounded-lg' : 'rounded-l-lg'} px-2 py-2`}>
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
                                                        <div className="unit-detail-choice-menu">
                                                            <div className="unit-detail-choice-heading">Default</div>
                                                            <WeaponChoiceRow
                                                                label="Default"
                                                                weapon={weapon}
                                                                inheritedArc={weapon.arc}
                                                                checked={selectedName === weapon.name}
                                                                name={radioName}
                                                                onChange={() => {
                                                                    setHardpointSelection(index, weapon.name)
                                                                    setOpenHardpointKey(null)
                                                                    if (weaponGeneratorSelection?.weaponIndex === index) {
                                                                        setGeneratorSelection(null)
                                                                    }
                                                                }}
                                                            />
                                                            {options.length > 0 ? (
                                                                <>
                                                                    <div className="unit-detail-choice-heading mt-2">Hardpoint Alternatives</div>
                                                                    {options.map((option) => (
                                                                        <WeaponChoiceRow
                                                                            key={option.name}
                                                                            label="Alternative"
                                                                            weapon={option}
                                                                            inheritedArc={weapon.arc}
                                                                            checked={selectedName === option.name}
                                                                            name={radioName}
                                                                            onChange={() => {
                                                                                setHardpointSelection(index, option.name)
                                                                                setOpenHardpointKey(null)
                                                                                if (weaponGeneratorSelection?.weaponIndex === index) {
                                                                                    setGeneratorSelection(null)
                                                                                }
                                                                            }}
                                                                        />
                                                                    ))}
                                                                </>
                                                            ) : null}
                                                            {canShowGeneratorSection ? (
                                                                <>
                                                                    <div className="unit-detail-choice-heading mt-2">Generators</div>
                                                                    {generatorChoices.map((generator) => (
                                                                        <GeneratorChoiceRow
                                                                            key={generator.name}
                                                                            generator={generator}
                                                                            checked={weaponGeneratorSelection?.weaponIndex === index && weaponGeneratorSelection?.generatorName === generator.name}
                                                                            name={radioName}
                                                                            onChange={() => {
                                                                                setGeneratorSelection({ weaponIndex: index, generatorName: generator.name, generatorCost: generator.point_cost })
                                                                                setOpenHardpointKey(null)
                                                                            }}
                                                                        />
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
                                        {!isOpen ? (
                                            <>
                                                <td className="px-2 py-2 text-neutral-600">{displayArc}</td>
                                                <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.C)}</td>
                                                <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.S)}</td>
                                                <td className="px-2 py-2 text-neutral-600">{formatValue(displayWeapon.firepower.E)}</td>
                                                <td className="rounded-r-lg px-2 py-2 text-neutral-600">
                                                    <WeaponQualityChips qualities={displayWeapon.qualities} />
                                                </td>
                                            </>
                                        ) : null}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </section>

            {hasOptions || systemGeneratorChoices.length > 0 || (selectedEntry && availableFleetDoctrines.length > 0) ? (
                <section className="grid items-start gap-2 lg:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
                    {hasOptions || systemGeneratorChoices.length > 0 ? (
                        <div className="unit-detail-section unit-detail-panel-alt rounded-xl p-2.5 shadow-sm">
                            <div className="unit-detail-dark-title text-[11px] font-semibold uppercase tracking-[0.2em]">Options & Upgrades</div>
                            <div className="mt-2 space-y-1.5">
                                {Array.from({ length: systemGeneratorSlotCount }, (_, slotIndex) => {
                                    const selectedSystemGenerator = selectedSystemGenerators[slotIndex] ?? null
                                    return (
                                        <div key={`system-generator-${slotIndex}`} className="grid items-center gap-3 rounded-lg border border-white/80 bg-white/55 px-2.5 py-2 text-[var(--detail-ink)] md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_5rem]">
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-semibold text-neutral-900">Generator{systemGeneratorSlotCount > 1 ? ` ${slotIndex + 1}` : ''}</div>
                                            </div>
                                            <select
                                                className="w-full rounded-md border border-white/80 bg-white px-2 py-1.5 text-sm font-medium text-neutral-900 shadow-sm outline-none focus:border-[var(--navy)] md:w-56"
                                                value={selectedSystemGenerator?.generatorName ?? ''}
                                                onChange={(event) => {
                                                    const generator = systemGeneratorChoices.find((item) => item.name === event.target.value)
                                                    setSystemGeneratorSelection(slotIndex, generator ? {
                                                        weaponIndex: SYSTEM_GENERATOR_WEAPON_INDEX,
                                                        generatorName: generator.name,
                                                        generatorCost: generator.point_cost,
                                                    } : null)
                                                }}
                                            >
                                                <option value="">Select</option>
                                                {systemGeneratorChoices.map((generator) => (
                                                    <option key={generator.name} value={generator.name}>
                                                        {generator.name} (+{generator.point_cost})
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="text-left text-[11px] font-semibold text-[var(--navy)] md:text-right">
                                                {selectedSystemGenerator ? `${selectedSystemGenerator.generatorCost} pts` : '—'}
                                            </div>
                                        </div>
                                    )
                                })}
                                {availableOptions.map((option) => {
                                    const unitLevel = isUnitLevelOption(option.tag)
                                    const config = unitLevel && selectedEntry ? selectedEntry.config : activeUnitConfig
                                    const qty = config.optionQuantities[option.tag] ?? 0
                                    const max = unitLevel ? option.max : option.max ?? 1
                                    const canIncrease = max == null || qty < max
                                    const optionPoints = computeOptionPoints(option, qty, Boolean(unitLevel && selectedEntry && hasChitaSwarmEscortDiscount(selectedEntry, currentList ?? undefined)))
                                    const isGeneratorOption = option.tag === 'GENERATOR'
                                        || option.tag === 'TRIDENT_GENERATOR'
                                        || option.tag === 'GUARDIAN_GENERATOR'
                                        || option.tag === 'ADDITIONAL_GUARDIAN_GENERATOR'
                                        || option.tag === 'FREYA_ARRAY'
                                        || option.tag === 'MAGMA_CAST_GENERATOR'
                                        || option.tag === 'EMPIRE_FREE_GENERATOR'
                                        || option.tag === 'FREE_GENERATOR'
                                        || option.generator_replaces_weapon === false

                                    return (
                                        <div key={option.tag} className="grid items-center gap-3 rounded-lg border border-white/80 bg-white/55 px-2.5 py-2 text-[var(--detail-ink)] md:grid-cols-[minmax(0,1fr)_minmax(10rem,auto)_5rem]">
                                            <div className="min-w-0">
                                                <div className="text-[12px] font-semibold text-neutral-900">{formatOptionName(option)}</div>
                                                <div className="text-[11px] leading-tight text-[var(--detail-ink)]">{option.description}</div>
                                            </div>
                                            {isGeneratorOption ? (
                                                <div className="justify-self-start text-[11px] text-[var(--detail-ink)]/70 md:justify-self-end">—</div>
                                            ) : (
                                                <div className="flex items-center justify-start gap-2 md:justify-end">
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
                                                    <div className="w-16 text-[11px] text-[var(--detail-ink)]/75">{max != null ? `Max ${max}` : 'Unlimited'}</div>
                                                </div>
                                            )}
                                            <div className="text-left text-[11px] font-semibold text-[var(--navy)] md:text-right">
                                                {optionPoints == null ? '—' : `${optionPoints} pts`}
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
                                                            <RuleWord category="properties" name={property.name} value={property.value} detail={property.detail} />
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
                    glossary={glossary}
                    onClose={() => setOpenDoctrine(null)}
                />
            ) : null}
        </div>
    )
}
