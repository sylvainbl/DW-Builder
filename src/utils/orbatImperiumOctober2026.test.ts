import assert from 'node:assert/strict'
import test from 'node:test'
import data from '../../public/data/units/imperium.json' with { type: 'json' }
import definitions from '../../public/data/battlefleets.json' with { type: 'json' }
import doctrines from '../../public/data/fleet-doctrines.json' with { type: 'json' }
import glossary from '../../public/data/glossary.json' with { type: 'json' }
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig } from '../types/index'
import { canAttachToParent, getAttachmentParentEffects, getMinimumModelsForAttachment } from './attachments.ts'
import { canUnitJoinBattlefleetDefinition, validateBattlefleetOrganisation } from './battlefleets.ts'
import { getBattlefleetAddedProperties, getBattlefleetAddedTags } from './battlefleetEffects.ts'
import { getConfiguredModelLimit, getConfiguredUnit, getSelectedOptionRuleEffects } from './optionRuleEffects.ts'
import { getAvailableFleetDoctrines } from './fleetDoctrines.ts'
import { getWeaponGeneratorLimit, withUnitWeaponGeneratorSelection } from './generatorRules.ts'
import { computeArmyUnitTotal, computeArmyUnitVpr, updateListUnit } from './pointsCalc.ts'
import { parseImportedList } from './localStorage.ts'
import { migrateOrbatConfig, normalizeLegacyUnitId } from './storageMigration.ts'

const units = data as unknown as Unit[]
const fleets = definitions as BattlefleetDefinition[]
const unit = (name: string) => units.find((unit) => unit.name === name)!
const config = (optionQuantities: Record<string, number> = {}): UnitConfig => ({
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities,
})
function entry(name: string, count = unit(name).min ?? 1, options: Record<string, number> = {}): ArmyUnit {
    return {
        instanceId: name,
        unitId: unit(name).id,
        battlefleetInstanceId: 'fleet',
        config: config(options),
        models: Array.from({ length: count }, (_, i) => ({ modelId: `${name}-${i}`, config: config() })),
        totalPoints: 0,
    }
}
function list(entries: ArmyUnit[], id = 'imperium-main'): ArmyList {
    return {
        id: 'audit',
        name: 'Imperium beta',
        faction_id: 'imperium',
        createdAt: '',
        updatedAt: '',
        units: entries,
        battlefleets: [{ instanceId: 'fleet', definitionId: id, name: id }],
    }
}
const issues = (entries: ArmyUnit[], id: string) => validateBattlefleetOrganisation(list(entries, id), units, fleets)

test('Imperium beta keeps real two-digit ratings and printed firing arcs', () => {
    assert.equal(unit('Ice Maiden').stats.DEF, 12)
    assert.equal(unit('Ice Maiden').stats.HUL, 20)
    assert.deepEqual(unit('Ice Maiden').weapons[3]!.firepower, { C: 36, S: 26, E: null })
    assert.equal(unit('Kaiser').weapons[4]!.arc, 'A')
    assert.deepEqual(unit('Arminius').stats, {
        MAS: 2,
        SPD: '1"-7"',
        TRN: 3,
        DEF: 4,
        ARM: 3,
        HUL: 5,
        ACT: 2,
        BRD: 1,
        REP: 1,
        CRW: 6,
    })
    assert.deepEqual(
        unit('Hoth').weapons.map((w) => [w.name, w.arc, w.slot]),
        [['Sturmklaue', '—', undefined]],
    )
    assert.deepEqual(unit('Hoth').hardpoint_options, {})
})

test('model-count contradictions follow profiles corroborated by the change log', () => {
    for (const [name, max] of [
        ['Gungnir', 3],
        ['Hoth', 6],
        ['Augustus', 2],
        ['Loki', 3],
    ] as const)
        assert.equal(unit(name).max, max)
    assert.equal(unit('Ferdinand').role, 'Support')
})

