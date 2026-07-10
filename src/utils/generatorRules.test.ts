import assert from 'node:assert/strict'
import test from 'node:test'
import type { UnitConfig } from '../types/index'
import { canSelectGeneratorInSlot, getGeneratorChoicesForSlot } from './generatorRules.ts'
import generators from '../../public/data/generators.json' with { type: 'json' }

const selections: NonNullable<UnitConfig['generatorSelections']> = [
    { weaponIndex: -1, generatorName: 'Atomic Generator', generatorCost: 5 },
    { weaponIndex: -1, generatorName: 'Entropic Generator', generatorCost: 0 },
]

test('a model cannot mount the same ordinary generator more than once', () => {
    assert.equal(canSelectGeneratorInSlot(selections, 1, 'Atomic Generator'), false)
})

test('an Entropic Generator remains selectable once one is already mounted', () => {
    assert.equal(canSelectGeneratorInSlot(selections, 0, 'Entropic Generator'), true)
})

test('the current ordinary generator remains available in its own slot', () => {
    const choices = getGeneratorChoicesForSlot([
        { name: 'Atomic Generator', point_cost: 5 },
        { name: 'Fury Generator', point_cost: 20 },
    ], selections, 0)

    assert.deepEqual(choices.map((generator) => generator.name), ['Atomic Generator', 'Fury Generator'])
})

test('each Entropic Generator offers the three weapon profiles required by its rule', () => {
    const entropicGenerator = generators.enlightened.find((generator) => generator.name === 'Entropic Generator')

    assert.deepEqual(entropicGenerator?.weapon_choices, [
        {
            name: 'Advanced Aetheric Lance',
            arc: '—',
            firepower: { C: 4, S: 4, E: null },
            qualities: [{ name: 'Precise', value: 1 }],
        },
        {
            name: 'ESCF Light Gun Battery',
            arc: '—',
            firepower: { C: 2, S: 4, E: null },
            qualities: [{ name: 'ESCF Munitions', value: null }],
        },
        {
            name: 'ESCF Light Rocket Battery',
            arc: '—',
            firepower: { C: null, S: 4, E: null },
            qualities: [
                { name: 'Barrage', value: null },
                { name: 'ESCF Munitions', value: null },
            ],
        },
    ])
})
