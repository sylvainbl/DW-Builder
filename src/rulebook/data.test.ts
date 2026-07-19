import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import actionsDocument from '../../public/data/actions.json' with { type: 'json' }
import encountersDocument from '../../public/data/encounters.json' with { type: 'json' }
import manifestDocument from '../../public/data/manifest.json' with { type: 'json' }
import navigationDocument from '../../public/data/navigation.json' with { type: 'json' }
import proceduresDocument from '../../public/data/procedures.json' with { type: 'json' }
import referencesDocument from '../../public/data/references.json' with { type: 'json' }
import ruleBlocksDocument from '../../public/data/rule-blocks.json' with { type: 'json' }
import sectionsDocument from '../../public/data/sections.json' with { type: 'json' }
import tablesDocument from '../../public/data/tables.json' with { type: 'json' }
import terrainDocument from '../../public/data/terrain.json' with { type: 'json' }
import tokensDocument from '../../public/data/tokens.json' with { type: 'json' }
import visualsDocument from '../../public/data/visuals.json' with { type: 'json' }
import {
    buildRulebookIndexes,
    buildRulebookSearchIndex,
    flattenNavigation,
    formatIdentifier,
    getProcedureStepText,
    getRulebookHref,
    getRuleInlineSegments,
    getRuleTextBlocks,
    hasRenderableRuleContent,
    normalizeSearchText,
    resolveSectionRuleBlocks,
    searchRulebook,
} from './data.ts'
import { RULEBOOK_INDEX_GROUPS } from './index.ts'
import type { RulebookData } from './types.ts'

const data: RulebookData = {
    manifest: manifestDocument,
    navigation: navigationDocument.chapters,
    sections: sectionsDocument.sections,
    ruleBlocks: ruleBlocksDocument.ruleBlocks,
    tables: tablesDocument.tables,
    procedures: proceduresDocument.procedures,
    actions: actionsDocument.actions,
    tokens: tokensDocument.tokens,
    criticalDamageEffects: tokensDocument.criticalDamageEffects,
    terrain: terrainDocument,
    encounters: encountersDocument.encounters,
    pageReferenceLinks: referencesDocument.pageReferenceLinks,
    semanticLinks: referencesDocument.semanticLinks,
    visuals: visualsDocument.visuals,
}

function assertUniqueIds(label: string, ids: string[]): void {
    assert.equal(new Set(ids).size, ids.length, `${label} IDs must stay unique so links remain stable`)
}

function readWebpDimensions(assetUrl: URL): { width: number; height: number } {
    const content = readFileSync(assetUrl)
    assert.equal(content.toString('ascii', 0, 4), 'RIFF')
    assert.equal(content.toString('ascii', 8, 12), 'WEBP')

    let offset = 12
    while (offset + 8 <= content.length) {
        const chunkType = content.toString('ascii', offset, offset + 4)
        const chunkLength = content.readUInt32LE(offset + 4)
        const dataOffset = offset + 8
        if (chunkType === 'VP8 ') {
            return {
                width: content.readUInt16LE(dataOffset + 6) & 0x3fff,
                height: content.readUInt16LE(dataOffset + 8) & 0x3fff,
            }
        }
        offset = dataOffset + chunkLength + (chunkLength % 2)
    }
    throw new Error(`${assetUrl.pathname} does not contain a supported VP8 image chunk`)
}

test('canonical rulebook entities keep unique stable IDs', () => {
    assertUniqueIds(
        'section',
        data.sections.map((item) => item.id),
    )
    assertUniqueIds(
        'rule',
        data.ruleBlocks.map((item) => item.id),
    )
    assertUniqueIds(
        'table',
        data.tables.map((item) => item.id),
    )
    assertUniqueIds(
        'procedure',
        data.procedures.map((item) => item.id),
    )
    assertUniqueIds(
        'action',
        data.actions.map((item) => item.id),
    )
    assertUniqueIds(
        'token',
        data.tokens.map((item) => item.id),
    )
    assertUniqueIds(
        'encounter',
        data.encounters.map((item) => item.id),
    )
    assertUniqueIds(
        'visual',
        data.visuals.map((item) => item.id),
    )
})

