import assert from 'node:assert/strict'
import test from 'node:test'
import allianceUnits from '../../public/data/units/alliance.json' with { type: 'json' }
import type { Unit, UnitConfig } from '../types/index.ts'
import { normalizeGeneratorBackedOptionConfig, optionAllowsWeapon } from './optionConfig.ts'
import {
    getEffectiveGeneratorSelections,
    getSelectedGeneratorSystems,
    getSelectedOptionRuleEffects,
    getSelectedRemovedWeaponNames,
} from './optionRuleEffects.ts'

const lyon = allianceUnits.find((unit) => unit.id === 'alliance_lyon') as unknown as Unit
const franciscoOption = lyon.options_and_upgrades.find((option) => option.tag === 'FRANCISCO_SOLEX_GENERATOR')!
const baseConfig: UnitConfig = {
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities: {},
}

const franciscoConfig: UnitConfig = {
    ...baseConfig,
    generatorSelection: {
        weaponIndex: 1,
        generatorName: 'Francisco Solex Generator',
        generatorCost: 20,
    },
}

test('Francisco Solex is a single generator choice for the Lyon FPSA Heavy Hardpoint', () => {
    assert.equal(franciscoOption.max, 1)
    assert.equal(franciscoOption.generator_replaces_weapon, true)
    assert.equal(optionAllowsWeapon(franciscoOption, lyon.weapons[0]!), false)
    assert.equal(optionAllowsWeapon(franciscoOption, lyon.weapons[1]!), true)
    assert.deepEqual(getEffectiveGeneratorSelections(lyon, franciscoConfig), [
        {
            weaponIndex: 1,
            generatorName: 'Francisco Solex Generator',
            generatorCost: 20,
        },
    ])
})

test('Francisco Solex grants Generator Ship and Solex Generator without exposing a fictitious system', () => {
    assert.deepEqual(getSelectedGeneratorSystems(lyon, franciscoConfig), [
        { name: 'Generator Ship', value: null },
        { name: 'Solex Generator', value: null },
    ])
    assert.deepEqual(getSelectedOptionRuleEffects(lyon, franciscoConfig).systems, [
        { name: 'Generator Ship', value: null },
        { name: 'Solex Generator', value: null },
    ])
})

test('legacy Francisco quantities migrate to the FPSA generator selection', () => {
    const legacyConfig: UnitConfig = {
        ...baseConfig,
        optionQuantities: { FRANCISCO_SOLEX_GENERATOR: 1 },
    }

    const migrated = normalizeGeneratorBackedOptionConfig(lyon, legacyConfig)

    assert.deepEqual(migrated.generatorSelection, franciscoConfig.generatorSelection)
    assert.equal(migrated.optionQuantities.FRANCISCO_SOLEX_GENERATOR, 0)
})

test('Lyon has no hidden weapons when no upgrade is selected', () => {
    assert.deepEqual([...getSelectedRemovedWeaponNames(lyon, baseConfig)], [])
    assert.deepEqual(getSelectedGeneratorSystems(lyon, baseConfig), [])
})
