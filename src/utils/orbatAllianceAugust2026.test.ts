import assert from 'node:assert/strict'
import test from 'node:test'
import allianceData from '../../public/data/units/alliance.json' with { type: 'json' }
import formations from '../../public/data/battlefleets.json' with { type: 'json' }
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig } from '../types/index.ts'
import {
    canAttachToParent,
    getAttachmentModelLimitForUnit,
    getMinimumModelsForAttachment,
    getMinimumModelsForUnit,
} from './attachments.ts'
import { validateBattlefleetOrganisation } from './battlefleets.ts'
import { parseImportedList } from './localStorage.ts'
import { computeArmyUnitTotal } from './pointsCalc.ts'

const units = allianceData as unknown as Unit[]
const unit = (id: string) => units.find((item) => item.id === id)!
const pugio = unit('alliance_pugio')
const config = (): UnitConfig => ({
    hardpointSelections: {},
    generatorSelection: null,
    fleetDoctrineSelection: null,
    optionQuantities: {},
})

function entry(id: string, count: number): ArmyUnit {
    return {
        instanceId: id,
        unitId: id,
        battlefleetInstanceId: 'fleet',
        config: config(),
        models: Array.from({ length: count }, (_, i) => ({ modelId: `${id}-${i}`, config: config() })),
        totalPoints: 0,
    }
}

function list(entries: ArmyUnit[]): ArmyList {
    return {
        id: 'alliance-update-test',
        name: 'Alliance update test',
        faction_id: 'alliance',
        units: entries,
        battlefleets: [{ instanceId: 'fleet', definitionId: 'alliance-main', name: 'Alliance' }],
        createdAt: '',
        updatedAt: '',
    }
}

test('the corrected Pugio formation fields agree on 2-4 standalone models at 55 points each', () => {
    assert.equal(pugio.models, '2-4')
    assert.equal(getMinimumModelsForUnit(pugio), 2)
    assert.equal(pugio.max, 4)
    assert.equal(computeArmyUnitTotal(entry(pugio.id, 2), units), 110)
    assert.equal(computeArmyUnitTotal(entry(pugio.id, 4), units), 220)
})

test('the explicitly retained Jupiter and Scorpio selection entries allow one attached Pugio without lowering the standalone minimum', () => {
    assert.equal(getMinimumModelsForUnit(pugio), 2)
    assert.equal(getMinimumModelsForAttachment(pugio), 1)
    assert.equal(getAttachmentModelLimitForUnit(pugio), 1)
    assert.ok(canAttachToParent(pugio, unit('alliance_jupiter')))
    assert.ok(canAttachToParent(pugio, unit('alliance_scorpio')))
    assert.equal(canAttachToParent(pugio, unit('alliance_pilum')), false)
})

test('import preserves a single attached Pugio while bringing a legacy standalone unit to two', () => {
    const parent = entry('alliance_jupiter', 1)
    const attachment = entry(pugio.id, 1)
    attachment.models[0]!.customName = 'Configured escort'
    parent.attachedUnits = [attachment]
    const imported = parseImportedList({ list: list([parent, entry(pugio.id, 1)]) }, units)!
    const importedParent = imported.units[0]!
    const importedAttachment = importedParent.attachedUnits![0]!
    assert.equal(importedAttachment.models.length, 1)
    assert.equal(importedAttachment.models[0]!.customName, 'Configured escort')
    assert.equal(computeArmyUnitTotal(importedParent, units), 170)
    assert.equal(imported.units[1]!.models.length, 2)
    assert.equal(computeArmyUnitTotal(imported.units[1]!, units), 110)
    const reimported = parseImportedList({ list: imported }, units)!
    assert.equal(reimported.units[0]!.attachedUnits![0]!.models.length, 1)
    assert.equal(computeArmyUnitTotal(reimported.units[0]!, units), 170)
})

test('a four-model standalone Pugio unit survives import without being truncated to the obsolete maximum of three', () => {
    const imported = parseImportedList({ list: list([entry(pugio.id, 4)]) }, units)!
    assert.equal(imported.units[0]!.models.length, 4)
    assert.equal(computeArmyUnitTotal(imported.units[0]!, units), 220)
})

test('oversized legacy Pugio attachments keep their model configurations and report the new limit instead of deleting models', () => {
    const parent = entry('alliance_jupiter', 1)
    parent.attachedUnits = [entry(pugio.id, 3)]
    const imported = parseImportedList({ list: list([parent]) }, units)!
    const child = imported.units[0]!.attachedUnits![0]!
    assert.equal(child.models.length, 3)
    const issue = validateBattlefleetOrganisation(imported, units, formations as BattlefleetDefinition[]).find(
        (item) => item.unitInstanceId === child.instanceId && item.message.includes('models as an Attachment'),
    )
    assert.equal(issue?.severity, 'error')
    assert.match(issue.message, /allowed 1/)
    child.models = child.models.slice(0, 1)
    assert.ok(
        !validateBattlefleetOrganisation(imported, units, formations as BattlefleetDefinition[]).some(
            (item) => item.unitInstanceId === child.instanceId && item.message.includes('models as an Attachment'),
        ),
    )
})
