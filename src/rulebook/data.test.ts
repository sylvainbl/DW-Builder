import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
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
    flattenNavigation,
    flattenSectionTree,
    formatIdentifier,
    getRulebookHref,
    getRuleTextBlocks,
    hasRenderableRuleContent,
    hasSamePageRange,
    normalizeSearchText,
    resolveSectionRuleBlocks,
    resolveReadingSection,
    searchRulebook,
} from './data.ts'
import type { RulebookData } from './types.ts'

const data: RulebookData = {
    manifest: manifestDocument as unknown as RulebookData['manifest'],
    navigation: navigationDocument.chapters as unknown as RulebookData['navigation'],
    sections: sectionsDocument.sections as unknown as RulebookData['sections'],
    ruleBlocks: ruleBlocksDocument.ruleBlocks as unknown as RulebookData['ruleBlocks'],
    tables: tablesDocument.tables as unknown as RulebookData['tables'],
    procedures: proceduresDocument.procedures as unknown as RulebookData['procedures'],
    actions: actionsDocument.actions as unknown as RulebookData['actions'],
    tokens: tokensDocument.tokens as unknown as RulebookData['tokens'],
    criticalDamageEffects: tokensDocument.criticalDamageEffects as unknown as RulebookData['criticalDamageEffects'],
    terrain: terrainDocument as unknown as RulebookData['terrain'],
    encounters: encountersDocument.encounters as unknown as RulebookData['encounters'],
    pageReferenceLinks: referencesDocument.pageReferenceLinks as unknown as RulebookData['pageReferenceLinks'],
    semanticLinks: referencesDocument.semanticLinks as unknown as RulebookData['semanticLinks'],
    visuals: visualsDocument.visuals as unknown as RulebookData['visuals'],
}

function assertUniqueIds(label: string, ids: string[]): void {
    assert.equal(new Set(ids).size, ids.length, `${label} IDs must stay unique so links remain stable`)
}

test('canonical rulebook entities keep unique stable IDs', () => {
    assertUniqueIds('section', data.sections.map((item) => item.id))
    assertUniqueIds('rule', data.ruleBlocks.map((item) => item.id))
    assertUniqueIds('table', data.tables.map((item) => item.id))
    assertUniqueIds('procedure', data.procedures.map((item) => item.id))
    assertUniqueIds('action', data.actions.map((item) => item.id))
    assertUniqueIds('token', data.tokens.map((item) => item.id))
    assertUniqueIds('encounter', data.encounters.map((item) => item.id))
    assertUniqueIds('visual', data.visuals.map((item) => item.id))
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
        for (const ruleId of section.ruleBlockIds) assert.ok(indexes.ruleById.has(ruleId), `${section.id} rule ${ruleId} must resolve`)
        for (const tableId of section.tableIds) assert.ok(indexes.tableById.has(tableId), `${section.id} table ${tableId} must resolve`)
    }
    for (const procedure of data.procedures) {
        if (procedure.ruleBlockId) assert.ok(indexes.ruleById.has(procedure.ruleBlockId))
        for (const step of procedure.steps) {
            if (step.ruleBlockId) assert.ok(indexes.ruleById.has(step.ruleBlockId), `${procedure.id} step ${step.order} must resolve`)
        }
    }
    for (const action of data.actions) {
        if (action.ruleBlockId) assert.ok(indexes.ruleById.has(action.ruleBlockId), `${action.id} canonical rule must resolve`)
        if (action.procedureId) assert.ok(indexes.procedureById.has(action.procedureId), `${action.id} procedure must resolve`)
    }
    for (const reference of data.pageReferenceLinks) {
        assert.ok(indexes.sectionById.has(reference.targetSectionId), `${reference.id} section target must resolve`)
        if (reference.targetRuleBlockId) assert.ok(indexes.ruleById.has(reference.targetRuleBlockId), `${reference.id} rule target must resolve`)
    }
    for (const visual of data.visuals) {
        for (const id of visual.relatedRuleIds ?? []) assert.ok(indexes.ruleById.has(id), `${visual.id} rule target must resolve`)
        for (const id of visual.relatedSectionIds ?? []) assert.ok(indexes.sectionById.has(id), `${visual.id} section target must resolve`)
        for (const id of visual.relatedProcedureIds ?? []) assert.ok(indexes.procedureById.has(id), `${visual.id} procedure target must resolve`)
        for (const id of visual.relatedActionIds ?? []) assert.ok(actionIds.has(id), `${visual.id} action target must resolve`)
        for (const id of visual.relatedTokenIds ?? []) assert.ok(tokenIds.has(id), `${visual.id} token target must resolve`)
        for (const id of visual.relatedMarkerIds ?? []) assert.ok(markerIds.has(id), `${visual.id} marker target must resolve`)
        for (const id of visual.relatedEncounterIds ?? []) assert.ok(encounterIds.has(id), `${visual.id} encounter target must resolve`)
    }
})

test('section rendering deduplicates canonical rules even if an index repeats an ID', () => {
    const indexes = buildRulebookIndexes(data)
    const section = data.sections.find((item) => item.ruleBlockIds.length > 0)
    assert.ok(section)
    const firstRuleId = section.ruleBlockIds[0]
    const duplicatedSection = { ...section, ruleBlockIds: [firstRuleId, firstRuleId] }

    assert.deepEqual(resolveSectionRuleBlocks(duplicatedSection, indexes).map((rule) => rule.id), [firstRuleId])
})

