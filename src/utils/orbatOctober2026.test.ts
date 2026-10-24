import assert from 'node:assert/strict'
import test from 'node:test'
import crownData from '../../public/data/units/crown.json' with { type: 'json' }
import commonwealthData from '../../public/data/units/commonwealth.json' with { type: 'json' }
import doctrines from '../../public/data/fleet-doctrines.json' with { type: 'json' }
import formations from '../../public/data/battlefleets.json' with { type: 'json' }
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig } from '../types/index'
import { canAttachToParent } from './attachments.ts'
import { validateBattlefleetOrganisation } from './battlefleets.ts'
import { getAvailableFleetDoctrines } from './fleetDoctrines.ts'
import { getSelectedOptionRuleEffects, getSelectedTags } from './optionRuleEffects.ts'
import { computeArmyUnitTotal, computeArmyUnitVpr } from './pointsCalc.ts'
import { parseImportedList } from './localStorage.ts'

const crown = crownData as unknown as Unit[]
const commonwealth = commonwealthData as unknown as Unit[]
const unit = (name: string) => [...crown, ...commonwealth].find((item) => item.id === name)!
const config = (optionQuantities: Record<string, number> = {}): UnitConfig => ({
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities,
})
function entry(id: string, count = 1): ArmyUnit {
    return {
        instanceId: id,
        unitId: id,
        battlefleetInstanceId: 'fleet',
        config: config(),
        models: Array.from({ length: count }, (_, i) => ({ modelId: `${id}-${i}`, config: config() })),
        totalPoints: 0,
    }
}
function list(entries: ArmyUnit[], faction = 'crown', definitionId = 'crown-main'): ArmyList {
    return {
        id: 'audit',
        name: 'October audit',
        faction_id: faction,
        createdAt: '',
        updatedAt: '',
        units: entries,
        battlefleets: [{ instanceId: 'fleet', definitionId, name: definitionId }],
    }
}
const british = config({ CROWN_SUBFACTION_BRITISH: 1 })
const canadian = config({ CROWN_SUBFACTION_CANADIAN: 1 })

test('the final Prezidium table replaces the phantom FPS gun with the now visible FS light battery', () => {
    assert.deepEqual(
        unit('commonwealth_prezidium').weapons.map(({ name, arc }) => [name, arc]),
        [
            ['Super-Heavy Torpedo Salvo', 'F'],
            ['Heavy Gun Battery', 'FP'],
            ['Heavy Gun Battery', 'FS'],
            ['Light Gun Battery', 'FP'],
            ['Light Gun Battery', 'FS'],
        ],
    )
})

test('Oleg buys the now priced Cryo system, and newly available arrays apply per model', () => {
    const oleg = unit('commonwealth_oleg')
    assert.equal(oleg.options_and_upgrades.find((o) => o.tag === 'CRYO_GENERATOR')!.cost_per_unit, 10)
    assert.ok(
        getSelectedOptionRuleEffects(oleg, config({ CRYO_GENERATOR: 1 })).systems.some(
            (s) => s.name === 'Cryo Generator',
        ),
    )
    assert.ok(!oleg.options_and_upgrades.some((o) => o.tag === 'SEMYENOV_ASSAULT_BORE'))
    for (const id of ['commonwealth_voivode', 'commonwealth_jadwiga']) {
        const selected = entry(id, 2)
        selected.models[0]!.config = config({ ZUBR_ANTI_AIR: 1 })
        selected.models[1]!.config = config({ GIYENA_DISSONANCE: 1 })
        assert.equal(computeArmyUnitTotal(selected, commonwealth), 2 * unit(id).point_cost_per_model! + 15)
        const upgrades = unit(id).options_and_upgrades.filter((o) =>
            ['ZUBR_ANTI_AIR', 'GIYENA_DISSONANCE'].includes(o.tag),
        )
        assert.equal(upgrades[0]!.exclusive_group, upgrades[1]!.exclusive_group)
    }
})

test('Icemaker requires the newly available Cryo upgrade on every Oleg model', () => {
    const selected = entry('commonwealth_oleg', 2)
    selected.config = config({ COMMONWEALTH_SUBFACTION_RUSSIAN: 1 })
    selected.models[0]!.config = config({ CRYO_GENERATOR: 1 })
    const messages = () =>
        validateBattlefleetOrganisation(
            list([selected], 'commonwealth', 'commonwealth-icemaker'),
            commonwealth,
            formations as BattlefleetDefinition[],
        ).map((i) => i.message)
    assert.ok(messages().some((m) => m.includes('every applicable model')))
    selected.models[1]!.config = config({ CRYO_GENERATOR: 1 })
    assert.ok(!messages().some((m) => m.includes('every applicable model')))
})

