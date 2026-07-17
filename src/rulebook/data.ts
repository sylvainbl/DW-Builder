import type {
    RuleAction,
    RuleBlock,
    RuleEncounter,
    RuleProcedure,
    RuleSearchResult,
    RuleToken,
    RulebookData,
    RulebookManifest,
    RulebookManifestModules,
    RulebookNavigationItem,
    RulebookSection,
    RulebookView,
    CuratedVisual,
} from './types'

const DATA_ROOT = '/data/'
const REQUIRED_MODULES: (keyof RulebookManifestModules)[] = [
    'navigation',
    'sections',
    'ruleBlocks',
    'tables',
    'procedures',
    'actions',
    'tokens',
    'terrain',
    'encounters',
    'references',
    'visuals',
]

let cachedRulebookData: Promise<RulebookData> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeModulePath(value: unknown): value is string {
    return typeof value === 'string' && value.endsWith('.json') && !value.includes('..') && !value.startsWith('/')
}

function parseManifest(value: unknown): RulebookManifest {
    if (!isRecord(value) || !isRecord(value.modules)) {
        throw new Error('The rulebook manifest is invalid.')
    }

    for (const key of REQUIRED_MODULES) {
        if (!isSafeModulePath(value.modules[key])) {
            throw new Error(`The rulebook manifest is missing a valid "${key}" module.`)
        }
    }

    if (
        typeof value.id !== 'string'
        || typeof value.title !== 'string'
        || typeof value.version !== 'string'
        || typeof value.datasetVersion !== 'string'
        || typeof value.schemaVersion !== 'string'
    ) {
        throw new Error('The rulebook manifest metadata is invalid.')
    }

    return value as unknown as RulebookManifest
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(`${DATA_ROOT}${path}`)
    if (!response.ok) {
        throw new Error(`Could not load rulebook data: ${path}`)
    }
    return response.json() as Promise<T>
}

export function loadRulebookData(): Promise<RulebookData> {
    if (cachedRulebookData) return cachedRulebookData

    cachedRulebookData = (async () => {
        const manifest = parseManifest(await fetchJson<unknown>('manifest.json'))
        const [
            navigationDocument,
            sectionsDocument,
            ruleBlocksDocument,
            tablesDocument,
            proceduresDocument,
            actionsDocument,
            tokensDocument,
            terrainDocument,
            encountersDocument,
            referencesDocument,
            visualsDocument,
        ] = await Promise.all([
            fetchJson<{ chapters: RulebookNavigationItem[] }>(manifest.modules.navigation),
            fetchJson<{ sections: RulebookSection[] }>(manifest.modules.sections),
            fetchJson<{ ruleBlocks: RuleBlock[] }>(manifest.modules.ruleBlocks),
            fetchJson<{ tables: RulebookData['tables'] }>(manifest.modules.tables),
            fetchJson<{ procedures: RuleProcedure[] }>(manifest.modules.procedures),
            fetchJson<{ actions: RuleAction[] }>(manifest.modules.actions),
            fetchJson<{ tokens: RuleToken[], criticalDamageEffects: RulebookData['criticalDamageEffects'] }>(manifest.modules.tokens),
            fetchJson<RulebookData['terrain']>(manifest.modules.terrain),
            fetchJson<{ encounters: RuleEncounter[] }>(manifest.modules.encounters),
            fetchJson<{ pageReferenceLinks: RulebookData['pageReferenceLinks'], semanticLinks: RulebookData['semanticLinks'] }>(manifest.modules.references),
            fetchJson<{ visuals: CuratedVisual[] }>(manifest.modules.visuals),
        ])

        return {
            manifest,
            navigation: navigationDocument.chapters,
            sections: sectionsDocument.sections,
            ruleBlocks: ruleBlocksDocument.ruleBlocks,
            tables: tablesDocument.tables,
            procedures: proceduresDocument.procedures,
            actions: actionsDocument.actions,
            tokens: tokensDocument.tokens,
            criticalDamageEffects: tokensDocument.criticalDamageEffects,
            terrain: {
                sharedRules: terrainDocument.sharedRules,
                markerGeneralRules: terrainDocument.markerGeneralRules,
                environmentalFeatures: terrainDocument.environmentalFeatures,
                terrainFeatures: terrainDocument.terrainFeatures,
                markers: terrainDocument.markers,
            },
            encounters: encountersDocument.encounters,
            pageReferenceLinks: referencesDocument.pageReferenceLinks,
            semanticLinks: referencesDocument.semanticLinks,
            visuals: visualsDocument.visuals,
        }
    })().catch((error: unknown) => {
        cachedRulebookData = null
        throw error
    })

    return cachedRulebookData
}