test('navigation and gameplay modules only reference canonical entities that exist', () => {
    const indexes = buildRulebookIndexes(data)
    const navigationItems = flattenNavigation(data.navigation)
    const actionIds = new Set(data.actions.map((item) => item.id))
    const tokenIds = new Set(data.tokens.map((item) => item.id))
    const markerIds = new Set(data.terrain.markers.map((item) => item.id))
    const encounterIds = new Set(data.encounters.map((item) => item.id))

    for (const item of navigationItems) {
        assert.ok(indexes.sectionById.has(item.sectionId), `navigation target ${item.sectionId} must resolve`)
    }
    for (const section of data.sections) {
        for (const ruleId of section.ruleBlockIds)
            assert.ok(indexes.ruleById.has(ruleId), `${section.id} rule ${ruleId} must resolve`)
        for (const tableId of section.tableIds)
            assert.ok(indexes.tableById.has(tableId), `${section.id} table ${tableId} must resolve`)
    }
    for (const procedure of data.procedures) {
        if (procedure.ruleBlockId) assert.ok(indexes.ruleById.has(procedure.ruleBlockId))
        for (const step of procedure.steps) {
            if (step.ruleBlockId)
                assert.ok(indexes.ruleById.has(step.ruleBlockId), `${procedure.id} step ${step.order} must resolve`)
        }
    }
    for (const action of data.actions) {
        if (action.ruleBlockId)
            assert.ok(indexes.ruleById.has(action.ruleBlockId), `${action.id} canonical rule must resolve`)
        if (action.procedureId)
            assert.ok(indexes.procedureById.has(action.procedureId), `${action.id} procedure must resolve`)
    }
    for (const reference of data.pageReferenceLinks) {
        const targetSection = indexes.sectionById.get(reference.targetSectionId)
        assert.ok(targetSection, `${reference.id} section target must resolve`)
        assert.ok(
            targetSection.source.printedPages.includes(reference.targetPrintedPage),
            `${reference.id} printed page must belong to its target section`,
        )
        assert.equal(reference.label, reference.label.trim(), `${reference.id} label must not have outer whitespace`)
        assert.doesNotMatch(reference.label, /^\W/, `${reference.id} label must not start with stray punctuation`)
        assert.doesNotMatch(reference.label, /\s{2,}|MISSING TARGETS/, `${reference.id} label must be clean`)
        assert.equal(
            [...reference.label].filter((character) => character === '(').length,
            [...reference.label].filter((character) => character === ')').length,
            `${reference.id} label parentheses must be balanced`,
        )
        if (reference.targetRuleBlockId) {
            const targetRule = indexes.ruleById.get(reference.targetRuleBlockId)
            assert.ok(targetRule, `${reference.id} rule target must resolve`)
            assert.ok(
                reference.targetPrintedPage >= targetRule.printedPageStart &&
                    reference.targetPrintedPage <= targetRule.printedPageEnd,
                `${reference.id} printed page must belong to its target rule`,
            )
        }
    }
    for (const visual of data.visuals) {
        for (const id of visual.relatedRuleIds ?? [])
            assert.ok(indexes.ruleById.has(id), `${visual.id} rule target must resolve`)
        for (const id of visual.relatedSectionIds ?? [])
            assert.ok(indexes.sectionById.has(id), `${visual.id} section target must resolve`)
        for (const id of visual.relatedProcedureIds ?? [])
            assert.ok(indexes.procedureById.has(id), `${visual.id} procedure target must resolve`)
        for (const id of visual.relatedActionIds ?? [])
            assert.ok(actionIds.has(id), `${visual.id} action target must resolve`)
        for (const id of visual.relatedTokenIds ?? [])
            assert.ok(tokenIds.has(id), `${visual.id} token target must resolve`)
        for (const id of visual.relatedMarkerIds ?? [])
            assert.ok(markerIds.has(id), `${visual.id} marker target must resolve`)
        for (const id of visual.relatedEncounterIds ?? [])
            assert.ok(encounterIds.has(id), `${visual.id} encounter target must resolve`)
    }
})