test('Crown units formerly lacking selection entries now have prices and the printed options', () => {
    assert.equal(
        computeArmyUnitVpr(entry('crown_lords_hood', 3), crown),
        18,
        'the legendary three-model Sabre unit must not count its VPR three times twice',
    )
    assert.equal(
        unit('crown_hmcs_tilloch_galt').vpr,
        11,
        'the printed 11 must not collapse to 1 during glyph deduplication',
    )
    assert.equal(unit('crown_godavari').point_cost_per_model, 105)
    assert.equal(unit('crown_supply_platform').point_cost_per_model, 65)
    assert.equal(unit('crown_titan').point_cost_per_model, 70)
    assert.deepEqual(
        unit('crown_godavari').hardpoint_options.H!.map((w) => w.name),
        ['Heavy Rocket Battery', 'Heavy Swift Torpedo Turret', 'Majestic Cannons'],
    )
    assert.ok(canAttachToParent(unit('crown_devaki'), unit('crown_godavari')))
    assert.ok(canAttachToParent(unit('crown_chanura'), unit('crown_godavari')))
    for (const id of ['crown_ceylon', 'crown_defence_platform'])
        assert.ok(canAttachToParent(unit(id), unit('crown_supply_platform')))
    const titan = entry('crown_titan')
    titan.config = config({ ESCORT: 3 })
    titan.models[0]!.config = config({ TROOP_TRANSPORT_BAY: 1, OLYMPIA_LEVANT_DRIVE: 1 })
    assert.equal(computeArmyUnitTotal(titan, crown), 130)
    assert.ok(getSelectedTags(unit('crown_titan'), titan.models[0]!.config, titan.config).includes('Airborne'))
    assert.ok(
        !canAttachToParent(unit('crown_hermes'), unit('crown_titan'), {
            parentTags: ['Crown', 'Airborne', 'Merchantman'],
        }),
    )
})

test('Newfoundland starts with guns and pays for a Yukon on each upgraded model only', () => {
    assert.deepEqual(
        unit('crown_newfoundland')
            .weapons.slice(1)
            .map((w) => [w.name, w.firepower]),
        [
            ['Heavy Gun Battery', { C: 4, S: 7, E: null }],
            ['Heavy Gun Battery', { C: 4, S: 7, E: null }],
        ],
    )
    const selected = entry('crown_newfoundland', 3)
    selected.models[1]!.config = config({ YUKON_MINELAYER: 1 })
    assert.equal(computeArmyUnitTotal(selected, crown), 390)
    assert.deepEqual(getSelectedOptionRuleEffects(unit('crown_newfoundland'), selected.models[1]!.config).properties, [
        { name: 'Mine Layer', value: 2 },
        { name: 'Minesweeper', value: null },
    ])
})

test('Crown chooses one subfaction for the unit, restricting doctrines and attachment parent traits', () => {
    const sabre = unit('crown_sabre'),
        albion = unit('crown_albion'),
        excalibur = unit('crown_excalibur')
    const parentTags = getSelectedTags(sabre, config(), canadian)
    assert.ok(parentTags.includes('Canadian') && !parentTags.includes('British'))
    assert.ok(
        getAvailableFleetDoctrines({ ...sabre, tags: parentTags }, doctrines).some(
            (d) => d.name === 'Snowbird Air Patrol',
        ),
    )
    assert.ok(canAttachToParent(albion, sabre, { parentTags }))
    assert.ok(
        canAttachToParent(albion, sabre, { parentTags, attachmentTags: getSelectedTags(albion, config(), canadian) }),
    )
    assert.ok(
        !canAttachToParent(albion, sabre, { parentTags, attachmentTags: getSelectedTags(albion, config(), british) }),
    )
    assert.ok(
        !canAttachToParent(excalibur, sabre, {
            parentTags,
            attachmentTags: getSelectedTags(excalibur, config(), canadian),
        }),
        'matching subfactions do not bypass the Carrier requirement',
    )
    const selected = entry('crown_sabre')
    const issues = () =>
        validateBattlefleetOrganisation(list([selected]), crown, formations as BattlefleetDefinition[]).map(
            (i) => i.message,
        )
    assert.ok(issues().some((m) => m.includes('exactly one Crown subfaction')))
    selected.config = canadian
    assert.ok(!issues().some((m) => m.includes('exactly one Crown subfaction')))
})

test('Crown defensive mines cost once per unit and old model purchases survive import without double charging', () => {
    const selected = entry('crown_supply_platform', 3)
    selected.unitId = 'Crown_supply_platform'
    selected.models[1]!.config = config({ DEFENSIVE_MINES: 1 })
    const imported = parseImportedList({ list: list([selected]) }, crown)!
    assert.equal(imported.units[0]!.config.optionQuantities.CROWN_DEFENSIVE_MINES, 1)
    assert.equal(computeArmyUnitTotal(imported.units[0]!, crown), 215)
    for (const model of imported.units[0]!.models)
        assert.deepEqual(
            getSelectedOptionRuleEffects(unit('crown_supply_platform'), model.config, imported.units[0]!.config)
                .properties,
            [{ name: 'Auxiliary Mine Layer', value: 3 }],
        )
    const again = parseImportedList({ list: imported }, crown)!
    assert.equal(computeArmyUnitTotal(again.units[0]!, crown), 215)
    again.units[0]!.config.optionQuantities.CROWN_DEFENSIVE_MINES = 0
    const removed = parseImportedList({ list: again }, crown)!
    assert.equal(
        computeArmyUnitTotal(removed.units[0]!, crown),
        195,
        'reloading must not restore a mine purchase the user removed',
    )
})

test('platforms buy an additional generator while attached Ceylon, Defence Platform and Hermes cannot buy escorts', () => {
    const heavy = unit('crown_heavy_platform')
    assert.equal(heavy.options_and_upgrades.find((o) => o.tag === 'GENERATOR_ADDON')!.generator_replaces_weapon, false)
    for (const id of ['crown_ceylon', 'crown_defence_platform', 'crown_hermes'])
        assert.ok(
            unit(id)
                .options_and_upgrades.find((o) => o.tag === 'ESCORT')!
                .restrictions!.some((r) => r.includes('Attachment')),
        )
})
