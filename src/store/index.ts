import { create } from 'zustand'
import type {
    ArmyBattlefleet,
    ArmyList,
    ArmyModel,
    ArmyUnit,
    BattlefleetDefinition,
    Faction,
    FleetDoctrine,
    Generator,
    Glossary,
    Unit,
    UnitConfig,
} from '../types/index'
import { loadListsFromStorage, saveListsToStorage } from '../utils/localStorage'
import { isBattlefleetAvailableForFaction, isMercenaryInForce } from '../utils/battlefleets'
import { computeArmyUnitTotal, isUnitLevelOption, updateArmyUnitTotals, updateListUnit } from '../utils/pointsCalc'
import { canAttachToParent, getAttachmentModelLimitForUnit, getMinimumModelsForAttachment } from '../utils/attachments'
import { getSelectedTags } from '../utils/optionRuleEffects'
import { canSelectGeneratorInSlot, withWeaponGeneratorSelection } from '../utils/generatorRules'
import { normalizeSavedListsIndependently } from '../utils/listNormalization'
import { renameArmyListState } from '../utils/listNames'
import { duplicateArmyModel } from '../utils/modelHelpers'
import { normalizeGeneratorBackedOptionConfig } from '../utils/optionConfig'
import {
    clearOrbatModelMines,
    migrateOrbatConfig,
    normalizeLegacyFactionId,
    normalizeLegacyUnitId,
} from '../utils/storageMigration'
import { isUnitSelectable } from '../utils/unitHelpers'
import { uuid } from '../utils/uuid'

const emptyUnitConfig: UnitConfig = {
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities: {},
}
const TETHERED_BANGPAE_OPTION_TAG = 'TETHERED_BANGPAE'
const BANGPAE_UNIT_ID = 'empire_bangpae_explosive_automata'

interface AppStore {
    factions: Faction[]
    units: Unit[]
    glossary: Glossary | null
    generators: Record<string, Generator[]>
    fleetDoctrines: Record<string, FleetDoctrine[]>
    battlefleetDefinitions: BattlefleetDefinition[]
    dataLoaded: boolean
    dataLoading: boolean
    dataError: string | null
    loadData: () => Promise<void>

    selectedFactionId: string | null
    setSelectedFactionId: (id: string | null) => void

    searchQuery: string
    setSearchQuery: (q: string) => void
    selectedRoles: string[]
    toggleRoleFilter: (role: string) => void

    selectedUnitId: string | null
    setSelectedUnitId: (id: string | null) => void
    selectedListInstanceId: string | null
    setSelectedListInstanceId: (id: string | null) => void
    selectedBattlefleetInstanceId: string | null
    selectBattlefleet: (instanceId: string | null) => void
    selectedListGlossary: boolean
    selectListGlossary: () => void
    selectedModelId: string | null

    currentList: ArmyList | null
    savedLists: ArmyList[]
    activeUnitConfig: UnitConfig

    createList: (name: string, factionId: string) => void
    openList: (listId: string) => void
    closeList: () => void
    deleteList: (listId: string) => void
    importList: (list: ArmyList) => void
    renameList: (listId: string, newName: string) => void
    persistLists: () => void

    addUnitToCurrentList: (unitId: string, battlefleetInstanceId?: string | null) => void
    addAttachmentToListUnit: (parentInstanceId: string, unitId: string) => void
    removeUnitFromList: (instanceId: string) => void
    addBattlefleetToCurrentList: (definitionId: string) => void
    removeBattlefleetFromCurrentList: (battlefleetInstanceId: string) => void
    setUnitBattlefleet: (instanceId: string, battlefleetInstanceId: string | null) => void
    renameBattlefleet: (battlefleetInstanceId: string, customName: string) => void
    renameListUnit: (instanceId: string, customName: string) => void
    renameModel: (instanceId: string, modelId: string, customName: string) => void
    selectListUnit: (instanceId: string) => void
    selectModel: (modelId: string) => void
    duplicateSelectedModel: (instanceId: string) => void
    removeModelFromListUnit: (instanceId: string, modelId: string) => void

    setHardpointSelection: (weaponIndex: number, weaponName: string) => void
    setGeneratorSelection: (selection: UnitConfig['generatorSelection']) => void
    setSystemGeneratorSelection: (slotIndex: number, selection: UnitConfig['generatorSelection']) => void
    setGeneratorMountedWeapon: (selectionIndex: number, weaponName: string) => void
    setFleetDoctrineSelection: (selection: UnitConfig['fleetDoctrineSelection']) => void
    setOptionQuantity: (tag: string, quantity: number) => void
}

function cloneConfig(config: UnitConfig): UnitConfig {
    return structuredClone(config)
}

function normalizeConfig(config: Partial<UnitConfig> | null | undefined): UnitConfig {
    return {
        ...cloneConfig(emptyUnitConfig),
        ...config,
        hardpointSelections: config?.hardpointSelections ?? {},
        generatorSelection: config?.generatorSelection ?? null,
        generatorSelections: config?.generatorSelections,
        fleetDoctrineSelection: config?.fleetDoctrineSelection ?? null,
        optionQuantities: config?.optionQuantities ?? {},
    }
}