test('Sekundär loadouts replace one Special weapon with two FPS Heavy weapons, keeping stable IDs', () => {
    for (const name of ['Falkenstein', 'Konig', 'Heidelberg']) {
        const base = unit(name)
        const secondary = units.find((unit) => unit.name === name && unit.id.includes('sekundar'))!
        assert.equal(secondary.point_cost_per_model, base.point_cost_per_model)
        assert.equal(secondary.weapons.length, base.weapons.length + 1)
        assert.equal(
            secondary.weapons.some((w) => w.slot === 'S'),
            false,
        )
        assert.equal(secondary.weapons.filter((w) => w.slot === 'H' && w.arc === 'FPS').length, 2)
    }
})

test('a Falkenstein can mount both its allowed Heavy generator and its separate Freya Array', () => {
    const secondary = units.find((unit) => unit.id === 'imperium_falkenstein_battlecarrier_sekundar_configuration')!
    const heavyIndices = secondary.weapons.flatMap((w, i) => (w.slot === 'H' ? [i] : []))
    const lightIndex = secondary.weapons.findIndex((w) => w.slot === 'L')
    let selected = withUnitWeaponGeneratorSelection(secondary, config(), {
        weaponIndex: heavyIndices[0]!,
        generatorName: 'Atomic Generator',
        generatorCost: 5,
    })
    selected = withUnitWeaponGeneratorSelection(secondary, selected, {
        weaponIndex: lightIndex,
        generatorName: 'Freya Array',
        generatorCost: 0,
    })
    assert.equal(selected.generatorSelections?.length, 2)
    assert.equal(getWeaponGeneratorLimit(secondary, heavyIndices[0]!), 1)
    assert.equal(
        withUnitWeaponGeneratorSelection(secondary, selected, {
            weaponIndex: heavyIndices[1]!,
            generatorName: 'Magnetic Generator',
            generatorCost: 15,
        }),
        selected,
    )
    assert.equal(withUnitWeaponGeneratorSelection(secondary, selected, null, lightIndex).generatorSelections?.length, 1)
    assert.equal(getWeaponGeneratorLimit(unit('Ferdinand'), 1), 2)
})

test('Flagship promotions affect formation eligibility, doctrines, model limits and points', () => {
    const e = entry('Einherjar', 1, { IMPERIUM_FLAGSHIP_VARIANT: 1 })
    const configured = getConfiguredUnit(unit('Einherjar'), e.models[0]!.config, e.config)
    assert.equal(configured.role, 'Flagship')
    assert.equal(configured.tags.includes('Patrol'), false)
    assert.equal(configured.tags.includes('Scions of Jutland'), true)
    assert.equal(getConfiguredModelLimit(unit('Einherjar'), e.models[0]!.config, e.config), 1)
    assert.ok(getAvailableFleetDoctrines(configured, doctrines).some((d) => d.name === 'Inductorium'))
    assert.equal(computeArmyUnitTotal(e, units), 210)
    assert.ok(
        canUnitJoinBattlefleetDefinition(
            fleets.find((f) => f.id === 'imperium-hunen')!,
            unit('Einherjar'),
        ),
    )
    const errors = issues([e], 'imperium-hunen')
    assert.equal(
        errors.some((e) => e.message.includes('Flagship units') || e.message.includes('does not match')),
        false,
    )
    e.models.push({ modelId: 'extra', config: config() })
    assert.ok(issues([e], 'imperium-hunen').some((e) => e.message.includes('allows at most 1')))
})

test('Ferdinand confers Teutonic, Stoic and Valorous to its parent and permits Ordo Flagship selection', () => {
    const parent = entry('Elector')
    parent.attachedUnits = [entry('Ferdinand', 1)]
    assert.ok(canAttachToParent(unit('Ferdinand'), unit('Elector')))
    assert.equal(getMinimumModelsForAttachment(unit('Ferdinand')), 1)
    assert.deepEqual(getAttachmentParentEffects(parent, units, unit('Elector').tags)[0]?.addTags, ['Teutonic'])
    const force = list([parent], 'imperium-ordo-teutonic')
    assert.ok(getBattlefleetAddedTags(force, fleets, units, parent).includes('Teutonic'))
    assert.ok(getBattlefleetAddedProperties(force, fleets, units, parent).some((p) => p.name === 'Valorous'))
    assert.equal(
        issues([parent], 'imperium-ordo-teutonic').some((e) => e.message.includes('does not match')),
        false,
    )
    assert.equal(computeArmyUnitTotal(parent, units), 390)
})

