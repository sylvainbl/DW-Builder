import assert from 'node:assert/strict'
import test from 'node:test'
import { selectStoredListsValue } from './storageMigration.ts'

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