function updateOptionQuantitiesForSelection(
    unit: Unit,
    config: UnitConfig,
    tag: string,
    quantity: number,
): UnitConfig['optionQuantities'] {
    const nextQuantity = Math.max(0, quantity)
    const selectedOption = unit.options_and_upgrades.find((option) => option.tag === tag)
    const optionQuantities = {
        ...config.optionQuantities,
        [tag]: nextQuantity,
    }

    if (nextQuantity > 0 && selectedOption?.exclusive_group) {
        for (const option of unit.options_and_upgrades) {
            if (option.tag !== tag && option.exclusive_group === selectedOption.exclusive_group) {
                optionQuantities[option.tag] = 0
            }
        }
    }

    return optionQuantities
}

function getMinimumModels(unit: Unit): number {
    return Math.max(1, unit.min ?? (typeof unit.models === 'number' ? unit.models : 1))
}

function getMaximumModels(unit: Unit): number {
    return Math.max(
        getMinimumModels(unit),
        unit.max ?? (typeof unit.models === 'number' ? unit.models : getMinimumModels(unit)),
    )
}

function makeModel(config: UnitConfig = emptyUnitConfig): ArmyModel {
    return {
        modelId: uuid(),
        config: cloneConfig(config),
    }
}

function makeModels(unit: Unit, firstConfig: UnitConfig = emptyUnitConfig): ArmyModel[] {
    const modelCount = getMinimumModels(unit)
    return Array.from({ length: modelCount }, (_, index) => makeModel(index === 0 ? firstConfig : emptyUnitConfig))
}

function makeArmyUnit(
    unit: Unit,
    config: UnitConfig = emptyUnitConfig,
    battlefleetInstanceId: string | null = null,
    list?: ArmyList,
): ArmyUnit {
    const entry: ArmyUnit = {
        instanceId: uuid(),
        unitId: unit.id,
        battlefleetInstanceId,
        config: {
            ...cloneConfig(emptyUnitConfig),
            optionQuantities: Object.fromEntries(
                Object.entries(config.optionQuantities).filter(([tag]) => isUnitLevelOption(tag)),
            ),
        },
        models: makeModels(unit, config),
        totalPoints: 0,
    }
    entry.totalPoints = computeArmyUnitTotal(entry, [unit], list)
    return entry
}

function getTetheredBangpaeModelCount(entry: ArmyUnit): number {
    return entry.models.reduce(
        (sum, model) => sum + (model.config.optionQuantities[TETHERED_BANGPAE_OPTION_TAG] ?? 0),
        0,
    )
}

function isGeneratedTetheredBangpae(entry: ArmyUnit, parentInstanceId: string): boolean {
    return (
        entry.generatedByOption?.parentInstanceId === parentInstanceId &&
        entry.generatedByOption.optionTag === TETHERED_BANGPAE_OPTION_TAG &&
        entry.unitId === BANGPAE_UNIT_ID
    )
}

function makeGeneratedTetheredBangpae(
    parent: ArmyUnit,
    bangpaeUnit: Unit,
    modelCount: number,
    existing: ArmyUnit | undefined,
    units: Unit[],
    list: ArmyList,
): ArmyUnit {
    const models = (existing?.models ?? []).slice(0, modelCount)
    while (models.length < modelCount) {
        models.push(makeModel())
    }

    const generated: ArmyUnit = {
        instanceId: existing?.instanceId ?? uuid(),
        unitId: bangpaeUnit.id,
        customName: 'Tethered Bangpae',
        battlefleetInstanceId: parent.battlefleetInstanceId ?? null,
        config: cloneConfig(emptyUnitConfig),
        models,
        totalPoints: 0,
        generatedByOption: {
            parentInstanceId: parent.instanceId,
            optionTag: TETHERED_BANGPAE_OPTION_TAG,
        },
    }
    generated.totalPoints = computeArmyUnitTotal(generated, units, list)
    return generated
}

function syncGeneratedOptionAttachments(entry: ArmyUnit, units: Unit[], list: ArmyList): ArmyUnit {
    const bangpaeUnit = units.find((unit) => unit.id === BANGPAE_UNIT_ID)
    const generatedBangpae = (entry.attachedUnits ?? []).find((attachment) =>
        isGeneratedTetheredBangpae(attachment, entry.instanceId),
    )
    const normalAttachments = (entry.attachedUnits ?? [])
        .filter((attachment) => !isGeneratedTetheredBangpae(attachment, entry.instanceId))
        .map((attachment) => syncGeneratedOptionAttachments(attachment, units, list))
    const tetheredBangpaeCount = getTetheredBangpaeModelCount(entry)
    const attachedUnits =
        bangpaeUnit && tetheredBangpaeCount > 0
            ? [
                  ...normalAttachments,
                  makeGeneratedTetheredBangpae(entry, bangpaeUnit, tetheredBangpaeCount, generatedBangpae, units, list),
              ]
            : normalAttachments
    const updated = {
        ...entry,
        attachedUnits: attachedUnits.length > 0 ? attachedUnits : undefined,
    }

    return {
        ...updated,
        totalPoints: computeArmyUnitTotal(updated, units, list),
    }
}

function syncListGeneratedOptionAttachments(list: ArmyList, units: Unit[]): ArmyList {
    const updated = {
        ...list,
        units: list.units.map((entry) => syncGeneratedOptionAttachments(entry, units, list)),
    }
    return {
        ...updated,
        units: updateArmyUnitTotals(updated.units, units, updated),
    }
}

function makeBattlefleet(
    definition: BattlefleetDefinition,
    existingBattlefleets: ArmyBattlefleet[] = [],
): ArmyBattlefleet {
    const existingCount = existingBattlefleets.filter(
        (battlefleet) => battlefleet.definitionId === definition.id,
    ).length
    return {
        instanceId: uuid(),
        definitionId: definition.id,
        name: existingCount === 0 ? definition.name : `${definition.name} ${existingCount + 1}`,
    }
}