export interface FlatNavigationItem extends RulebookNavigationItem {
    depth: number
}

export function flattenNavigation(items: RulebookNavigationItem[], depth = 0): FlatNavigationItem[] {
    return items.flatMap((item) => [
        { ...item, depth },
        ...flattenNavigation(item.children, depth + 1),
    ])
}

export interface RulebookIndexes {
    sectionById: Map<string, RulebookSection>
    ruleById: Map<string, RuleBlock>
    tableById: Map<string, RulebookData['tables'][number]>
    procedureById: Map<string, RuleProcedure>
    visualById: Map<string, CuratedVisual>
    visualsByRuleId: Map<string, CuratedVisual[]>
    visualsBySectionId: Map<string, CuratedVisual[]>
    visualsByProcedureId: Map<string, CuratedVisual[]>
    visualsByActionId: Map<string, CuratedVisual[]>
    visualsByTokenId: Map<string, CuratedVisual[]>
    visualsByMarkerId: Map<string, CuratedVisual[]>
    visualsByEncounterId: Map<string, CuratedVisual[]>
    entityTitleById: Map<string, string>
    flatNavigation: FlatNavigationItem[]
}

function appendVisual(index: Map<string, CuratedVisual[]>, ids: string[] | undefined, visual: CuratedVisual): void {
    for (const id of ids ?? []) {
        index.set(id, [...(index.get(id) ?? []), visual])
    }
}

export function buildRulebookIndexes(data: RulebookData): RulebookIndexes {
    const sectionById = new Map(data.sections.map((section) => [section.id, section]))
    const ruleById = new Map(data.ruleBlocks.map((rule) => [rule.id, rule]))
    const tableById = new Map(data.tables.map((table) => [table.id, table]))
    const procedureById = new Map(data.procedures.map((procedure) => [procedure.id, procedure]))
    const visualById = new Map(data.visuals.map((visual) => [visual.id, visual]))
    const visualsByRuleId = new Map<string, CuratedVisual[]>()
    const visualsBySectionId = new Map<string, CuratedVisual[]>()
    const visualsByProcedureId = new Map<string, CuratedVisual[]>()
    const visualsByActionId = new Map<string, CuratedVisual[]>()
    const visualsByTokenId = new Map<string, CuratedVisual[]>()
    const visualsByMarkerId = new Map<string, CuratedVisual[]>()
    const visualsByEncounterId = new Map<string, CuratedVisual[]>()

    for (const visual of data.visuals) {
        appendVisual(visualsByRuleId, visual.relatedRuleIds, visual)
        appendVisual(visualsBySectionId, visual.relatedSectionIds, visual)
        appendVisual(visualsByProcedureId, visual.relatedProcedureIds, visual)
        appendVisual(visualsByActionId, visual.relatedActionIds, visual)
        appendVisual(visualsByTokenId, visual.relatedTokenIds, visual)
        appendVisual(visualsByMarkerId, visual.relatedMarkerIds, visual)
        appendVisual(visualsByEncounterId, visual.relatedEncounterIds, visual)
    }

    const entityTitleById = new Map<string, string>()
    for (const entity of [
        ...data.sections,
        ...data.ruleBlocks,
        ...data.procedures,
        ...data.actions.map((action) => ({ id: action.id, title: action.name })),
        ...data.tokens.map((token) => ({ id: token.id, title: token.name })),
        ...data.terrain.environmentalFeatures.map((item) => ({ id: item.id, title: item.name })),
        ...data.terrain.terrainFeatures.map((item) => ({ id: item.id, title: item.name })),
        ...data.terrain.markers.map((item) => ({ id: item.id, title: item.name })),
        ...data.encounters.map((encounter) => ({ id: encounter.id, title: encounter.name })),
    ]) {
        entityTitleById.set(entity.id, entity.title)
    }

    return {
        sectionById,
        ruleById,
        tableById,
        procedureById,
        visualById,
        visualsByRuleId,
        visualsBySectionId,
        visualsByProcedureId,
        visualsByActionId,
        visualsByTokenId,
        visualsByMarkerId,
        visualsByEncounterId,
        entityTitleById,
        flatNavigation: flattenNavigation(data.navigation),
    }
}

