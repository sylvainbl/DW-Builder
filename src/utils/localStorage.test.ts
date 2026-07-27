import assert from 'node:assert/strict'
import test from 'node:test'
import type { ArmyList, Unit, UnitConfig } from '../types/index.ts'
import { loadListsFromStorage, parseImportedList } from './localStorage.ts'
import { normalizeLegacyFactionId, normalizeLegacyUnitId, selectStoredListsValue } from './storageMigration.ts'

const legacyList = {
    id: 'legacy-list',
    name: 'Legacy list',
    faction_id: 'crown',
    units: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
}

test('an empty current store stays authoritative so deleted legacy lists do not reappear', () => {
    assert.equal(selectStoredListsValue('[]', JSON.stringify([legacyList])), '[]')
})

test('legacy lists are migrated only when the current storage key does not exist', () => {
    const legacy = JSON.stringify([legacyList])
    assert.equal(selectStoredListsValue(null, legacy), legacy)
})

test('legacy faction and unit identifiers keep their established migration mapping', () => {
    assert.equal(normalizeLegacyFactionId('Enlighted'), 'enlightened')
    assert.equal(normalizeLegacyFactionId('union'), 'union')
    assert.equal(normalizeLegacyUnitId('Crown_Victory'), 'crown_Victory')
    assert.equal(normalizeLegacyUnitId('union_constitution'), 'union_constitution')
})

test('blocked browser storage does not prevent the application from loading', (t) => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    const originalWarn = console.warn
    const warnings: unknown[][] = []
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: {
            getItem: () => {
                throw new DOMException('Access denied', 'SecurityError')
            },
        },
    })
    console.warn = (...args: unknown[]) => warnings.push(args)
    t.after(() => {
        console.warn = originalWarn
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage)
        else Reflect.deleteProperty(globalThis, 'localStorage')
    })

    assert.deepEqual(loadListsFromStorage(), [])
    assert.equal(warnings.length, 1)
})

test('malformed nested entries in an imported list are ignored instead of crashing the import', () => {
    const unit = {
        id: 'test-unit',
        faction_id: 'test',
        name: 'Test Unit',
        sub_name: 'Test Class',
        faction: 'Test',
        role: 'Support',
        point_cost_per_model: 10,
        vpr: 0,
        models: 1,
        min: 1,
        max: 1,
        tags: [],
        stats: { MAS: 1, SPD: '1"', TRN: 1, DEF: 1, ARM: 1, HUL: 1, ACT: 1, BRD: 1, REP: 1, CRW: 1 },
        properties: [],
        systems: [],
        weapons: [],
        hardpoint_options: {},
        options_and_upgrades: [],
        lore: '',
        version: 'test',
        date: 'test',
    } satisfies Unit
    const imported = {
        ...legacyList,
        faction_id: 'test',
        units: [{ unitId: 42 }, { unitId: unit.id, config: makeConfig(), models: [] }],
    } as unknown as ArmyList

    const result = parseImportedList({ list: imported }, [unit])

    assert.equal(result?.units.length, 1)
    assert.equal(result?.units[0]?.unitId, unit.id)
})

function makeConfig(): UnitConfig {
    return {
        hardpointSelections: {},
        generatorSelection: null,
        fleetDoctrineSelection: null,
        optionQuantities: {},
    }
}
