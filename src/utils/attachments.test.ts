import assert from 'node:assert/strict'
import test from 'node:test'
import type { Unit } from '../types/index'
import { canAttachToParent, getAttachmentEligibilityFailure, hasAttachmentProperty } from './attachments.ts'

function makeUnit(id: string, tags: string[], overrides: Partial<Unit> = {}): Unit {
    return {
        id,
        faction_id: 'test',
        name: id,
        sub_name: 'Test Class',
        faction: 'Test',
        role: 'Support',
        point_cost_per_model: 1,
        vpr: 0,
        models: 1,
        tags,
        stats: { MAS: 1, SPD: '1"', TRN: 1, DEF: 1, ARM: 1, HUL: 1, ACT: 1, BRD: 1, REP: 1, CRW: 1 },
        properties: [],
        systems: [],
        weapons: [],
        hardpoint_options: {},
        options_and_upgrades: [],
        lore: '',
        version: 'test',
        date: 'test',
        ...overrides,
    }
}

function makeAttachment(id: string, parentTraits: string[], tags = ['Surface']): Unit {
    return makeUnit(id, tags, {
        properties: [{ name: 'Attachment', value: null, detail: parentTraits.join(', ') }],
        attachment: { parent_traits: parentTraits },
    })
}

test('a unit with the Attachment property can never be a Parent Unit', () => {
    const attachment = makeAttachment('child', ['Support'])
    const parent = makeAttachment('parent', ['Support'])

    assert.equal(hasAttachmentProperty(parent), true)
    assert.equal(getAttachmentEligibilityFailure(attachment, parent), 'parent-is-attachment')
    assert.equal(canAttachToParent(attachment, parent), false)
})

test('an Attachment must share its effective Positional Trait with its Parent Unit', () => {
    const attachment = makeAttachment('child', ['Flagship'], ['Airborne', 'Airship'])
    const airborneParent = makeUnit('air-parent', ['Airborne', 'Rotorcraft', 'Flagship'])
    const surfaceParent = makeUnit('surface-parent', ['Surface', 'Flagship'])

    assert.equal(canAttachToParent(attachment, airborneParent), true)
    assert.equal(getAttachmentEligibilityFailure(attachment, surfaceParent), 'positional-trait')
    assert.equal(
        canAttachToParent(attachment, surfaceParent, {
            attachmentTags: ['Surface'],
            parentTags: ['Surface', 'Flagship'],
        }),
        true,
    )
})

test('Attachment requirements support AND groups and slash-separated alternatives', () => {
    const attachment = makeAttachment('child', ['French / Portuguese', 'Flagship'])
    const frenchFlagship = makeUnit('french', ['Surface', 'French', 'Flagship'])
    const portugueseFlagship = makeUnit('portuguese', ['Surface', 'Portuguese', 'Flagship'])
    const frenchSupport = makeUnit('support', ['Surface', 'French', 'Support'])

    assert.equal(canAttachToParent(attachment, frenchFlagship), true)
    assert.equal(canAttachToParent(attachment, portugueseFlagship), true)
    assert.equal(getAttachmentEligibilityFailure(attachment, frenchSupport), 'parent-traits')
})

test('explicit Attachment eligibility accepts any matching branch and still requires positional compatibility', () => {
    const attachment = makeAttachment('child', ['British Flagship', 'Canadian Flagship'])
    attachment.attachment = {
        parent_traits: ['British Flagship', 'Canadian Flagship'],
        eligibility: {
            anyOf: [{ allOfTags: ['British', 'Flagship'] }, { allOfTags: ['Canadian', 'Flagship'] }],
        },
    }
    const canadianFlagship = makeUnit('canadian', ['Surface', 'Canadian', 'Flagship'])
    const airborneCanadianFlagship = makeUnit('air-canadian', ['Airborne', 'Canadian', 'Flagship'])

    assert.equal(canAttachToParent(attachment, canadianFlagship), true)
    assert.equal(getAttachmentEligibilityFailure(attachment, airborneCanadianFlagship), 'positional-trait')
})

test('a Parent Unit attachment option restricts which Attachment profile it can receive', () => {
    const allowed = makeAttachment('allowed', ['Support'])
    const other = makeAttachment('other', ['Support'])
    const parent = makeUnit('parent', ['Surface', 'Support'], {
        options_and_upgrades: [
            {
                description: 'Add the allowed unit as an Attachment',
                cost_per_unit: 0,
                max: 1,
                tag: 'ADD_ALLOWED',
                attachment_unit_ids: ['allowed'],
            },
        ],
    })

    assert.equal(canAttachToParent(allowed, parent), true)
    assert.equal(getAttachmentEligibilityFailure(other, parent), 'parent-option')
})

test('an Attachment cannot target its own profile or a Parent Unit from another ORBAT', () => {
    const attachment = makeAttachment('same', ['Support'])
    const sameProfile = makeUnit('same', ['Surface', 'Support'])
    const otherFaction = makeUnit('other', ['Surface', 'Support'], { faction_id: 'other' })

    assert.equal(getAttachmentEligibilityFailure(attachment, sameProfile), 'same-unit')
    assert.equal(getAttachmentEligibilityFailure(attachment, otherFaction), 'different-faction')
})

test('runtime profiles with a missing optional sub-name do not break Attachment eligibility', () => {
    const attachment = makeAttachment('child', ['Support'])
    const parent = makeUnit('parent', ['Surface', 'Support'], { sub_name: null as unknown as string })

    assert.equal(canAttachToParent(attachment, parent), true)
})
