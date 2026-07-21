import assert from 'node:assert/strict'
import test from 'node:test'
import type { ArmyList, ArmyUnit, BattlefleetDefinition, Unit, UnitConfig } from '../types/index'
import { validateBattlefleetOrganisation } from './battlefleets.ts'

const battlefleetInstanceId = 'battlefleet-1'

function makeConfig(optionQuantities: Record<string, number> = {}): UnitConfig {
    return {
        hardpointSelections: {},
        generatorSelection: null,
        fleetDoctrineSelection: null,
        optionQuantities,
    }
}

function makeUnit(id: string, name: string, tags: string[], overrides: Partial<Unit> = {}): Unit {
    return {
        id,
        faction_id: 'test',
        name,
        sub_name: 'Test Class',
        faction: 'Test',
        role: 'Support',
        point_cost_per_model: 1,
        vpr: 0,
        models: 1,
        tags: ['Test', ...tags],
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

function makeAttachmentUnit(id: string, name: string, parentTraits = ['Carrier'], tags = ['Surface']): Unit {
    return makeUnit(id, name, tags, {
        properties: [{ name: 'Attachment', value: null, detail: parentTraits.join(', ') }],
        attachment: { parent_traits: parentTraits },
    })
}

function makeEntry(
    unitId: string,
    instanceId: string,
    attachedUnits: ArmyUnit[] = [],
    modelConfig: UnitConfig = makeConfig(),
): ArmyUnit {
    return {
        instanceId,
        unitId,
        battlefleetInstanceId,
        config: makeConfig(),
        models: [{ modelId: `${instanceId}-model`, config: modelConfig }],
        totalPoints: 1,
        attachedUnits: attachedUnits.length > 0 ? attachedUnits : undefined,
    }
}

function makeDefinition(overrides: Partial<BattlefleetDefinition> = {}): BattlefleetDefinition {
    return {
        id: 'test-main',
        faction_id: 'test',
        name: 'Test Main Battlefleet',
        type: 'main',
        elements: [
            {
                id: 'support',
                name: 'Support Element',
                min: 0,
                max: 20,
                requirements: [{ any: ['Test'] }],
            },
        ],
        ...overrides,
    }
}

function validate(entries: ArmyUnit[], units: Unit[], definition = makeDefinition()) {
    const list: ArmyList = {
        id: 'list',
        name: 'Test Force',
        faction_id: 'test',
        battlefleets: [
            {
                instanceId: battlefleetInstanceId,
                definitionId: definition.id,
                name: definition.name,
            },
        ],
        units: entries,
        createdAt: 'test',
        updatedAt: 'test',
    }
    return validateBattlefleetOrganisation(list, units, [definition])
}

function makeParent(id: string): Unit {
    return makeUnit(id, id, ['Surface', 'Carrier'])
}

test('a valid Parent and Attachment relationship produces no organisation issue', () => {
    const parent = makeParent('parent')
    const attachment = makeAttachmentUnit('attachment', 'Attachment Class')
    const entries = [makeEntry(parent.id, 'parent-entry', [makeEntry(attachment.id, 'attachment-entry')])]

    assert.deepEqual(validate(entries, [parent, attachment]), [])
})

test('a standalone unit with Attachment (X) cannot become a Parent Unit', () => {
    const parent = makeAttachmentUnit('parent', 'Parent Attachment', ['Carrier'])
    parent.tags.push('Carrier')
    const attachment = makeAttachmentUnit('attachment', 'Child Attachment', ['Carrier'])
    const entries = [makeEntry(parent.id, 'parent-entry', [makeEntry(attachment.id, 'attachment-entry')])]

    assert.ok(
        validate(entries, [parent, attachment]).some((issue) => issue.message.includes('cannot be a Parent Unit')),
    )
})

test('saved relationships are rejected when Positional Traits or required Parent Traits do not match', () => {
    const parent = makeUnit('parent', 'Parent', ['Surface', 'Support'])
    const airborneAttachment = makeAttachmentUnit('air-child', 'Air Child', ['Support'], ['Airborne'])
    const carrierAttachment = makeAttachmentUnit('carrier-child', 'Carrier Child', ['Carrier'])

    const positionalIssues = validate(
        [makeEntry(parent.id, 'parent-entry', [makeEntry(airborneAttachment.id, 'air-entry')])],
        [parent, airborneAttachment],
    )
    assert.ok(positionalIssues.some((issue) => issue.message.includes('same Positional Trait')))

    const traitIssues = validate(
        [makeEntry(parent.id, 'parent-entry', [makeEntry(carrierAttachment.id, 'carrier-entry')])],
        [parent, carrierAttachment],
    )
    assert.ok(traitIssues.some((issue) => issue.message.includes('does not have the Trait(s) required')))
})

test('selected option tags are used when validating an Attachment relationship', () => {
    const parent = makeUnit('parent', 'Parent', ['Surface'], {
        options_and_upgrades: [
            {
                description: 'Become a Carrier',
                cost_per_unit: 0,
                max: 1,
                tag: 'BECOME_CARRIER',
                adds_tags: ['Carrier'],
            },
        ],
    })
    const attachment = makeAttachmentUnit('attachment', 'Attachment')
    const configuredParent = makeEntry(
        parent.id,
        'parent-entry',
        [makeEntry(attachment.id, 'attachment-entry')],
        makeConfig({ BECOME_CARRIER: 1 }),
    )

    assert.deepEqual(validate([configuredParent], [parent, attachment]), [])
})

test('a Parent Unit can have only one normal Attachment', () => {
    const parent = makeParent('parent')
    const first = makeAttachmentUnit('first', 'First')
    const second = makeAttachmentUnit('second', 'Second')
    const entry = makeEntry(parent.id, 'parent-entry', [
        makeEntry(first.id, 'first-entry'),
        makeEntry(second.id, 'second-entry'),
    ])

    assert.ok(validate([entry], [parent, first, second]).some((issue) => issue.message.includes('can only have one')))
})

test('an Attachment cannot itself contain another Attachment', () => {
    const parent = makeParent('parent')
    const attachment = makeAttachmentUnit('attachment', 'Attachment')
    attachment.tags.push('Carrier')
    const nested = makeAttachmentUnit('nested', 'Nested')
    const nestedEntry = makeEntry(attachment.id, 'attachment-entry', [makeEntry(nested.id, 'nested-entry')])

    const issues = validate([makeEntry(parent.id, 'parent-entry', [nestedEntry])], [parent, attachment, nested])
    assert.ok(issues.some((issue) => issue.message.includes('is fielded as an Attachment and cannot be a Parent Unit')))
})

test('ordinary Duplicate Classes allow one standalone unit and one Attachment, but not two of either kind', () => {
    const parentA = makeParent('parent-a')
    const parentB = makeParent('parent-b')
    const standaloneA = makeUnit('standalone-a', 'Scout', ['Surface'])
    const standaloneB = makeUnit('standalone-b', 'Scout', ['Surface'])
    const attachmentA = makeAttachmentUnit('attachment-a', 'Scout')
    const attachmentB = makeAttachmentUnit('attachment-b', 'Scout')

    const validEntries = [
        makeEntry(standaloneA.id, 'standalone-a-entry'),
        makeEntry(parentA.id, 'parent-a-entry', [makeEntry(attachmentA.id, 'attachment-a-entry')]),
    ]
    assert.deepEqual(validate(validEntries, [parentA, standaloneA, attachmentA]), [])

    const standaloneIssues = validate(
        [makeEntry(standaloneA.id, 'standalone-a-entry'), makeEntry(standaloneB.id, 'standalone-b-entry')],
        [standaloneA, standaloneB],
    )
    assert.ok(standaloneIssues.some((issue) => issue.message.includes('2 standalone and 0 Attachment Scout')))

    const attachmentIssues = validate(
        [
            makeEntry(parentA.id, 'parent-a-entry', [makeEntry(attachmentA.id, 'attachment-a-entry')]),
            makeEntry(parentB.id, 'parent-b-entry', [makeEntry(attachmentB.id, 'attachment-b-entry')]),
        ],
        [parentA, parentB, attachmentA, attachmentB],
    )
    assert.ok(attachmentIssues.some((issue) => issue.message.includes('0 standalone and 2 Attachment Scout')))
})

test('Mainstay Classes allow two standalone units and two Attachments, enforcing each side independently', () => {
    const parents = [makeParent('parent-a'), makeParent('parent-b'), makeParent('parent-c')]
    const standalones = [
        makeUnit('standalone-a', 'Scout', ['Surface']),
        makeUnit('standalone-b', 'Scout', ['Surface']),
        makeUnit('standalone-c', 'Scout', ['Surface']),
    ]
    const attachments = [
        makeAttachmentUnit('attachment-a', 'Scout'),
        makeAttachmentUnit('attachment-b', 'Scout'),
        makeAttachmentUnit('attachment-c', 'Scout'),
    ]
    const definition = makeDefinition({ mainstayClassNames: ['Scout'] })
    const validEntries = [
        makeEntry(standalones[0]!.id, 'standalone-a-entry'),
        makeEntry(standalones[1]!.id, 'standalone-b-entry'),
        makeEntry(parents[0]!.id, 'parent-a-entry', [makeEntry(attachments[0]!.id, 'attachment-a-entry')]),
        makeEntry(parents[1]!.id, 'parent-b-entry', [makeEntry(attachments[1]!.id, 'attachment-b-entry')]),
    ]
    assert.deepEqual(validate(validEntries, [...parents, ...standalones, ...attachments], definition), [])

    const tooManyStandalone = standalones.map((unit, index) => makeEntry(unit.id, `standalone-${index}-entry`))
    assert.ok(
        validate(tooManyStandalone, [...parents, ...standalones, ...attachments], definition).some((issue) =>
            issue.message.includes('3 standalone and 0 Attachment Scout'),
        ),
    )

    const tooManyAttachments = parents.map((parent, index) =>
        makeEntry(parent.id, `parent-${index}-entry`, [makeEntry(attachments[index]!.id, `attachment-${index}-entry`)]),
    )
    assert.ok(
        validate(tooManyAttachments, [...parents, ...standalones, ...attachments], definition).some((issue) =>
            issue.message.includes('0 standalone and 3 Attachment Scout'),
        ),
    )
})

test('Additional Mainstay Classes use the same two-plus-two limits when their Flagship is present', () => {
    const flagship = makeUnit('flagship', 'Flagship', ['Surface', 'Flagship'])
    const scouts = [makeUnit('scout-a', 'Scout', ['Surface']), makeUnit('scout-b', 'Scout', ['Surface'])]
    const definition = makeDefinition({
        additionalMainstays: [{ flagshipUnitIds: [flagship.id], classNames: ['Scout'] }],
    })

    assert.deepEqual(
        validate(
            [
                makeEntry(flagship.id, 'flagship-entry'),
                makeEntry(scouts[0]!.id, 'scout-a-entry'),
                makeEntry(scouts[1]!.id, 'scout-b-entry'),
            ],
            [flagship, ...scouts],
            definition,
        ),
        [],
    )
})

test('generated option entries do not count as Attachments or Duplicate Classes', () => {
    const parent = makeParent('parent')
    const standalone = makeUnit('standalone', 'Scout', ['Surface'])
    const attachment = makeAttachmentUnit('attachment', 'Scout')
    const generatedUnit = makeUnit('generated', 'Scout', ['Surface'])
    const generatedEntry = makeEntry(generatedUnit.id, 'generated-entry')
    generatedEntry.generatedByOption = { parentInstanceId: 'parent-entry', optionTag: 'TETHERED_BANGPAE' }

    assert.deepEqual(
        validate(
            [
                makeEntry(standalone.id, 'standalone-entry'),
                makeEntry(parent.id, 'parent-entry', [makeEntry(attachment.id, 'attachment-entry'), generatedEntry]),
            ],
            [parent, standalone, attachment, generatedUnit],
        ),
        [],
    )
})

test('existing Duplicate Classes exemptions remain effective', () => {
    const ordinary = makeUnit('ordinary', 'Cruiser', ['Surface'])
    const francisco = makeUnit('alliance_francisco', 'Cruiser', ['Surface'])
    const barbudos = makeDefinition({ specialRules: ['barbudos-cruiser-flagship'] })
    assert.deepEqual(
        validate(
            [makeEntry(francisco.id, 'francisco-entry'), makeEntry(ordinary.id, 'ordinary-entry')],
            [francisco, ordinary],
            barbudos,
        ),
        [],
    )

    const akula = makeUnit('commonwealth_akula', 'Akula', ['Surface'])
    const otherAkula = makeUnit('other-akula', 'Akula', ['Surface'])
    const ukrainian = makeDefinition({ specialRules: ['ukrainian-akula-flagship'] })
    assert.deepEqual(
        validate(
            [makeEntry(akula.id, 'akula-entry'), makeEntry(otherAkula.id, 'other-akula-entry')],
            [akula, otherAkula],
            ukrainian,
        ),
        [],
    )

    const tianlongA = makeUnit('tianlong-a', 'Tianlong', ['Surface'])
    const tianlongB = makeUnit('tianlong-b', 'Tianlong', ['Surface'])
    const tianlongC = makeUnit('tianlong-c', 'Tianlong', ['Surface'])
    const dragonsWrath = makeDefinition({ specialRules: ['empire-tianlong-flagship-no-doctrine'] })
    assert.deepEqual(
        validate(
            [makeEntry(tianlongA.id, 'a-entry'), makeEntry(tianlongB.id, 'b-entry')],
            [tianlongA, tianlongB],
            dragonsWrath,
        ),
        [],
    )
    assert.ok(
        validate(
            [
                makeEntry(tianlongA.id, 'a-entry'),
                makeEntry(tianlongB.id, 'b-entry'),
                makeEntry(tianlongC.id, 'c-entry'),
            ],
            [tianlongA, tianlongB, tianlongC],
            dragonsWrath,
        ).some((issue) => issue.message.includes("Dragon's Wrath allows up to two Tianlong")),
    )
})
