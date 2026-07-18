import assert from 'node:assert/strict'
import test from 'node:test'
import { formatUnitPointCost, isUnitSelectable } from './unitHelpers.ts'

test('profiles without a Force Selection points entry remain browse-only', () => {
    const unavailableProfile = { point_cost_per_model: null }

    assert.equal(isUnitSelectable(unavailableProfile), false)
    assert.equal(formatUnitPointCost(unavailableProfile), 'Unavailable')
})

test('a priced profile can be selected for a force', () => {
    const selectableProfile = { point_cost_per_model: 70 }

    assert.equal(isUnitSelectable(selectableProfile), true)
    assert.equal(formatUnitPointCost(selectableProfile), '70 pts')
})