test('section rendering deduplicates canonical rules even if an index repeats an ID', () => {
    const indexes = buildRulebookIndexes(data)
    const section = data.sections.find((item) => item.ruleBlockIds.length > 0)
    assert.ok(section)
    const firstRuleId = section.ruleBlockIds[0]
    assert.ok(firstRuleId)
    const duplicatedSection = { ...section, ruleBlockIds: [firstRuleId, firstRuleId] }

    assert.deepEqual(
        resolveSectionRuleBlocks(duplicatedSection, indexes).map((rule) => rule.id),
        [firstRuleId],
    )
})

test('each section keeps its own content while the explicit hierarchy stays intact', () => {
    const indexes = buildRulebookIndexes(data)
    const miniatures = indexes.sectionById.get('miniatures')
    const toolkit = indexes.sectionById.get('dystopian-wars-toolkit')
    const gainingDisorder = indexes.sectionById.get('gaining-disorder')
    const index = indexes.sectionById.get('index')
    assert.ok(miniatures && toolkit && gainingDisorder && index)

    assert.equal(miniatures.parentId, toolkit.id)
    assert.equal(gainingDisorder.parentId, 'tokens')
    assert.equal(index.parentId, null)
    assert.equal(index.childSectionIds.length, 0)
    assert.deepEqual(
        toolkit.childSectionIds,
        data.sections.filter((section) => section.parentId === toolkit.id).map((section) => section.id),
    )

    const miniaturesRule = indexes.ruleById.get('rule.miniatures')
    const emptyDiceContainer = indexes.ruleById.get('rule.section.dice')
    const playAreaAndTerrain = indexes.sectionById.get('play-area-and-terrain-toolkit')
    const dice = indexes.sectionById.get('dice')
    const tokensAndMarkers = indexes.sectionById.get('tokens-and-markers-toolkit')
    assert.ok(miniaturesRule && emptyDiceContainer && playAreaAndTerrain && dice && tokensAndMarkers)
    assert.equal(hasRenderableRuleContent(miniaturesRule, indexes), true)
    assert.equal(hasRenderableRuleContent(emptyDiceContainer, indexes), false)
    assert.deepEqual(
        [playAreaAndTerrain.printedPageStart, playAreaAndTerrain.printedPageEnd],
        [dice.printedPageStart, dice.printedPageEnd],
    )
    assert.notDeepEqual(
        [dice.printedPageStart, dice.printedPageEnd],
        [tokensAndMarkers.printedPageStart, tokensAndMarkers.printedPageEnd],
    )
})

test('the curated index preserves every printed entry without OCR column interleaving', () => {
    const entries = RULEBOOK_INDEX_GROUPS.flatMap((group) => group.entries)

    assert.equal(entries.length, 413)
    assert.deepEqual(
        RULEBOOK_INDEX_GROUPS.map((group) => group.letter),
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W'],
    )
    assert.ok(entries.some((entry) => entry.label === 'Action Dice' && entry.pages === '44'))
    assert.ok(entries.some((entry) => entry.label === 'Action Roll Chart' && entry.pages === '46'))
    assert.ok(entries.some((entry) => entry.label === 'Wreck marker' && entry.pages === '121'))

    for (const entry of entries) {
        assert.doesNotMatch(entry.label, /\.{2,}/, `${entry.label} must not retain an OCR dot leader`)
        for (const pageRange of entry.pages.split(', ')) {
            const pages = pageRange.split('–').map(Number)
            assert.ok(
                pages.every((page) => page >= 1 && page <= 155),
                `${entry.label} must reference printed pages`,
            )
        }
    }
})

