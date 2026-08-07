import assert from 'node:assert/strict'
import test from 'node:test'
import type { UnitConfig } from '../types/index'
import { canSelectGeneratorInSlot, getGeneratorChoicesForSlot, withWeaponGeneratorSelection } from './generatorRules.ts'
import generators from '../../public/data/generators.json' with { type: 'json' }
import enlightenedUnits from '../../public/data/units/enlightened.json' with { type: 'json' }

const selections: NonNullable<UnitConfig['generatorSelections']> = [
    { weaponIndex: -1, generatorName: 'Atomic Generator', generatorCost: 5 },
    { weaponIndex: -1, generatorName: 'Heavy Shield Generator', generatorCost: 15 },
]

test('a model cannot mount the same ordinary generator more than once', () => {
    assert.equal(canSelectGeneratorInSlot(selections, 1, 'Atomic Generator'), false)
})

test('the current ordinary generator remains available in its own slot', () => {
    const choices = getGeneratorChoicesForSlot(
        [
            { name: 'Atomic Generator', point_cost: 5 },
            { name: 'Fury Generator', point_cost: 20 },
        ],
        selections,
        0,
    )

    assert.deepEqual(
        choices.map((generator) => generator.name),
        ['Atomic Generator', 'Fury Generator'],
    )
})

test('selecting another weapon generator replaces the first selection for the model', () => {
    const baseConfig: UnitConfig = {
        hardpointSelections: {},
        generatorSelection: null,
        fleetDoctrineSelection: null,
        optionQuantities: {},
    }
    const firstSelection: NonNullable<UnitConfig['generatorSelection']> = {
        weaponIndex: 0,
        generatorName: 'Solex Generator',
        generatorCost: 10,
    }
    const secondSelection: NonNullable<UnitConfig['generatorSelection']> = {
        weaponIndex: 1,
        generatorName: 'Francisco Solex Generator',
        generatorCost: 20,
    }

    const withFirstGenerator = withWeaponGeneratorSelection(baseConfig, firstSelection)
    const withFranciscoGenerator = withWeaponGeneratorSelection(withFirstGenerator, secondSelection)

    assert.deepEqual(withFranciscoGenerator.generatorSelection, secondSelection)
    assert.equal(withFranciscoGenerator.generatorSelections, undefined)
})

test('Enlightened 4.01 keeps Entropic Generators profile-specific', () => {
    assert.equal(
        generators.enlightened.some((generator) => generator.name === 'Entropic Generator'),
        false,
    )
    assert.equal(generators.enlightened.find((generator) => generator.name === 'Chrono Generator')?.point_cost, 20)
    assert.equal(generators.enlightened.find((generator) => generator.name === 'Null-Clone Generator')?.point_cost, 20)

    const unitsWithEntropicHardpoints = enlightenedUnits
        .filter((unit) =>
            (unit.hardpoint_options.H ?? []).some((weapon) => weapon.name.startsWith('Entropic Generator with ')),
        )
        .map((unit) => unit.name)

    assert.deepEqual(unitsWithEntropicHardpoints, ['Agora', 'Copernicus', 'Lovelace', 'Chatelet'])

    const expectedEntropicHardpoints = [
        {
            name: 'Entropic Generator with Gun Battery',
            arc: null,
            firepower: { C: 2, S: 4, E: null },
            qualities: [
                { name: 'Entropic', value: null },
                { name: 'ESCF Munitions', value: null },
            ],
        },
        {
            name: 'Entropic Generator with Rocket Battery',
            arc: null,
            firepower: { C: null, S: 4, E: null },
            qualities: [
                { name: 'Barrage', value: null },
                { name: 'Entropic', value: null },
                { name: 'ESCF Munitions', value: null },
            ],
        },
        {
            name: 'Entropic Generator with Aetheric Lance',
            arc: null,
            firepower: { C: 4, S: 4, E: null },
            qualities: [
                { name: 'Entropic', value: null },
                { name: 'Precise', value: 1 },
            ],
        },
    ]

    for (const unitName of unitsWithEntropicHardpoints) {
        const unit = enlightenedUnits.find((candidate) => candidate.name === unitName)
        const entropicHardpoints = (unit?.hardpoint_options.H ?? []).filter((weapon) =>
            weapon.name.startsWith('Entropic Generator with '),
        )

        assert.deepEqual(entropicHardpoints, expectedEntropicHardpoints)
    }
})
