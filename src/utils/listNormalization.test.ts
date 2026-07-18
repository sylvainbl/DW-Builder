import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSavedListsIndependently } from './listNormalization.ts'

test('one incompatible saved list does not prevent the other lists from being updated', (t) => {
    const originalWarn = console.warn
    const warnings: unknown[][] = []
    console.warn = (...args: unknown[]) => warnings.push(args)
    t.after(() => {
        console.warn = originalWarn
    })

    const lists = [
        { name: 'Healthy list', version: 1 },
        { name: 'Older list', version: 0 },
    ]
    const normalized = normalizeSavedListsIndependently(lists, (list) => {
        if (list.version === 0) throw new Error('Unsupported saved shape')
        return { ...list, version: 2 }
    })

    assert.deepEqual(normalized, [
        { name: 'Healthy list', version: 2 },
        { name: 'Older list', version: 0 },
    ])
    assert.equal(warnings.length, 1)
    assert.match(String(warnings[0][0]), /Older list/)
})