test('all 34 official visuals are exposed and every referenced asset is present', () => {
    const indexes = buildRulebookIndexes(data)
    const restoredVisualIds = [
        'visual.moving-models',
        'visual.broadside-additional-targets',
        'visual.escort-tokens',
        'visual.raiding-parties',
        'visual.deployment-order-example',
    ]

    assert.equal(data.visuals.length, 34)
    assert.equal(manifestDocument.counts.curatedVisuals, 34)
    for (const visualId of restoredVisualIds) {
        assert.ok(indexes.visualById.has(visualId), `${visualId} must remain exposed to the reader`)
    }
    for (const encounter of data.encounters) {
        const visual = indexes.visualById.get(encounter.deployment.diagram.visualId)
        assert.ok(visual, `${encounter.name} must use a visual from visuals.json`)
        assert.equal(encounter.deployment.diagram.assetReference, visual.assetReference)
        assert.ok(visual.relatedEncounterIds?.includes(encounter.id))
    }
    for (const visual of data.visuals) {
        const assetUrl = new URL(`../../public/data/${visual.assetReference}`, import.meta.url)
        assert.ok(existsSync(assetUrl), `${visual.assetReference} must be shipped with the public dataset`)
        assert.deepEqual(
            readWebpDimensions(assetUrl),
            { width: visual.width, height: visual.height },
            `${visual.id} metadata must match its real asset dimensions`,
        )
        assert.equal(
            createHash('sha256').update(readFileSync(assetUrl)).digest('hex'),
            visual.sha256,
            `${visual.id} checksum must match the shipped asset`,
        )
    }
})

test('search finds canonical rules by title and body while normalizing apostrophes and diacritics', () => {
    const searchIndex = buildRulebookSearchIndex(data)
    assert.ok(
        searchRulebook(searchIndex, 'Hampered Visibility').some((result) => result.id === 'rule.hampered-visibility'),
    )
    assert.ok(
        searchRulebook(searchIndex, 'adds 2 Bonus Dice to the Resistance Roll').some(
            (result) => result.id === 'rule.hampered-visibility',
        ),
    )
    assert.equal(normalizeSearchText('L’Amirál'), normalizeSearchText("l'amiral"))
})

test('deep links preserve section, specialised view and canonical rule anchor', () => {
    const href = getRulebookHref('visibility', 'rule.checking-visibility', 'procedures')
    const url = new URL(href, 'https://builder.example')

    assert.equal(url.pathname, '/rules/visibility')
    assert.equal(url.searchParams.get('view'), 'procedures')
    assert.equal(url.hash, '#rule.checking-visibility')
})

test('rule text formatting repairs line wraps and emits semantic headings and lists', () => {
    assert.deepEqual(
        getRuleTextBlocks(
            '2. The Launch Phase, in which Carrier units launch Short Range\n\nSquadrons 4.\n\nNEXT STEP\n\nResolve the next rule.',
        ),
        [
            {
                kind: 'ordered-list',
                style: 'decimal',
                items: [
                    {
                        marker: '2',
                        title: 'The Launch Phase, in which Carrier units launch Short Range Squadrons 4.',
                        paragraphs: [],
                    },
                ],
            },
            { kind: 'heading', text: 'NEXT STEP' },
            { kind: 'paragraph', text: 'Resolve the next rule.' },
        ],
    )
    assert.deepEqual(getRuleTextBlocks('- First condition.\n\n- Second condition.'), [
        { kind: 'unordered-list', items: ['First condition.', 'Second condition.'] },
    ])
    assert.equal(formatIdentifier('requiresPropertyPermission'), 'Requires Property Permission')
})