function makeDefaultBattlefleets(factionId: string, definitions: BattlefleetDefinition[]): ArmyBattlefleet[] {
    const defaultDefinition =
        definitions.find(
            (definition) => definition.faction_id === factionId && definition.type === 'main' && !definition.legendary,
        ) ?? definitions.find((definition) => definition.faction_id === factionId && definition.type === 'main')
    return defaultDefinition ? [makeBattlefleet(defaultDefinition)] : []
}

function countAttachedModels(entries: ArmyUnit[], unitId: string): number {
    return entries.reduce((sum, entry) => sum + (entry.unitId === unitId ? entry.models.length : 0), 0)
}

function normalizeArmyUnit(entry: ArmyUnit, units: Unit[], asAttachment = false): ArmyUnit | null {
    const unitId = normalizeLegacyUnitId(entry.unitId)
    const unit = units.find((item) => item.id === unitId)
    if (!unit) return null
    const legacy = entry as ArmyUnit & {
        hardpoints?: { slot: string; weaponName: string }[]
        options?: { tag: string; quantity: number }[]
        generator?: Generator | null
    }
    const config = migrateOrbatConfig(
        entry.unitId,
        normalizeGeneratorBackedOptionConfig(
            unit,
            normalizeConfig(
                entry.config ?? {
                    hardpointSelections: {},
                    generatorSelection: legacy.generator
                        ? {
                              weaponIndex: 0,
                              generatorName: legacy.generator.name,
                              generatorCost: legacy.generator.point_cost,
                          }
                        : null,
                    fleetDoctrineSelection: null,
                    optionQuantities: Object.fromEntries(
                        (legacy.options ?? []).map((option) => [option.tag, option.quantity]),
                    ),
                },
            ),
        ),
    )
    const minimumModels =
        asAttachment && !entry.generatedByOption ? getMinimumModelsForAttachment(unit) : getMinimumModels(unit)
    const legacyModels = (entry as ArmyUnit & { models?: ArmyModel[] }).models
    const models =
        Array.isArray(legacyModels) && legacyModels.length > 0
            ? legacyModels
                  .map((model) => ({
                      modelId: model.modelId ?? uuid(),
                      customName: model.customName?.trim() || undefined,
                      config: migrateOrbatConfig(
                          entry.unitId,
                          normalizeGeneratorBackedOptionConfig(unit, normalizeConfig(model.config)),
                      ),
                  }))
                  .slice(0, getMaximumModels(unit))
            : makeModels(unit, config).slice(0, minimumModels)
    while (models.length < minimumModels) {
        models.push(makeModel())
    }
    const normalized: ArmyUnit = {
        instanceId: entry.instanceId,
        unitId,
        customName: entry.customName?.trim() || undefined,
        config: migrateOrbatConfig(
            entry.unitId,
            config,
            models.map((model) => model.config),
        ),
        models: models.map((model) => ({ ...model, config: clearOrbatModelMines(entry.unitId, model.config) })),
        totalPoints: 0,
        attachedUnits: entry.attachedUnits?.flatMap((attachment) => {
            const normalizedAttachment = normalizeArmyUnit(attachment, units, true)
            return normalizedAttachment ? [normalizedAttachment] : []
        }),
        battlefleetInstanceId: typeof entry.battlefleetInstanceId === 'string' ? entry.battlefleetInstanceId : null,
        generatedByOption:
            entry.generatedByOption &&
            typeof entry.generatedByOption.parentInstanceId === 'string' &&
            typeof entry.generatedByOption.optionTag === 'string'
                ? entry.generatedByOption
                : undefined,
    }
    normalized.totalPoints = computeArmyUnitTotal(normalized, units)
    return normalized
}

function normalizeBattlefleets(list: ArmyList, definitions: BattlefleetDefinition[]): ArmyBattlefleet[] {
    const factionId = normalizeLegacyFactionId(list.faction_id)
    const validDefinitionIds = new Set(
        definitions
            .filter((definition) => isBattlefleetAvailableForFaction(definition, factionId))
            .map((definition) => definition.id),
    )
    return (list.battlefleets ?? []).flatMap((battlefleet) => {
        if (!validDefinitionIds.has(battlefleet.definitionId)) return []
        return [
            {
                instanceId: battlefleet.instanceId ?? uuid(),
                definitionId: battlefleet.definitionId,
                name:
                    battlefleet.name ||
                    definitions.find((definition) => definition.id === battlefleet.definitionId)?.name ||
                    battlefleet.definitionId,
                customName: battlefleet.customName?.trim() || undefined,
            },
        ]
    })
}

function isUnitIndexManifest(value: unknown): value is { files: string[] } {
    return (
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as { files?: unknown }).files) &&
        (value as { files: unknown[] }).files.every((file) => typeof file === 'string')
    )
}

async function loadUnitsFromIndex(unitsIndex: unknown): Promise<Unit[]> {
    if (Array.isArray(unitsIndex)) return unitsIndex as Unit[]
    if (!isUnitIndexManifest(unitsIndex)) return []

    const groups = await Promise.all(unitsIndex.files.map((file) => fetchBuilderData<Unit[]>(file)))
    return groups.flat()
}

async function fetchBuilderData<T>(path: string): Promise<T> {
    const response = await fetch(`/data/${path}`)
    if (!response.ok) {
        throw new Error(`Could not load builder data: ${path}`)
    }
    return response.json() as Promise<T>
}

