import assert from 'node:assert/strict'
import test from 'node:test'
import battlefleets from '../public/data/battlefleets.json' with { type: 'json' }
import factions from '../public/data/factions.json' with { type: 'json' }
import fleetDoctrines from '../public/data/fleet-doctrines.json' with { type: 'json' }
import generators from '../public/data/generators.json' with { type: 'json' }
import unitsIndex from '../public/data/units-index.json' with { type: 'json' }
import allianceUnits from '../public/data/units/alliance.json' with { type: 'json' }
import commonwealthUnits from '../public/data/units/commonwealth.json' with { type: 'json' }
import crownUnits from '../public/data/units/crown.json' with { type: 'json' }
import empireUnits from '../public/data/units/empire.json' with { type: 'json' }
import enlightenedUnits from '../public/data/units/enlightened.json' with { type: 'json' }
import imperiumUnits from '../public/data/units/imperium.json' with { type: 'json' }
import sultanateUnits from '../public/data/units/sultanate.json' with { type: 'json' }
import unionUnits from '../public/data/units/union.json' with { type: 'json' }

const unitDocuments = {
    'units/alliance.json': allianceUnits,
    'units/commonwealth.json': commonwealthUnits,
    'units/crown.json': crownUnits,
    'units/empire.json': empireUnits,
    'units/enlightened.json': enlightenedUnits,
    'units/imperium.json': imperiumUnits,
    'units/sultanate.json': sultanateUnits,
    'units/union.json': unionUnits,
}
const units = Object.values(unitDocuments).flat()

function assertUniqueIds(label: string, ids: string[]): void {
    assert.equal(new Set(ids).size, ids.length, `${label} IDs must remain unique because lists persist them`)
}

test('the builder index exposes every unit file exactly once', () => {
    assertUniqueIds('unit index file', unitsIndex.files)
    assert.deepEqual([...unitsIndex.files].sort(), Object.keys(unitDocuments).sort())
})

test('builder entities keep stable unique IDs and valid faction ownership', () => {
    const factionIds = new Set(factions.map((faction) => faction.id))

    assertUniqueIds(
        'faction',
        factions.map((faction) => faction.id),
    )
    assertUniqueIds(
        'unit',
        units.map((unit) => unit.id),
    )
    assertUniqueIds(
        'Battlefleet',
        battlefleets.map((battlefleet) => battlefleet.id),
    )

    for (const unit of units) {
        assert.ok(factionIds.has(unit.faction_id), `${unit.id} must reference an existing faction`)
    }
    for (const [factionId, factionGenerators] of Object.entries(generators)) {
        assert.ok(factionIds.has(factionId), `generator group ${factionId} must reference an existing faction`)
        assertUniqueIds(
            `${factionId} generator`,
            factionGenerators.map((generator) => generator.name),
        )
    }
    for (const [factionId, doctrines] of Object.entries(fleetDoctrines)) {
        assert.ok(factionIds.has(factionId), `doctrine group ${factionId} must reference an existing faction`)
        assertUniqueIds(
            `${factionId} doctrine`,
            doctrines.map((doctrine) => doctrine.name),
        )
    }
})

test('all cross-file unit and Battlefleet references resolve', () => {
    const factionIds = new Set(factions.map((faction) => faction.id))
    const unitIds = new Set(units.map((unit) => unit.id))

    for (const unit of units) {
        for (const option of unit.options_and_upgrades) {
            if (!('attachment_unit_ids' in option) || !Array.isArray(option.attachment_unit_ids)) continue
            for (const attachmentUnitId of option.attachment_unit_ids) {
                assert.ok(unitIds.has(attachmentUnitId), `${unit.id} attachment ${attachmentUnitId} must exist`)
            }
        }
    }

    for (const battlefleet of battlefleets) {
        assert.ok(factionIds.has(battlefleet.faction_id), `${battlefleet.id} must reference an existing faction`)
        for (const factionId of battlefleet.unitSourceFactionIds ?? []) {
            assert.ok(factionIds.has(factionId), `${battlefleet.id} source faction ${factionId} must exist`)
        }
        assertUniqueIds(
            `${battlefleet.id} element`,
            battlefleet.elements.map((element) => element.id),
        )
        for (const element of battlefleet.elements) {
            for (const requirement of element.requirements) {
                const requirementUnitIds = 'unitIds' in requirement ? (requirement.unitIds ?? []) : []
                for (const unitId of requirementUnitIds) {
                    assert.ok(unitIds.has(unitId), `${battlefleet.id} requirement unit ${unitId} must exist`)
                }
            }
        }
        for (const mainstay of battlefleet.additionalMainstays ?? []) {
            for (const unitId of mainstay.flagshipUnitIds) {
                assert.ok(unitIds.has(unitId), `${battlefleet.id} mainstay flagship ${unitId} must exist`)
            }
        }
    }
})

test('builder numeric limits cannot describe impossible selections', () => {
    for (const unit of units) {
        if (unit.point_cost_per_model != null) {
            assert.ok(unit.point_cost_per_model >= 0, `${unit.id} points cost must be non-negative`)
        }
        if (unit.min !== undefined && unit.max !== undefined) {
            assert.ok(unit.min <= unit.max, `${unit.id} minimum model count must not exceed its maximum`)
        }
        for (const option of unit.options_and_upgrades) {
            if (option.max !== null && option.max !== undefined) {
                assert.ok(option.max >= 0, `${unit.id} option ${option.tag} must have a non-negative maximum`)
            }
        }
    }
    for (const battlefleet of battlefleets) {
        for (const element of battlefleet.elements) {
            assert.ok(element.min >= 0, `${battlefleet.id} element ${element.id} must have a non-negative minimum`)
            assert.ok(
                element.min <= element.max,
                `${battlefleet.id} element ${element.id} minimum must not exceed maximum`,
            )
        }
    }
})