test('rule terms are emphasised once without partial-word or overlapping matches', () => {
    const indexes = buildRulebookIndexes(data)
    const segments = getRuleInlineSegments('Make an Action Roll, then resolve another Action Roll without rerolling.', [
        'Action Roll',
        'Roll',
    ])

    assert.ok(indexes.ruleTerms.includes('Action Roll'))
    assert.ok(indexes.ruleTerms.includes('Bonus Dice'))
    assert.ok(indexes.ruleTerms.includes('Exploding Strike'))
    assert.deepEqual(
        segments.filter((segment) => segment.kind === 'strong').map((segment) => segment.text),
        ['Action Roll'],
    )
})

test('procedure steps expose only their relevant rule segment', () => {
    const indexes = buildRulebookIndexes(data)
    const actionRoll = data.procedures.find((procedure) => procedure.id === 'procedure.action-roll')
    const mineClearance = data.procedures.find((procedure) => procedure.id === 'procedure.mine-clearance-mission')
    const interception = data.procedures.find((procedure) => procedure.id === 'procedure.interception-attempt')
    assert.ok(actionRoll && mineClearance && interception)
    assert.ok(actionRoll.steps[1] && mineClearance.steps[3] && interception.steps[2])

    const explodingStrikes = getProcedureStepText(actionRoll.steps[1], actionRoll, indexes)
    const discardMineStack = getProcedureStepText(mineClearance.steps[3], mineClearance, indexes)
    const discardInterceptors = getProcedureStepText(interception.steps[2], interception, indexes)
    assert.match(explodingStrikes ?? '', /counts the number of dice.+Exploding Strike/s)
    assert.doesNotMatch(explodingStrikes ?? '', /3\) RESOLVE RE-ROLLS/)
    assert.match(discardMineStack ?? '', /SRS tokens.+discarded/i)
    assert.match(discardInterceptors ?? '', /token.+discarded/i)
})

test('canonical rules stay free of verified PDF extraction artefacts', () => {
    const canonicalText = data.ruleBlocks
        .flatMap((rule) => [rule.text ?? '', rule.summary ?? '', ...rule.notes.map((note) => note.text)])
        .join('\n')
    const knownArtefacts = [
        'D\n\nystopian',
        'The agile colossi',
        'Admira l',
        'Badroulbadour',
        'I told t hem',
        'model- by-model',
        'non- Underwater',
        'Battle- Ready',
        'similar- sized',
        'In this example,a',
        'alchemic al',
        'Critical Damage Effect5 4',
        'Initiative Initiative Dial',
        'Fig. each D Frigate',
        'Target unit unit',
        'level of Disorder it has:3',
        'Action Roll3',
        'Engagement Scale.4',
        'Terrain Feature3',
        'Full Reverse5',
    ]

    for (const artefact of knownArtefacts) {
        assert.ok(
            !canonicalText.includes(artefact),
            `canonical rules must not contain the extraction artefact "${artefact}"`,
        )
    }

    const chaos = data.ruleBlocks.find((rule) => rule.id === 'rule.chaos')
    assert.equal(chaos?.text, 'A model cannot Rally if its unit contains one or more Crippled models.')
})