function normalizeLists(lists: ArmyList[], units: Unit[], definitions: BattlefleetDefinition[]): ArmyList[] {
    return normalizeSavedListsIndependently(
        lists.map((list) => ({ ...list, faction_id: normalizeLegacyFactionId(list.faction_id) })),
        (list) => {
            const normalizedList = {
                ...list,
                battlefleets: normalizeBattlefleets(list, definitions),
                units: list.units.flatMap((entry) => {
                    const normalizedEntry = normalizeArmyUnit(entry, units)
                    return normalizedEntry ? [normalizedEntry] : []
                }),
            }
            return {
                ...syncListGeneratedOptionAttachments(normalizedList, units),
            }
        },
    )
}

function recalculateListUnitTotals(list: ArmyList, units: Unit[]): ArmyList {
    return syncListGeneratedOptionAttachments(
        {
            ...list,
            units: updateArmyUnitTotals(list.units, units, list),
        },
        units,
    )
}

function findArmyUnit(entries: ArmyUnit[], instanceId: string): ArmyUnit | null {
    for (const entry of entries) {
        if (entry.instanceId === instanceId) return entry
        const nested = findArmyUnit(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

function findParentOfAttachment(entries: ArmyUnit[], instanceId: string): ArmyUnit | null {
    for (const entry of entries) {
        if ((entry.attachedUnits ?? []).some((attachment) => attachment.instanceId === instanceId)) return entry
        const nested = findParentOfAttachment(entry.attachedUnits ?? [], instanceId)
        if (nested) return nested
    }
    return null
}

function setEntryBattlefleet(entry: ArmyUnit, battlefleetInstanceId: string | null): ArmyUnit {
    return {
        ...entry,
        battlefleetInstanceId,
        attachedUnits: entry.attachedUnits?.map((attachment) => setEntryBattlefleet(attachment, battlefleetInstanceId)),
    }
}

function clearEntryBattlefleet(entry: ArmyUnit, battlefleetInstanceId: string): ArmyUnit {
    return {
        ...entry,
        battlefleetInstanceId:
            entry.battlefleetInstanceId === battlefleetInstanceId ? null : entry.battlefleetInstanceId,
        attachedUnits: entry.attachedUnits?.map((attachment) =>
            clearEntryBattlefleet(attachment, battlefleetInstanceId),
        ),
    }
}

function removeArmyUnit(entries: ArmyUnit[], instanceId: string, units: Unit[], list: ArmyList): ArmyUnit[] {
    return entries
        .filter((entry) => entry.instanceId !== instanceId)
        .map((entry) => {
            const updated = {
                ...entry,
                attachedUnits: removeArmyUnit(entry.attachedUnits ?? [], instanceId, units, list),
            }
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units, list),
            }
        })
}

function attachArmyUnit(
    entries: ArmyUnit[],
    parentInstanceId: string,
    attachment: ArmyUnit,
    units: Unit[],
    list: ArmyList,
): ArmyUnit[] {
    return entries.map((entry) => {
        if (entry.instanceId === parentInstanceId) {
            const updated = {
                ...entry,
                attachedUnits: [...(entry.attachedUnits ?? []), attachment],
            }
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units, list),
            }
        }
        const updated = {
            ...entry,
            attachedUnits: attachArmyUnit(entry.attachedUnits ?? [], parentInstanceId, attachment, units, list),
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, units, list),
        }
    })
}

function updateArmyUnitModels(
    entries: ArmyUnit[],
    instanceId: string,
    units: Unit[],
    list: ArmyList,
    updater: (entry: ArmyUnit, unit: Unit) => ArmyUnit,
): ArmyUnit[] {
    return entries.map((entry) => {
        const unit = units.find((item) => item.id === entry.unitId)
        if (entry.instanceId === instanceId && unit) {
            const updated = updater(entry, unit)
            return {
                ...updated,
                totalPoints: computeArmyUnitTotal(updated, units, list),
            }
        }
        const updated = {
            ...entry,
            attachedUnits: updateArmyUnitModels(entry.attachedUnits ?? [], instanceId, units, list, updater),
        }
        return {
            ...updated,
            totalPoints: computeArmyUnitTotal(updated, units, list),
        }
    })
}