export function resolveSectionRuleBlocks(section: RulebookSection, indexes: RulebookIndexes): RuleBlock[] {
    const renderedRuleIds = new Set<string>()
    return section.ruleBlockIds.flatMap((id) => {
        if (renderedRuleIds.has(id)) return []
        const rule = indexes.ruleById.get(id)
        if (!rule) return []
        renderedRuleIds.add(id)
        return [rule]
    })
}

export function hasRenderableRuleContent(rule: RuleBlock, indexes: RulebookIndexes): boolean {
    return Boolean(
        rule.text?.trim()
        || rule.notes.some((note) => note.text.trim() || note.title?.trim())
        || rule.tableIds.some((id) => indexes.tableById.has(id))
        || indexes.visualsByRuleId.get(rule.id)?.length,
    )
}

export function hasSamePageRange(left: RulebookSection, right: RulebookSection): boolean {
    return left.printedPageStart === right.printedPageStart
        && left.printedPageEnd === right.printedPageEnd
}

export function resolveReadingSection(section: RulebookSection, indexes: RulebookIndexes): RulebookSection {
    if (section.childSectionIds.length > 0 || !section.parentId) return section
    const parent = indexes.sectionById.get(section.parentId)
    return parent?.childSectionIds.length ? parent : section
}

export function flattenSectionTree(section: RulebookSection, indexes: RulebookIndexes): RulebookSection[] {
    return [
        section,
        ...section.childSectionIds.flatMap((id) => {
            const child = indexes.sectionById.get(id)
            return child ? flattenSectionTree(child, indexes) : []
        }),
    ]
}

export function normalizeSearchText(value: string): string {
    return value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[’‘]/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('en')
}

export interface TextMatch {
    start: number
    end: number
}

export function findNormalizedMatch(text: string, query: string): TextMatch | null {
    const normalizedQuery = normalizeSearchText(query)
    if (!normalizedQuery) return null

    let normalizedText = ''
    const starts: number[] = []
    const ends: number[] = []
    let sourceOffset = 0

    for (const character of text) {
        const normalizedCharacter = character
            .normalize('NFD')
            .replace(/\p{Diacritic}/gu, '')
            .replace(/[’‘]/g, "'")
            .replace(/\s/g, ' ')
            .toLocaleLowerCase('en')
        for (const normalizedPart of normalizedCharacter) {
            normalizedText += normalizedPart
            starts.push(sourceOffset)
            ends.push(sourceOffset + character.length)
        }
        sourceOffset += character.length
    }

    const matchIndex = normalizedText.indexOf(normalizedQuery)
    if (matchIndex < 0) return null

    const lastIndex = matchIndex + normalizedQuery.length - 1
    return {
        start: starts[matchIndex],
        end: ends[lastIndex],
    }
}

export interface RuleTextBlock {
    kind: 'heading' | 'paragraph'
    text: string
}

function isRuleTextHeading(value: string): boolean {
    return (
        (/^[A-Z]/.test(value)
            && value.length < 80
            && value === value.toLocaleUpperCase('en'))
        || /^Level \d+$/i.test(value)
    )
}

