import assert from 'node:assert/strict'
import test from 'node:test'
import type { ArmyModel } from '../types/index.ts'
import { duplicateArmyModel } from './modelHelpers.ts'

test('duplicating a model preserves its complete configuration with a new identity', () => {
    const source: ArmyModel = {
        modelId: 'source-model',
        customName: 'Le Temeraire',
        config: {
            hardpointSelections: { 0: 'Heat Lance' },
            generatorSelection: {
                weaponIndex: 1,
                generatorName: 'Francisco Solex Generator',
                generatorCost: 20,
            },
            fleetDoctrineSelection: null,
            optionQuantities: { TEST_OPTION: 1 },
        },
    }

    const duplicate = duplicateArmyModel(source, 'duplicate-model')

    assert.deepEqual(duplicate, {
        ...source,
        modelId: 'duplicate-model',
    })
    assert.notEqual(duplicate.config, source.config)
    assert.notEqual(duplicate.config.hardpointSelections, source.config.hardpointSelections)
    assert.notEqual(duplicate.config.optionQuantities, source.config.optionQuantities)
})