export const useAppStore = create<AppStore>((set, get) => ({
    factions: [],
    units: [],
    glossary: null,
    generators: {},
    fleetDoctrines: {},
    battlefleetDefinitions: [],
    dataLoaded: false,
    dataLoading: false,
    dataError: null,
    loadData: async () => {
        const state = get()
        if (state.dataLoading || (state.dataLoaded && !state.dataError)) return
        set({ dataLoading: true, dataLoaded: false, dataError: null })

        try {
            const [factions, glossary, generators, fleetDoctrines, battlefleetDefinitions, units] = await Promise.all([
                fetchBuilderData<Faction[]>('factions.json'),
                fetchBuilderData<Glossary>('glossary.json'),
                fetchBuilderData<Record<string, Generator[]>>('generators.json'),
                fetchBuilderData<Record<string, FleetDoctrine[]>>('fleet-doctrines.json'),
                fetchBuilderData<BattlefleetDefinition[]>('battlefleets.json'),
                fetchBuilderData<unknown>('units-index.json').then(loadUnitsFromIndex),
            ])
            const savedLists = normalizeLists(loadListsFromStorage(), units, battlefleetDefinitions)
            set({
                factions,
                glossary,
                generators,
                fleetDoctrines,
                battlefleetDefinitions,
                units,
                dataLoaded: true,
                dataLoading: false,
                dataError: null,
                savedLists,
            })
        } catch (error) {
            console.error('Could not load builder data.', error)
            set({
                dataLoaded: true,
                dataLoading: false,
                dataError: error instanceof Error ? error.message : 'Could not load builder data.',
                savedLists: loadListsFromStorage(),
            })
        }
    },

    selectedFactionId: null,
    setSelectedFactionId: (id) =>
        set({
            selectedFactionId: id,
            searchQuery: '',
            selectedRoles: [],
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
        }),

    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    selectedRoles: [],
    toggleRoleFilter: (role) =>
        set((state) => ({
            selectedRoles: state.selectedRoles.includes(role)
                ? state.selectedRoles.filter((item) => item !== role)
                : [...state.selectedRoles, role],
        })),

    selectedUnitId: null,
    setSelectedUnitId: (id) =>
        set({
            selectedUnitId: id,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }),
    selectedListInstanceId: null,
    setSelectedListInstanceId: (id) => set({ selectedListInstanceId: id, selectedListGlossary: false }),
    selectedBattlefleetInstanceId: null,
    selectBattlefleet: (instanceId) =>
        set({
            selectedBattlefleetInstanceId: instanceId,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }),
    selectedListGlossary: false,
    selectListGlossary: () =>
        set({
            selectedListGlossary: true,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }),
    selectedModelId: null,

    currentList: null,
    savedLists: [],
    activeUnitConfig: emptyUnitConfig,

    createList: (name, factionId) => {
        const now = new Date().toISOString()
        const battlefleets = makeDefaultBattlefleets(factionId, get().battlefleetDefinitions)
        const newList: ArmyList = {
            id: uuid(),
            name,
            faction_id: factionId,
            battlefleets,
            units: [],
            createdAt: now,
            updatedAt: now,
        }
        set((state) => ({
            savedLists: [...state.savedLists, newList],
            currentList: newList,
            selectedFactionId: factionId,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }))
        get().persistLists()
    },
    openList: (listId) => {
        const target = get().savedLists.find((list) => list.id === listId)
        if (!target) return
        set({
            currentList: structuredClone(target),
            selectedFactionId: target.faction_id,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        })
    },
    closeList: () => {
        get().persistLists()
        set({
            currentList: null,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        })
    },
    deleteList: (listId) => {
        const currentList = get().currentList
        const deletingCurrentList = currentList?.id === listId
        set((state) => ({
            savedLists: state.savedLists.filter((list) => list.id !== listId),
            currentList: deletingCurrentList ? null : currentList,
            selectedUnitId: deletingCurrentList ? null : state.selectedUnitId,
            selectedListInstanceId: deletingCurrentList ? null : state.selectedListInstanceId,
            selectedBattlefleetInstanceId: deletingCurrentList ? null : state.selectedBattlefleetInstanceId,
            selectedListGlossary: deletingCurrentList ? false : state.selectedListGlossary,
            selectedModelId: deletingCurrentList ? null : state.selectedModelId,
            activeUnitConfig: deletingCurrentList ? cloneConfig(emptyUnitConfig) : state.activeUnitConfig,
        }))
        get().persistLists()
    },
    importList: (list) => {
        set((state) => ({
            savedLists: [...state.savedLists.filter((item) => item.id !== list.id), list],
            currentList: list,
            selectedFactionId: list.faction_id,
            selectedUnitId: null,
            selectedListInstanceId: null,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: null,
            activeUnitConfig: cloneConfig(emptyUnitConfig),
        }))
        get().persistLists()
    },
    renameList: (listId, newName) => {
        const trimmed = newName.trim()
        if (!trimmed) return
        set((state) => renameArmyListState(state, listId, trimmed, new Date().toISOString()))
        get().persistLists()
    },
    persistLists: () => {
        const { savedLists, currentList } = get()
        const lists = currentList
            ? savedLists.map((list) => (list.id === currentList.id ? currentList : list))
            : savedLists
        saveListsToStorage(lists)
        set({ savedLists: lists })
    },

    addUnitToCurrentList: (unitId, battlefleetInstanceId) => {
        const state = get()
        if (!state.currentList) return
        const unit = state.units.find((item) => item.id === unitId)
        if (!unit || !isUnitSelectable(unit)) return
        const battlefleetExists =
            battlefleetInstanceId == null ||
            (state.currentList.battlefleets ?? []).some(
                (battlefleet) => battlefleet.instanceId === battlefleetInstanceId,
            )
        if (battlefleetInstanceId !== undefined && !battlefleetExists) return
        const config = unitId === state.selectedUnitId ? state.activeUnitConfig : emptyUnitConfig
        const onlyBattlefleet = state.currentList.battlefleets?.length === 1 ? state.currentList.battlefleets[0] : null
        const targetBattlefleetInstanceId =
            battlefleetInstanceId === undefined ? (onlyBattlefleet?.instanceId ?? null) : battlefleetInstanceId
        const newEntry = makeArmyUnit(unit, config, targetBattlefleetInstanceId, state.currentList)
        const currentList = syncListGeneratedOptionAttachments(
            {
                ...state.currentList,
                units: [...state.currentList.units, newEntry],
                updatedAt: new Date().toISOString(),
            },
            state.units,
        )
        set({
            currentList,
        })
        get().persistLists()
    },
    addAttachmentToListUnit: (parentInstanceId, unitId) => {
        const state = get()
        if (!state.currentList) return
        const unit = state.units.find((item) => item.id === unitId)
        if (!unit || !isUnitSelectable(unit)) return
        const parent = findArmyUnit(state.currentList.units, parentInstanceId)
        if (!parent) return
        if (findParentOfAttachment(state.currentList.units, parentInstanceId)) return
        const parentUnit = state.units.find((item) => item.id === parent.unitId)
        const parentModelConfig = parent.models[0]?.config ?? parent.config
        const parentTags = parentUnit ? getSelectedTags(parentUnit, parentModelConfig, parent.config) : []
        let config = unitId === state.selectedUnitId ? state.activeUnitConfig : emptyUnitConfig
        if (unit.attachment?.parent_traits.includes('Subfaction')) {
            const option = unit.options_and_upgrades.find(
                (candidate) =>
                    candidate.mandatory &&
                    candidate.exclusive_group?.endsWith('_SUBFACTION') &&
                    candidate.adds_tags?.some((tag) => parentTags.includes(tag)),
            )
            if (!option) return
            config = {
                ...config,
                optionQuantities: updateOptionQuantitiesForSelection(unit, config, option.tag, 1),
            }
        }
        const attachmentTags = getSelectedTags(unit, config, config)
        if (!parentUnit || !canAttachToParent(unit, parentUnit, { attachmentTags, parentTags })) return
        if ((parent.attachedUnits ?? []).some((attachment) => !attachment.generatedByOption)) return
        const usedModels = countAttachedModels(parent.attachedUnits ?? [], unitId)
        const remainingModels = getAttachmentModelLimitForUnit(unit) - usedModels
        if (remainingModels < getMinimumModelsForAttachment(unit)) return
        const attachment = makeArmyUnit(unit, config, parent.battlefleetInstanceId ?? null, state.currentList)
        attachment.models = attachment.models.slice(0, remainingModels)
        attachment.totalPoints = computeArmyUnitTotal(attachment, state.units, state.currentList)
        set({
            currentList: {
                ...state.currentList,
                units: attachArmyUnit(
                    state.currentList.units,
                    parentInstanceId,
                    attachment,
                    state.units,
                    state.currentList,
                ),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    addBattlefleetToCurrentList: (definitionId) => {
        const state = get()
        if (!state.currentList) return
        const definition = state.battlefleetDefinitions.find(
            (item) => item.id === definitionId && isBattlefleetAvailableForFaction(item, state.currentList?.faction_id),
        )
        if (!definition) return
        const battlefleets = [...(state.currentList.battlefleets ?? [])]
        if (definition.legendary && battlefleets.some((battlefleet) => battlefleet.definitionId === definition.id))
            return
        if (isMercenaryInForce(definition, state.currentList.faction_id)) {
            const alreadyHasMercenary = battlefleets.some((battlefleet) => {
                const existingDefinition = state.battlefleetDefinitions.find(
                    (item) => item.id === battlefleet.definitionId,
                )
                return existingDefinition
                    ? isMercenaryInForce(existingDefinition, state.currentList?.faction_id)
                    : false
            })
            if (alreadyHasMercenary) return
        }
        const newBattlefleet = makeBattlefleet(definition, battlefleets)
        set({
            currentList: {
                ...state.currentList,
                battlefleets: [...battlefleets, newBattlefleet],
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    removeBattlefleetFromCurrentList: (battlefleetInstanceId) => {
        const state = get()
        if (!state.currentList) return
        const updatedList = recalculateListUnitTotals(
            {
                ...state.currentList,
                battlefleets: (state.currentList.battlefleets ?? []).filter(
                    (battlefleet) => battlefleet.instanceId !== battlefleetInstanceId,
                ),
                units: state.currentList.units.map((entry) => clearEntryBattlefleet(entry, battlefleetInstanceId)),
                updatedAt: new Date().toISOString(),
            },
            state.units,
        )
        set({
            currentList: updatedList,
            selectedBattlefleetInstanceId:
                state.selectedBattlefleetInstanceId === battlefleetInstanceId
                    ? null
                    : state.selectedBattlefleetInstanceId,
            selectedListGlossary: false,
        })
        get().persistLists()
    },
    setUnitBattlefleet: (instanceId, battlefleetInstanceId) => {
        const state = get()
        if (!state.currentList) return
        const battlefleetExists =
            battlefleetInstanceId == null ||
            (state.currentList.battlefleets ?? []).some(
                (battlefleet) => battlefleet.instanceId === battlefleetInstanceId,
            )
        if (!battlefleetExists) return
        set({
            currentList: {
                ...state.currentList,
                units: updateArmyUnitModels(
                    state.currentList.units,
                    instanceId,
                    state.units,
                    state.currentList,
                    (entry) => ({
                        ...setEntryBattlefleet(entry, battlefleetInstanceId),
                    }),
                ),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    renameBattlefleet: (battlefleetInstanceId, customName) => {
        const state = get()
        if (!state.currentList) return
        const trimmed = customName.trim()
        set({
            currentList: {
                ...state.currentList,
                battlefleets: (state.currentList.battlefleets ?? []).map((battlefleet) =>
                    battlefleet.instanceId === battlefleetInstanceId
                        ? { ...battlefleet, customName: trimmed || undefined }
                        : battlefleet,
                ),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    renameListUnit: (instanceId, customName) => {
        const state = get()
        if (!state.currentList) return
        const trimmed = customName.trim()
        set({
            currentList: {
                ...state.currentList,
                units: updateArmyUnitModels(
                    state.currentList.units,
                    instanceId,
                    state.units,
                    state.currentList,
                    (entry) => ({
                        ...entry,
                        customName: trimmed || undefined,
                    }),
                ),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    renameModel: (instanceId, modelId, customName) => {
        const state = get()
        if (!state.currentList) return
        const trimmed = customName.trim()
        set({
            currentList: {
                ...state.currentList,
                units: updateArmyUnitModels(
                    state.currentList.units,
                    instanceId,
                    state.units,
                    state.currentList,
                    (entry) => ({
                        ...entry,
                        models: entry.models.map((model) =>
                            model.modelId === modelId ? { ...model, customName: trimmed || undefined } : model,
                        ),
                    }),
                ),
                updatedAt: new Date().toISOString(),
            },
        })
        get().persistLists()
    },
    removeUnitFromList: (instanceId) => {
        const currentList = get().currentList
        if (!currentList) return
        set({
            currentList: {
                ...currentList,
                units: removeArmyUnit(currentList.units, instanceId, get().units, currentList),
                updatedAt: new Date().toISOString(),
            },
            selectedListInstanceId: get().selectedListInstanceId === instanceId ? null : get().selectedListInstanceId,
            selectedBattlefleetInstanceId:
                get().selectedListInstanceId === instanceId ? null : get().selectedBattlefleetInstanceId,
            selectedListGlossary: false,
            selectedModelId: get().selectedListInstanceId === instanceId ? null : get().selectedModelId,
        })
        get().persistLists()
    },
    selectListUnit: (instanceId) => {
        const state = get()
        const entry = state.currentList ? findArmyUnit(state.currentList.units, instanceId) : null
        if (!entry) return
        const selectedModel = entry.models[0] ?? makeModel(entry.config)
        set({
            selectedUnitId: entry.unitId,
            selectedListInstanceId: instanceId,
            selectedBattlefleetInstanceId: null,
            selectedListGlossary: false,
            selectedModelId: selectedModel.modelId,
            activeUnitConfig: cloneConfig(selectedModel.config),
        })
    },
    selectModel: (modelId) => {
        const state = get()
        const entry =
            state.currentList && state.selectedListInstanceId
                ? findArmyUnit(state.currentList.units, state.selectedListInstanceId)
                : null
        const model = entry?.models.find((item) => item.modelId === modelId)
        if (!model) return
        set({ selectedModelId: modelId, activeUnitConfig: cloneConfig(model.config) })
    },
    duplicateSelectedModel: (instanceId) => {
        const state = get()
        if (!state.currentList) return
        const entry = findArmyUnit(state.currentList.units, instanceId)
        const unit = entry ? state.units.find((item) => item.id === entry.unitId) : null
        const selectedModel = entry?.models.find((model) => model.modelId === state.selectedModelId)
        if (!entry || !unit || !selectedModel) return
        const parent = findParentOfAttachment(state.currentList.units, instanceId)
        const siblingModels = parent
            ? (parent.attachedUnits ?? [])
                  .filter((attachment) => attachment.unitId === unit.id && attachment.instanceId !== instanceId)
                  .reduce((sum, attachment) => sum + attachment.models.length, 0)
            : 0
        const maxModels = parent ? getAttachmentModelLimitForUnit(unit) - siblingModels : getMaximumModels(unit)
        if (entry.models.length >= maxModels) return
        const newModel = duplicateArmyModel(selectedModel, uuid())
        const currentList = syncListGeneratedOptionAttachments(
            {
                ...state.currentList,
                units: updateArmyUnitModels(
                    state.currentList.units,
                    instanceId,
                    state.units,
                    state.currentList,
                    (target) => ({
                        ...target,
                        models: [...target.models, newModel],
                    }),
                ),
                updatedAt: new Date().toISOString(),
            },
            state.units,
        )
        set({
            currentList,
            selectedModelId: newModel.modelId,
            activeUnitConfig: cloneConfig(newModel.config),
        })
        get().persistLists()
    },
    removeModelFromListUnit: (instanceId, modelId) => {
        const state = get()
        if (!state.currentList) return
        const entry = findArmyUnit(state.currentList.units, instanceId)
        const unit = entry ? state.units.find((item) => item.id === entry.unitId) : null
        if (!entry || !unit) return
        const minModels = findParentOfAttachment(state.currentList.units, instanceId)
            ? getMinimumModelsForAttachment(unit)
            : getMinimumModels(unit)
        if (entry.models.length <= minModels) return
        const nextModels = entry.models.filter((model) => model.modelId !== modelId)
        const selectedModel = nextModels[0] ?? null
        const currentList = syncListGeneratedOptionAttachments(
            {
                ...state.currentList,
                units: updateArmyUnitModels(
                    state.currentList.units,
                    instanceId,
                    state.units,
                    state.currentList,
                    (target) => ({
                        ...target,
                        models: target.models.filter((model) => model.modelId !== modelId),
                    }),
                ),
                updatedAt: new Date().toISOString(),
            },
            state.units,
        )
        set({
            currentList,
            selectedModelId:
                state.selectedModelId === modelId ? (selectedModel?.modelId ?? null) : state.selectedModelId,
            activeUnitConfig:
                state.selectedModelId === modelId && selectedModel
                    ? cloneConfig(selectedModel.config)
                    : state.activeUnitConfig,
        })
        get().persistLists()
    },

    setHardpointSelection: (weaponIndex, weaponName) => {
        set((state) => {
            const newConfig = {
                ...state.activeUnitConfig,
                hardpointSelections: {
                    ...state.activeUnitConfig.hardpointSelections,
                    [weaponIndex]: weaponName,
                },
                generatorSelection:
                    state.activeUnitConfig.generatorSelection?.weaponIndex === weaponIndex
                        ? null
                        : state.activeUnitConfig.generatorSelection,
                generatorSelections: state.activeUnitConfig.generatorSelections?.filter(
                    (selection) => selection.weaponIndex !== weaponIndex,
                ),
            }
            return {
                activeUnitConfig: newConfig,
                currentList:
                    state.selectedListInstanceId && state.currentList
                        ? updateListUnit(
                              state.currentList,
                              state.selectedListInstanceId,
                              newConfig,
                              state.units,
                              state.selectedModelId ?? undefined,
                          )
                        : state.currentList,
            }
        })
        get().persistLists()
    },
    setGeneratorSelection: (selection) => {
        set((state) => {
            const newConfig = withWeaponGeneratorSelection(state.activeUnitConfig, selection)
            return {
                activeUnitConfig: newConfig,
                currentList:
                    state.selectedListInstanceId && state.currentList
                        ? updateListUnit(
                              state.currentList,
                              state.selectedListInstanceId,
                              newConfig,
                              state.units,
                              state.selectedModelId ?? undefined,
                          )
                        : state.currentList,
            }
        })
        get().persistLists()
    },
    setSystemGeneratorSelection: (slotIndex, selection) => {
        set((state) => {
            const generatorSelections = [
                ...(state.activeUnitConfig.generatorSelections ??
                    (state.activeUnitConfig.generatorSelection ? [state.activeUnitConfig.generatorSelection] : [])),
            ]
            if (selection && !canSelectGeneratorInSlot(generatorSelections, slotIndex, selection.generatorName)) {
                return state
            }
            if (selection) {
                generatorSelections[slotIndex] = selection
            } else {
                generatorSelections.splice(slotIndex, 1)
            }
            const normalizedSelections = generatorSelections.filter(Boolean)
            const newConfig = {
                ...state.activeUnitConfig,
                generatorSelection: normalizedSelections[0] ?? null,
                generatorSelections: normalizedSelections.length > 0 ? normalizedSelections : undefined,
            }
            return {
                activeUnitConfig: newConfig,
                currentList:
                    state.selectedListInstanceId && state.currentList
                        ? updateListUnit(
                              state.currentList,
                              state.selectedListInstanceId,
                              newConfig,
                              state.units,
                              state.selectedModelId ?? undefined,
                          )
                        : state.currentList,
            }
        })
        get().persistLists()
    },
    setGeneratorMountedWeapon: (selectionIndex, weaponName) => {
        set((state) => {
            const generatorSelections = [
                ...(state.activeUnitConfig.generatorSelections ??
                    (state.activeUnitConfig.generatorSelection ? [state.activeUnitConfig.generatorSelection] : [])),
            ]
            const selection = generatorSelections[selectionIndex]
            if (!selection) return state
            generatorSelections[selectionIndex] = { ...selection, mountedWeaponName: weaponName }
            const newConfig = {
                ...state.activeUnitConfig,
                generatorSelection: generatorSelections[0] ?? null,
                generatorSelections: generatorSelections.length > 1 ? generatorSelections : undefined,
            }
            return {
                activeUnitConfig: newConfig,
                currentList:
                    state.selectedListInstanceId && state.currentList
                        ? updateListUnit(
                              state.currentList,
                              state.selectedListInstanceId,
                              newConfig,
                              state.units,
                              state.selectedModelId ?? undefined,
                          )
                        : state.currentList,
            }
        })
        get().persistLists()
    },
    setFleetDoctrineSelection: (selection) => {
        set((state) => {
            if (!state.selectedListInstanceId || !state.currentList) return state
            const entry = findArmyUnit(state.currentList.units, state.selectedListInstanceId)
            if (!entry) return state
            const unitConfig = {
                ...entry.config,
                fleetDoctrineSelection: selection,
            }
            return {
                currentList: updateListUnit(state.currentList, state.selectedListInstanceId, unitConfig, state.units),
            }
        })
        get().persistLists()
    },
    setOptionQuantity: (tag, quantity) => {
        set((state) => {
            if (state.selectedListInstanceId && state.currentList && isUnitLevelOption(tag)) {
                const entry = findArmyUnit(state.currentList.units, state.selectedListInstanceId)
                const unit = entry ? state.units.find((item) => item.id === entry.unitId) : null
                if (!entry || !unit) return state
                const unitConfig = {
                    ...entry.config,
                    optionQuantities: updateOptionQuantitiesForSelection(unit, entry.config, tag, quantity),
                }
                const currentList = updateListUnit(
                    state.currentList,
                    state.selectedListInstanceId,
                    unitConfig,
                    state.units,
                )
                return {
                    currentList: syncListGeneratedOptionAttachments(currentList, state.units),
                }
            }
            const unit = state.units.find((item) => item.id === state.selectedUnitId)
            if (!unit) return state
            const newConfig = {
                ...state.activeUnitConfig,
                optionQuantities: updateOptionQuantitiesForSelection(unit, state.activeUnitConfig, tag, quantity),
            }
            return {
                activeUnitConfig: newConfig,
                currentList:
                    state.selectedListInstanceId && state.currentList
                        ? syncListGeneratedOptionAttachments(
                              updateListUnit(
                                  state.currentList,
                                  state.selectedListInstanceId,
                                  newConfig,
                                  state.units,
                                  state.selectedModelId ?? undefined,
                              ),
                              state.units,
                          )
                        : state.currentList,
            }
        })
        get().persistLists()
    },
}))