test('leaf sections resolve to a consolidated parent reading page', () => {
    const indexes = buildRulebookIndexes(data)
    const miniatures = indexes.sectionById.get('miniatures')
    const toolkit = indexes.sectionById.get('dystopian-wars-toolkit')
    const gainingDisorder = indexes.sectionById.get('gaining-disorder')
    const tokens = indexes.sectionById.get('tokens')
    const index = indexes.sectionById.get('index')
    assert.ok(miniatures && toolkit && gainingDisorder && tokens && index)

    assert.equal(resolveReadingSection(miniatures, indexes).id, toolkit.id)
    assert.equal(resolveReadingSection(gainingDisorder, indexes).id, tokens.id)
    assert.equal(resolveReadingSection(index, indexes).id, index.id)
    assert.deepEqual(
        flattenSectionTree(toolkit, indexes).map((section) => section.id),
        ['dystopian-wars-toolkit', ...toolkit.childSectionIds],
    )

    const miniaturesRule = indexes.ruleById.get('rule.miniatures')
    const emptyDiceContainer = indexes.ruleById.get('rule.section.dice')
    const playAreaAndTerrain = indexes.sectionById.get('play-area-and-terrain-toolkit')
    const dice = indexes.sectionById.get('dice')
    const tokensAndMarkers = indexes.sectionById.get('tokens-and-markers-toolkit')
    assert.ok(miniaturesRule && emptyDiceContainer && playAreaAndTerrain && dice && tokensAndMarkers)
    assert.equal(hasRenderableRuleContent(miniaturesRule, indexes), true)
    assert.equal(hasRenderableRuleContent(emptyDiceContainer, indexes), false)
    assert.equal(hasSamePageRange(playAreaAndTerrain, dice), true)
    assert.equal(hasSamePageRange(dice, tokensAndMarkers), false)
})

test('every encounter uses its curated cropped map and every visual asset is present', () => {
    const indexes = buildRulebookIndexes(data)

    for (const encounter of data.encounters) {
        const visual = indexes.visualById.get(encounter.deployment.diagram.visualId)
        assert.ok(visual, `${encounter.name} must use a visual from visuals.json`)
        assert.equal(encounter.deployment.diagram.assetReference, visual.assetReference)
        assert.ok(visual.relatedEncounterIds?.includes(encounter.id))
    }
    for (const visual of data.visuals) {
        assert.ok(
            existsSync(new URL(`../../public/data/${visual.assetReference}`, import.meta.url)),
            `${visual.assetReference} must be shipped with the public dataset`,
        )
    }
})

test('search finds canonical rules by title and body while normalizing apostrophes and diacritics', () => {
    assert.ok(searchRulebook(data, 'Hampered Visibility').some((result) => result.id === 'rule.hampered-visibility'))
    assert.ok(searchRulebook(data, 'adds 2 Bonus Dice to the Resistance Roll').some((result) => result.id === 'rule.hampered-visibility'))
    assert.equal(normalizeSearchText('L’Amirál'), normalizeSearchText("l'amiral"))
})

test('deep links preserve section, specialised view and canonical rule anchor', () => {
    const href = getRulebookHref('visibility', 'rule.checking-visibility', 'procedures')
    const url = new URL(href, 'https://builder.example')

    assert.equal(url.pathname, '/rules/visibility')
    assert.equal(url.searchParams.get('view'), 'procedures')
    assert.equal(url.hash, '#rule.checking-visibility')
})

test('rule text formatting joins extracted line-wrap fragments without merging headings', () => {
    assert.deepEqual(
        getRuleTextBlocks('2. The Launch Phase, in which Carrier units launch Short Range\n\nSquadrons 4.\n\nNEXT STEP\n\nResolve the next rule.'),
        [
            { kind: 'paragraph', text: '2. The Launch Phase, in which Carrier units launch Short Range Squadrons 4.' },
            { kind: 'heading', text: 'NEXT STEP' },
            { kind: 'paragraph', text: 'Resolve the next rule.' },
        ],
    )
    assert.equal(formatIdentifier('requiresPropertyPermission'), 'Requires Property Permission')
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
    ]

    for (const artefact of knownArtefacts) {
        assert.ok(!canonicalText.includes(artefact), `canonical rules must not contain the extraction artefact "${artefact}"`)
    }

    const chaos = data.ruleBlocks.find((rule) => rule.id === 'rule.chaos')
    assert.equal(chaos?.text, 'A model cannot Rally if its unit contains one or more Crippled models.')
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
    const referenceLabels = [...new Set(referencesDocument.pageReferenceLinks.map((reference) => reference.label.trim()))]
        .filter((label) => label && label.length < 55 && !/[\n\d]/.test(label) && label !== 'Resilience')

    for (const label of referenceLabels) {
        const pattern = label
            .split(/\s+/)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('\\s+')
        assert.doesNotMatch(canonicalProse, new RegExp(`\\b${pattern}\\s+\\d{1,2}(?=\\b)`, 'iu'), `${label} must not keep a page-reference number`)
    }
})