test('verified high-impact rules retain the complete wording and numerical values from the PDF', () => {
    const rule = (id: string) => {
        const match = data.ruleBlocks.find((item) => item.id === id)
        assert.ok(match, `${id} must exist`)
        return match
    }
    const actionRoll = rule('rule.making-an-action-roll')
    const makeAttackRoll = rule('rule.4-make-the-action-roll')
    const disorder = rule('rule.effects-of-disorder')
    const ram = rule('rule.resolving-a-ram')
    const criticalDamage = rule('rule.critical-damage')
    const weaponGrids = rule('rule.weapon-grids')
    const arcs = rule('rule.arcs')
    const coherency = rule('rule.unit-coherency')

    assert.match(
        actionRoll.text ?? '',
        /Rules that call for an Action Roll will be accompanied by an Action Roll Chart/,
    )
    assert.match(
        actionRoll.text ?? '',
        /For example, the active Admiral has made the Action Roll, scoring 2 Exploding Strikes/,
    )
    assert.match(actionRoll.text ?? '', /The Action Roll \(fig\. F\) shows a total of 17 Hits/)
    assert.match(actionRoll.text ?? '', /the Action Roll has scored 2 Successes/)
    assert.match(makeAttackRoll.text ?? '', /makes a Resistance Roll:/)
    assert.match(disorder.text ?? '', /level of Disorder it has:/)
    assert.match(ram.text ?? '', /moves 1” directly backwards/)
    assert.match(criticalDamage.notes[0]?.text ?? '', /reverse \(marked “x2”\)/)
    assert.equal(weaponGrids.notes[0]?.type, 'flavour_text')
    assert.doesNotMatch(weaponGrids.text ?? '', /Dear Diary/)
    assert.match(arcs.text ?? '', /four 90° Arcs/)
    assert.doesNotMatch(coherency.text ?? '', /\n\n4”\n\n/)
})

test('every prose rule finishes a complete statement or introduces a list', () => {
    for (const rule of data.ruleBlocks.filter((item) => item.id !== 'rule.chapter.index' && item.text)) {
        assert.match(rule.text!.trim(), /[.!?:][”’"')\]]?$/, `${rule.id} must not end mid-sentence`)
    }
})

test('curated prose removes page-reference markers without removing game values', () => {
    const broadsideRoll = data.ruleBlocks.find((rule) => rule.id === 'rule.4-make-the-broadside-roll')
    const airSupportIncoming = data.ruleBlocks.find((rule) => rule.id === 'rule.air-support-incoming')
    const interception = data.ruleBlocks.find((rule) => rule.id === 'rule.intercepting-attack-runs')
    const gainingDisorder = data.ruleBlocks.find((rule) => rule.id === 'rule.gaining-disorder')

    assert.ok(broadsideRoll?.text?.includes('suffers 1 Damage for each Standard Strike'))
    assert.ok(broadsideRoll?.text?.includes('gains 1 level of Disorder.'))
    assert.ok(airSupportIncoming?.text?.includes('Round 2, six dice in Round 3'))
    assert.ok(interception?.text?.includes('(Resilience 3)'))
    assert.ok(interception?.text?.includes('(Resilience 4)'))
    assert.ok(gainingDisorder?.text?.includes('Level 1'))
    assert.ok(gainingDisorder?.text?.includes('Level 2'))
    assert.ok(gainingDisorder?.text?.includes('Level 3'))

    const canonicalProse = data.ruleBlocks
        .filter((rule) => rule.id !== 'rule.chapter.index')
        .flatMap((rule) => [rule.text ?? '', rule.summary ?? '', ...rule.notes.map((note) => note.text)])
        .join('\n')
    const referenceLabels = [
        ...new Set(referencesDocument.pageReferenceLinks.map((reference) => reference.label.trim())),
    ].filter((label) => label && label.length < 55 && !/[\n\d]/.test(label) && label !== 'Resilience')

    for (const label of referenceLabels) {
        const pattern = label
            .split(/\s+/)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('\\s+')
        assert.doesNotMatch(
            canonicalProse,
            new RegExp(`\\b${pattern}\\s+\\d{1,2}(?=\\b)`, 'iu'),
            `${label} must not keep a page-reference number`,
        )
    }
})

test('structured tables and token text do not retain page-reference suffix digits', () => {
    const structuredText = JSON.stringify({
        tables: data.tables,
        tokens: data.tokens,
        terrain: data.terrain,
    })
    const knownStructuredArtefacts = [
        'Action Roll3',
        'Damage Limit4',
        'Attack Run Target unit6',
        'Initiative Initiative Dial',
        'Terrain\\nFeature3',
        'Full\\nReverse5',
    ]

    for (const artefact of knownStructuredArtefacts) {
        assert.ok(!structuredText.includes(artefact), `structured data must not contain "${artefact}"`)
    }
})