export function getRuleTextBlocks(text: string): RuleTextBlock[] {
    const chunks = text
        .split(/\n{2,}/)
        .map((chunk) => chunk.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
        .filter(Boolean)
    const blocks: RuleTextBlock[] = []

    for (const chunk of chunks) {
        if (isRuleTextHeading(chunk)) {
            blocks.push({ kind: 'heading', text: chunk })
            continue
        }

        const previous = blocks.at(-1)
        if (previous?.kind === 'paragraph' && !/[.!?:;…][”’"')\]]?$/.test(previous.text)) {
            previous.text = `${previous.text} ${chunk}`
            continue
        }

        blocks.push({ kind: 'paragraph', text: chunk })
    }

    return blocks
}

function cleanRuleText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim()
}

function makeSnippet(text: string, query: string): string {
    const cleaned = cleanRuleText(text)
    const match = findNormalizedMatch(cleaned, query)
    if (!match) return cleaned.slice(0, 180)

    const start = Math.max(0, match.start - 70)
    const end = Math.min(cleaned.length, match.end + 110)
    return `${start > 0 ? '…' : ''}${cleaned.slice(start, end)}${end < cleaned.length ? '…' : ''}`
}

function resultMatches(result: RuleSearchResult, query: string): boolean {
    return Boolean(findNormalizedMatch(`${result.title} ${result.snippet}`, query))
}

export function searchRulebook(data: RulebookData, query: string): RuleSearchResult[] {
    if (!normalizeSearchText(query)) return []

    const results: RuleSearchResult[] = [
        ...data.sections.map((section): RuleSearchResult => ({
            id: section.id,
            kind: 'section',
            title: section.title,
            sectionId: section.id,
            snippet: section.path.join(' › '),
            printedPages: section.source.printedPages,
        })),
        ...data.ruleBlocks.map((rule): RuleSearchResult => ({
            id: rule.id,
            kind: 'rule',
            title: rule.title,
            sectionId: rule.sectionId,
            snippet: makeSnippet(rule.text ?? rule.summary ?? '', query),
            printedPages: Array.from({ length: rule.printedPageEnd - rule.printedPageStart + 1 }, (_, index) => rule.printedPageStart + index),
        })),
        ...data.procedures.map((procedure): RuleSearchResult => ({
            id: procedure.id,
            kind: 'procedure',
            title: procedure.title,
            sectionId: procedure.ruleBlockId ? data.ruleBlocks.find((rule) => rule.id === procedure.ruleBlockId)?.sectionId : undefined,
            snippet: procedure.steps.map((step) => step.title).join(' · '),
            printedPages: procedure.source.printedPages,
        })),
        ...data.actions.map((action): RuleSearchResult => ({
            id: action.id,
            kind: 'action',
            title: action.name,
            sectionId: action.ruleBlockId ? data.ruleBlocks.find((rule) => rule.id === action.ruleBlockId)?.sectionId : undefined,
            snippet: `${action.phase} · ${action.category.replaceAll('_', ' ')}`,
            printedPages: action.printedPages,
        })),
        ...data.tokens.map((token): RuleSearchResult => ({
            id: token.id,
            kind: 'token',
            title: token.name,
            sectionId: token.ruleBlockIds[0] ? data.ruleBlocks.find((rule) => rule.id === token.ruleBlockIds[0])?.sectionId : undefined,
            snippet: makeSnippet(token.text, query),
        })),
        ...[
            ...data.terrain.environmentalFeatures,
            ...data.terrain.terrainFeatures,
            ...data.terrain.markers,
        ].map((item): RuleSearchResult => ({
            id: item.id,
            kind: 'terrain',
            title: item.name,
            sectionId: 'ruleBlockId' in item && item.ruleBlockId
                ? data.ruleBlocks.find((rule) => rule.id === item.ruleBlockId)?.sectionId
                : undefined,
            snippet: makeSnippet(('text' in item ? item.text : item.definition) ?? '', query),
            printedPages: item.source.printedPages,
        })),
        ...data.encounters.map((encounter): RuleSearchResult => ({
            id: encounter.id,
            kind: 'encounter',
            title: encounter.name,
            snippet: makeSnippet([
                encounter.narrative,
                encounter.playArea,
                ...encounter.additionalRules.flatMap((rule) => [rule.name, rule.text]),
                ...encounter.objectives.flatMap((objective) => [objective.name, objective.text]),
            ].join(' '), query),
            printedPages: encounter.source.printedPages,
        })),
    ]

    return results
        .filter((result) => resultMatches(result, query))
        .sort((left, right) => {
            const leftTitleMatch = findNormalizedMatch(left.title, query)
            const rightTitleMatch = findNormalizedMatch(right.title, query)
            if (Boolean(leftTitleMatch) !== Boolean(rightTitleMatch)) return leftTitleMatch ? -1 : 1
            return left.title.localeCompare(right.title)
        })
        .slice(0, 30)
}

export function getRulebookHref(sectionId?: string, ruleId?: string, view: RulebookView = 'sections'): string {
    const path = sectionId ? `/rules/${encodeURIComponent(sectionId)}` : '/rules'
    const search = view === 'sections' ? '' : `?view=${view}`
    const hash = ruleId ? `#${encodeURIComponent(ruleId)}` : ''
    return `${path}${search}${hash}`
}

export function getViewForSearchResult(result: RuleSearchResult): RulebookView {
    if (result.kind === 'procedure') return 'procedures'
    if (result.kind === 'action') return 'actions'
    if (result.kind === 'token') return 'tokens'
    if (result.kind === 'terrain') return 'terrain'
    if (result.kind === 'encounter') return 'encounters'
    return 'sections'
}

export function formatPageRange(start: number, end: number): string {
    return start === end ? `Page ${start}` : `Pages ${start}–${end}`
}

export function formatIdentifier(value: string): string {
    return value
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .replace(/\b\w/g, (character) => character.toLocaleUpperCase('en'))
}
