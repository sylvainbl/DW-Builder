import assert from 'node:assert/strict'
import test from 'node:test'
import commonwealth from '../../public/data/units/commonwealth.json' with { type: 'json' }
import formations from '../../public/data/battlefleets.json' with { type: 'json' }
import doctrines from '../../public/data/fleet-doctrines.json' with { type: 'json' }
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig } from '../types/index'
import { canAttachToParent } from './attachments.ts'
import { validateBattlefleetOrganisation } from './battlefleets.ts'
import { getAvailableFleetDoctrines } from './fleetDoctrines.ts'
import { getSelectedOptionRuleEffects, getSelectedTags } from './optionRuleEffects.ts'
import { computeArmyUnitTotal } from './pointsCalc.ts'
import { parseImportedList } from './localStorage.ts'

const units = commonwealth as unknown as Unit[]
const definitions = formations as BattlefleetDefinition[]
const unit = (id: string) => units.find((item) => item.id === `commonwealth_${id}`)!
const config = (optionQuantities: Record<string, number> = {}): UnitConfig => ({
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities,
})
function entry(id: string, index = 0, count = 1): ArmyUnit {
    return {
        instanceId: `${id}-${index}`,
        unitId: `commonwealth_${id}`,
        battlefleetInstanceId: 'fleet',
        config: config(),
        models: Array.from({ length: count }, (_, i) => ({ modelId: `${id}-${index}-${i}`, config: config() })),
        totalPoints: 0,
    }
}
function list(definitionId: string, entries: ArmyUnit[]): ArmyList {
    return {
        id: 'list',
        name: 'Commonwealth test',
        faction_id: 'commonwealth',
        createdAt: '',
        updatedAt: '',
        battlefleets: [{ instanceId: 'fleet', definitionId, name: definitionId }],
        units: entries,
    }
}
function messages(definitionId: string, entries: ArmyUnit[]) {
    return validateBattlefleetOrganisation(list(definitionId, entries), units, definitions).map(
        (issue) => issue.message,
    )
}
const russian = config({ COMMONWEALTH_SUBFACTION_RUSSIAN: 1 })
const ukrainian = config({ COMMONWEALTH_SUBFACTION_UKRAINIAN: 1 })

test('Commonwealth 4.01 keeps the visible weapon rows, actual hardpoints and new carrier squadron profiles', () => {
    assert.equal(units.length, 45)
    assert.equal(unit('morozko'), undefined)
    assert.equal(unit('arkhangel').point_cost_per_model, 155)
    assert.equal(unit('boyar').weapons[0]!.name, 'Tsiolkovsky Rocket Launcher')
    assert.equal(
        unit('prezidium').weapons.length,
        5,
        'the final PDF has five visible weapons after correcting the beta text objects',
    )
    assert.equal(unit('stoletov').weapons.length, 3, 'a blank arc must not turn a base weapon into a hardpoint option')
    assert.equal(unit('stoletov').weapons[2]!.arc, 'FPS', 'the final PDF supplies the previously missing arc')
    assert.ok(!unit('anastasia').weapons.some((weapon) => weapon.slot), 'Anastasia weapons have no hardpoint icons')
    assert.deepEqual(unit('arkhangel').hardpoint_options.H![0]!.firepower, { C: 2, S: 3, E: 3 })
    assert.equal(unit('szlachta').point_cost_per_model, 105)
    assert.deepEqual(
        unit('szlachta').short_range_squadrons?.map(({ attack, intercept, support, resilience }) => [
            attack,
            intercept,
            support,
            resilience,
        ]),
        [[4, 3, 2, 4]],
    )
})

test('a mandatory subfaction applies to every model and determines attachment and doctrine eligibility', () => {
    const rurik = unit('rurik'),
        arkhangel = unit('arkhangel')
    const parentTags = getSelectedTags(arkhangel, config(), ukrainian)
    const attachmentTags = getSelectedTags(rurik, config(), ukrainian)
    assert.ok(parentTags.includes('Ukrainian') && !parentTags.includes('Subfaction'))
    assert.ok(
        canAttachToParent(rurik, arkhangel, { parentTags }),
        'the picker offers an attachment that can choose the parent subfaction',
    )
    assert.ok(canAttachToParent(rurik, arkhangel, { parentTags, attachmentTags }))
    assert.equal(
        canAttachToParent(rurik, arkhangel, { parentTags, attachmentTags: getSelectedTags(rurik, config(), russian) }),
        false,
    )
    const available = getAvailableFleetDoctrines({ ...arkhangel, tags: parentTags }, doctrines)
    assert.ok(available.some((doctrine) => doctrine.name === 'Hetman of the Sea'))
    assert.ok(!available.some((doctrine) => doctrine.name === 'Cryoshock'))
    const selected = entry('arkhangel')
    assert.ok(
        messages('commonwealth-main', [selected]).some((message) =>
            message.includes('exactly one Commonwealth subfaction'),
        ),
    )
    selected.config = ukrainian
    assert.ok(
        !messages('commonwealth-main', [selected]).some((message) =>
            message.includes('exactly one Commonwealth subfaction'),
        ),
    )
})