test('Hlökk is one 10-point Attachment with zero VPR, exclusively for Skjalden', () => {
    const hlokk = unit('Hlökk')
    const parent = entry('Skjalden')
    parent.attachedUnits = [entry('Hlökk')]
    assert.equal(getMinimumModelsForAttachment(hlokk), 1)
    assert.ok(canAttachToParent(hlokk, unit('Skjalden')))
    assert.equal(canAttachToParent(hlokk, unit('Asgard')), false)
    assert.equal(canAttachToParent(unit('Valkyrie'), unit('Skjalden')), false)
    assert.equal(computeArmyUnitTotal(parent, units), 310)
    assert.equal(computeArmyUnitVpr(parent, units), 10)
})

test('Iron Skies permits three Flagships and three copies, while Scions requires a Scions Flagship', () => {
    const entries = [entry('Zeppelin'), entry('Zeppelin'), entry('Zeppelin')].map((e, i) => ({
        ...e,
        instanceId: `air-${i}`,
    }))
    assert.deepEqual(
        issues(entries, 'imperium-iron-skies').filter((issue) => issue.battlefleetInstanceId === 'fleet'),
        [],
    )
    assert.ok(
        issues([...entries, { ...entry('Zeppelin'), instanceId: 'air-4' }], 'imperium-iron-skies').some((e) =>
            e.message.includes('three'),
        ),
    )
    assert.ok(issues([entry('Asgard')], 'imperium-scions-of-jutland').some((e) => e.message.includes('does not match')))
})

test('Imperium Ubiquitous raises the Mainstay class limit to three units', () => {
    const entries = [
        entry('Kaiser'),
        ...Array.from({ length: 3 }, (_, i) => ({
            ...entry('Blücher', 1, { IMPERIUM_SUBFACTION_PRUSSIAN: 1 }),
            instanceId: `line-${i}`,
        })),
        entry('Arminius', 2, { IMPERIUM_SUBFACTION_PRUSSIAN: 1 }),
    ]
    assert.equal(
        issues(entries, 'imperium-main').some((e) => e.message.includes('standalone')),
        false,
    )
    entries.push({ ...entry('Blücher', 1, { IMPERIUM_SUBFACTION_PRUSSIAN: 1 }), instanceId: 'line-4' })
    assert.ok(issues(entries, 'imperium-main').some((e) => e.message.includes('Ubiquitous')))
})

test('Konrad bomber upgrades apply to every model and charge twenty points each', () => {
    const e = entry('Konrad', 3, { IMPERIUM_SUBFACTION_TEUTONIC: 1 })
    const updated = updateListUnit(list([e]), e.instanceId, config({ BLITZEN_BOMBERS: 1 }), units, e.models[0]!.modelId)
        .units[0]!
    assert.ok(updated.models.every((m) => m.config.optionQuantities.BLITZEN_BOMBERS === 1))
    assert.equal(computeArmyUnitTotal(updated, units), 375)
    assert.ok(
        getSelectedOptionRuleEffects(unit('Konrad'), updated.models[1]!.config, updated.config).properties.some(
            (p) => p.name === 'SRS' && p.detail === 'Blitzen Bombers',
        ),
    )
})

test('Faust Defenders and Additional Valkyries replace the printed value rather than duplicating it', () => {
    assert.equal(getConfiguredUnit(unit('Ice Maiden'), config({ FAUST_DEFENDERS: 1 })).stats.BRD, 4)
    const effects = getSelectedOptionRuleEffects(unit('Skagerrak'), config({ ADDITIONAL_VALKYRIES: 1 }))
    assert.ok(effects.removedProperties.has('Flight of the Valkyries'))
    assert.equal(effects.properties.find((p) => p.name === 'Flight of the Valkyries')?.value, 4)
})

