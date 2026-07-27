import assert from 'node:assert/strict'
import test from 'node:test'
import type { ArmyList } from '../types/index.ts'
import { renameArmyListState } from './listNames.ts'

function makeList(id: string, name: string): ArmyList {
    return {
        id,
        name,
        faction_id: 'alliance',
        units: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    }
}

test('renaming a closed list preserves it instead of copying the open list over it', () => {
    const openList = makeList('open-list', 'Open list')
    const closedList = makeList('closed-list', 'Closed list')

    const state = renameArmyListState(
        {
            currentList: openList,
            savedLists: [openList, closedList],
        },
        closedList.id,
        'Renamed list',
        '2026-07-27T17:31:00.000Z',
    )

    assert.equal(state.currentList?.id, openList.id)
    assert.equal(state.currentList?.name, openList.name)
    assert.deepEqual(
        state.savedLists.map(({ id, name }) => ({ id, name })),
        [
            { id: openList.id, name: openList.name },
            { id: closedList.id, name: 'Renamed list' },
        ],
    )
})