test('Norilsk upgrades preserve Cryo access while replacing Heavy Prow, and Yak buys Flak Barrage rather than Hunter', () => {
    const selected = config({ CRYO_GENERATOR: 1, SEMYENOV_ASSAULT_BORE: 1 })
    const effects = getSelectedOptionRuleEffects(unit('norilsk'), selected)
    assert.ok(effects.removedProperties.has('Heavy Prow'))
    assert.ok(effects.properties.some((property) => property.name === 'Breaching Drill' && property.value === 9))
    assert.ok(effects.systems.some((system) => system.name === 'Cryo Generator'))
    const yak = unit('yak'),
        upgrade = yak.options_and_upgrades.find((option) => option.tag === 'ZUBR_ANTI_AIR')!
    assert.equal(upgrade.cost_per_unit, 5)
    assert.deepEqual(getSelectedOptionRuleEffects(yak, config({ ZUBR_ANTI_AIR: 1 })).systems, [
        { name: 'Flak Barrage', value: 4 },
    ])
})

test('Defensive Mines cost 20 points for the unit and apply to every platform', () => {
    const platforms = entry('offshore_defence_platform', 0, 3)
    platforms.config = config({ COMMONWEALTH_DEFENSIVE_MINES: 1 })
    assert.equal(computeArmyUnitTotal(platforms, units), 3 * 60 + 20)
    for (const model of platforms.models) {
        assert.deepEqual(
            getSelectedOptionRuleEffects(unit('offshore_defence_platform'), model.config, platforms.config).properties,
            [{ name: 'Auxiliary Mine Layer', value: 3 }],
        )
    }
})

test('Icemaker permits two Flagships but requires every Norilsk model to buy Cryo and forbids a second doctrine', () => {
    const first = entry('borodino'),
        second = entry('borodino', 1),
        norilsk = entry('norilsk', 0, 2)
    norilsk.config = russian
    norilsk.models[0]!.config = config({ CRYO_GENERATOR: 1 })
    const entries = [first, second, norilsk]
    let issues = messages('commonwealth-icemaker', entries)
    assert.ok(!issues.some((message) => message.includes('can contain only one')))
    assert.ok(issues.some((message) => message.includes('every applicable model')))
    norilsk.models[1]!.config = config({ CRYO_GENERATOR: 1 })
    assert.ok(!messages('commonwealth-icemaker', entries).some((message) => message.includes('every applicable model')))
    second.config.fleetDoctrineSelection = { doctrineName: 'Strategic Reserves', doctrineCost: 10 }
    issues = messages('commonwealth-icemaker', entries)
    assert.ok(issues.some((message) => message.includes('second Flagship cannot purchase')))
})

test('Orlan counts only non-Flagship standalone units for its half Ekranoplan/Hovercraft requirement', () => {
    const flagship = entry('alexeyev'),
        dragunov = entry('dragunov'),
        kutsov = entry('kutsov')
    kutsov.config = russian
    kutsov.attachedUnits = [entry('rurik', 0, 2)]
    kutsov.attachedUnits[0]!.config = russian
    assert.ok(
        !messages('commonwealth-orlan-belokhvost', [flagship, dragunov, kutsov]).some((message) =>
            message.includes('at least half'),
        ),
    )
    const norilsk = entry('norilsk')
    norilsk.config = russian
    assert.ok(
        messages('commonwealth-orlan-belokhvost', [flagship, dragunov, kutsov, norilsk]).some((message) =>
            message.includes('at least half'),
        ),
    )
})

test('Black Wolf allows both named Flagships but rejects Airborne units, including converted transports', () => {
    const entries = [entry('anastasia'), entry('death_bringer'), entry('szlachta')]
    const issues = messages('commonwealth-black-wolf', entries)
    assert.ok(!issues.some((message) => message.includes('can contain only one')))
    assert.ok(issues.some((message) => message.includes('cannot contain Airborne')))
    const europa = entry('europa')
    europa.models[0]!.config = config({ OLYMPIA_LEVANT_DRIVE: 1 })
    assert.ok(
        messages('commonwealth-svyatogor-colossi', [europa]).some((message) =>
            message.includes('cannot contain Airborne'),
        ),
    )
})

test('a Polish-Lithuanian Airborne Flagship permits four such units but never an unlimited air fleet', () => {
    const entries = [entry('zamiec'), ...Array.from({ length: 4 }, (_, i) => entry('jadwiga', i))]
    assert.ok(!messages('commonwealth-main', entries).some((message) => message.includes('exceeds its Airborne limit')))
    entries.push(entry('szlachta'))
    assert.ok(messages('commonwealth-main', entries).some((message) => message.includes('exceeds its Airborne limit')))
})

test('importing a retired Morozko preserves its identity, models and upgrades as a Cryo-equipped Norilsk', () => {
    const morozko = entry('morozko', 0, 2)
    morozko.customName = 'Veteran squadron'
    morozko.models[0]!.config = config({ KHATANGA_BREACHING_DRILL: 1 })
    const imported = parseImportedList({ list: list('commonwealth-main', [morozko]) }, units)!
    assert.equal(imported.units.length, 1)
    const replacement = imported.units[0]!
    assert.equal(replacement.unitId, 'commonwealth_norilsk')
    assert.equal(replacement.customName, 'Veteran squadron')
    assert.equal(replacement.models.length, 2)
    assert.equal(replacement.config.optionQuantities.COMMONWEALTH_SUBFACTION_RUSSIAN, 1)
    assert.ok(replacement.models.every((model) => model.config.optionQuantities.CRYO_GENERATOR === 1))
    assert.equal(replacement.models[0]!.config.optionQuantities.SEMYENOV_ASSAULT_BORE, 1)
    assert.equal(replacement.totalPoints, 2 * (115 + 10) + 10)
    const twice = parseImportedList({ list: imported }, units)!
    assert.equal(twice.units[0]!.totalPoints, replacement.totalPoints)
})