test('retired miniatures migrate to published parent classes without truncating saved model counts', () => {
    assert.equal(normalizeLegacyUnitId('imperium_sms_brandenburg'), unit('Elector').id)
    assert.equal(normalizeLegacyUnitId('imperium_malus_flak_destroyer'), unit('Sigimer').id)
    assert.equal(normalizeLegacyUnitId('imperium_nachtsturm_flak_frigate'), unit('Arminius').id)
    const original = entry('Gungnir', 4)
    const imported = parseImportedList({ format: 'dw-builder-list-v3', list: list([original]) }, units)!
    assert.equal(imported.units[0]!.models.length, 4)
    assert.ok(issues(imported.units, 'imperium-main').some((e) => e.message.includes('allows at most 3')))
    assert.equal(
        migrateOrbatConfig(unit('Hochmeister').id, config(), [config({ FLAGSHIP_VARIANT: 1 })]).optionQuantities
            .IMPERIUM_FLAGSHIP_VARIANT,
        1,
    )
})

test('glossary 4.05 preserves precise new combat rules and the complete Langsam token timing', () => {
    assert.match(glossary.properties.Vikingr, /8”/)
    assert.match(glossary.qualities.Deathblow, /adds \*\*X\*\*/)
    assert.match(glossary.qualities['All Around'], /halved/)
    assert.match(glossary.qualities.Voltaic, /ends the unit’s/)
    assert.match(glossary.systems['Langsam Generator'], /Generator Effect token is removed/)
    assert.match(glossary.systems['Storm Generator'], /Blanks/)
    assert.doesNotMatch(glossary.systems['Solex Generator'], /StormGenerator|Storm Generator/)
    assert.ok(glossary.systems['Special SRS Missions'])
    assert.ok(glossary.properties.Bomber)
})

test('legacy weapon aliases and changed mount indices migrate once, retaining the saved firing arc', () => {
    const old = {
        ...config(),
        hardpointSelections: { 3: 'Guided Stromschlag Rocket Battery' },
        generatorSelection: { weaponIndex: 4, generatorName: 'Atomic Generator', generatorCost: 5 },
    }
    const migrated = migrateOrbatConfig(unit('Elector').id, old)
    assert.deepEqual(migrated.hardpointSelections, { 4: 'Guided Heavy Erderschütterer Rockets' })
    assert.equal(migrated.generatorSelection?.weaponIndex, 3)
    assert.deepEqual(migrateOrbatConfig(unit('Elector').id, migrated), migrated)
    const current = { ...old, orbatVersion: '4.01 BETA' }
    assert.deepEqual(migrateOrbatConfig(unit('Elector').id, current).hardpointSelections, current.hardpointSelections)
})

test('old Teutonic choices and unit mines survive import without reappearing after the player changes them', () => {
    const old = entry('Arminius', 2)
    old.models.forEach((model) => (model.config.optionQuantities.TEUTONIC_VARIANT = 1))
    const imported = parseImportedList({ format: 'dw-builder-list-v3', list: list([old]) }, units)!
    assert.equal(imported.units[0]!.config.optionQuantities.IMPERIUM_SUBFACTION_TEUTONIC, 1)
    assert.equal(imported.units[0]!.config.optionQuantities.IMPERIUM_SUBFACTION_PRUSSIAN, undefined)
    imported.units[0]!.config.optionQuantities = { IMPERIUM_SUBFACTION_PRUSSIAN: 1 }
    const again = parseImportedList({ format: 'dw-builder-list-v3', list: imported }, units)!
    assert.equal(again.units[0]!.config.optionQuantities.IMPERIUM_SUBFACTION_TEUTONIC, undefined)
    const platform = entry('Defence Platform', 2)
    platform.models.forEach((model) => (model.config.optionQuantities.DEFENSIVE_MINES = 1))
    const mines = parseImportedList({ format: 'dw-builder-list-v3', list: list([platform]) }, units)!.units[0]!
    assert.equal(computeArmyUnitTotal(mines, units), 140)
    assert.ok(mines.models.every((model) => !model.config.optionQuantities.IMPERIUM_DEFENSIVE_MINES))
})
