import type {
    RuleAction,
    RuleBlock,
    RuleEncounter,
    RuleProcedure,
    RuleProcedureStep,
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
const RULE_TERM_ALIASES = [
    'Action Dice',
    'Critical Damage Dice',
    'Pool',
    'Action Pool',
    'Resistance Pool',
    'Success Threshold',
    'Bonus Dice',
    'Valour Effect',
    'Standard Counter',
    'Heavy Counter',
    'Standard Strike',
    'Heavy Strike',
    'Exploding Strike',
    'Re-rolled',
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
        typeof value.id !== 'string' ||
        typeof value.title !== 'string' ||
        typeof value.version !== 'string' ||
        typeof value.datasetVersion !== 'string' ||
        typeof value.schemaVersion !== 'string'
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
            fetchJson<{ tokens: RuleToken[]; criticalDamageEffects: RulebookData['criticalDamageEffects'] }>(
                manifest.modules.tokens,
            ),
            fetchJson<RulebookData['terrain']>(manifest.modules.terrain),
            fetchJson<{ encounters: RuleEncounter[] }>(manifest.modules.encounters),
            fetchJson<{
                pageReferenceLinks: RulebookData['pageReferenceLinks']
                semanticLinks: RulebookData['semanticLinks']
            }>(manifest.modules.references),
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
    return items.flatMap((item) => [{ ...item, depth }, ...flattenNavigation(item.children, depth + 1)])
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
    ruleTerms: string[]
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

    const ruleTerms = [
        ...new Set(
            [...data.pageReferenceLinks.map((reference) => reference.label), ...RULE_TERM_ALIASES]
                .map((label) => label.replace(/\s+/g, ' ').trim())
                .filter(
                    (label) =>
                        label.length >= 3 &&
                        label.length <= 55 &&
                        !label.includes('MISSING') &&
                        !/^\W/.test(label) &&
                        !/\s{2,}/.test(label),
                ),
        ),
    ].sort((left, right) => right.length - left.length || left.localeCompare(right))

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
        ruleTerms,
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
        rule.text?.trim() ||
        rule.notes.some((note) => note.text.trim() || note.title?.trim()) ||
        rule.tableIds.some((id) => indexes.tableById.has(id)) ||
        indexes.visualsByRuleId.get(rule.id)?.length,
    )
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
    const start = starts[matchIndex]
    const end = ends[lastIndex]
    if (start === undefined || end === undefined) return null
    return {
        start,
        end,
    }
}

export interface RuleTextListItem {
    marker: string
    title: string
    paragraphs: string[]
}

export type RuleTextBlock =
    | {
          kind: 'heading' | 'paragraph'
          text: string
      }
    | {
          kind: 'unordered-list'
          items: string[]
      }
    | {
          kind: 'ordered-list'
          style: 'decimal' | 'lower-alpha'
          items: RuleTextListItem[]
      }

export interface RuleInlineSegment {
    kind: 'text' | 'strong'
    text: string
}

function isRuleTextHeading(value: string): boolean {
    return (
        (/^[A-Z]/.test(value) && value.length < 80 && value === value.toLocaleUpperCase('en')) ||
        /^Level \d+$/i.test(value) ||
        /^(?:(?:Attacker’s|Defender’s)\s+)?(?:PRIMARY|SECONDARY|TERTIARY) Objective:/i.test(value) ||
        /^(?:Legendary Battlefleets|Mainstay Classes|Heavy Hardpoint|Light Hardpoint|Special Hardpoint)$/i.test(value)
    )
}

function isTerminalStatement(value: string): boolean {
    return /[.!?:;…][”’"')\]]?$/.test(value)
}

interface OrderedMarker {
    marker: string
    style: 'decimal' | 'lower-alpha'
    content: string
}

function parseOrderedMarker(value: string): OrderedMarker | null {
    const decimal = value.match(/^(\d+)[.)]\s+(.+)$/s)
    if (decimal?.[1] && decimal[2]) return { marker: decimal[1], style: 'decimal', content: decimal[2] }
    const alpha = value.match(/^([a-z])\.\s+(.+)$/s)
    if (alpha?.[1] && alpha[2]) return { marker: alpha[1], style: 'lower-alpha', content: alpha[2] }
    return null
}

function parseBullet(value: string): string | null {
    const match = value.match(/^[•▪◦-]\s+(.+)$/s)
    return match?.[1] ?? null
}

function splitOrderedContent(marker: OrderedMarker): { title: string; paragraph?: string } {
    if (marker.style === 'lower-alpha') {
        const knownTitle = marker.content.match(
            /^(Check Encounter Rules|Define Terrain Areas|Place Terrain Features|Finish Placing Terrain)\s+(.+)$/s,
        )
        if (knownTitle?.[1] && knownTitle[2]) return { title: knownTitle[1], paragraph: knownTitle[2] }
    }
    return { title: marker.content }
}

function normalizeRuleTextChunks(text: string): string[] {
    const sourceChunks = text
        .split(/\n{2,}/)
        .map((chunk) =>
            chunk
                .replace(/\s*\n\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
        )
        .filter(Boolean)
    const chunks: string[] = []

    for (const chunk of sourceChunks) {
        const previous = chunks.at(-1)
        if (!previous) {
            chunks.push(chunk)
            continue
        }

        const previousMarker = parseOrderedMarker(previous)
        if (
            previousMarker &&
            !isTerminalStatement(previousMarker.content) &&
            previousMarker.content !== previousMarker.content.toLocaleUpperCase('en') &&
            !isRuleTextHeading(chunk) &&
            !parseOrderedMarker(chunk) &&
            parseBullet(chunk) === null
        ) {
            chunks[chunks.length - 1] = `${previous} ${chunk}`
            continue
        }

        if (
            !isTerminalStatement(previous) &&
            !isRuleTextHeading(previous) &&
            !parseOrderedMarker(previous) &&
            parseBullet(previous) === null &&
            !isRuleTextHeading(chunk) &&
            !parseOrderedMarker(chunk) &&
            parseBullet(chunk) === null
        ) {
            chunks[chunks.length - 1] = `${previous} ${chunk}`
            continue
        }

        chunks.push(chunk)
    }

    return chunks
}

export function getRuleTextBlocks(text: string): RuleTextBlock[] {
    const chunks = normalizeRuleTextChunks(text)
    const blocks: RuleTextBlock[] = []

    for (let index = 0; index < chunks.length;) {
        const chunk = chunks[index]
        if (chunk === undefined) break

        const bullet = parseBullet(chunk)
        if (bullet !== null) {
            const items: string[] = []
            while (index < chunks.length) {
                const currentChunk = chunks[index]
                if (currentChunk === undefined) break
                const item = parseBullet(currentChunk)
                if (item === null) break
                items.push(item)
                index += 1
            }
            blocks.push({ kind: 'unordered-list', items })
            continue
        }

        const marker = parseOrderedMarker(chunk)
        if (marker) {
            const items: RuleTextListItem[] = []
            const style = marker.style
            while (index < chunks.length) {
                const currentChunk = chunks[index]
                if (currentChunk === undefined) break
                const itemMarker = parseOrderedMarker(currentChunk)
                if (!itemMarker || itemMarker.style !== style) break
                const content = splitOrderedContent(itemMarker)
                const item: RuleTextListItem = {
                    marker: itemMarker.marker,
                    title: content.title,
                    paragraphs: content.paragraph ? [content.paragraph] : [],
                }
                index += 1
                while (index < chunks.length) {
                    const paragraph = chunks[index]
                    if (
                        paragraph === undefined ||
                        parseOrderedMarker(paragraph) ||
                        parseBullet(paragraph) !== null ||
                        isRuleTextHeading(paragraph)
                    )
                        break
                    item.paragraphs.push(paragraph)
                    index += 1
                }
                items.push(item)
            }
            blocks.push({ kind: 'ordered-list', style, items })
            continue
        }

        if (isRuleTextHeading(chunk)) {
            blocks.push({ kind: 'heading', text: chunk })
        } else {
            blocks.push({ kind: 'paragraph', text: chunk })
        }
        index += 1
    }

    return blocks
}

function isWordCharacter(value: string | undefined): boolean {
    return Boolean(value && /[\p{L}\p{N}]/u.test(value))
}

export function getRuleInlineSegments(text: string, terms: string[]): RuleInlineSegment[] {
    const lowerText = text.toLocaleLowerCase('en')
    const ranges: { start: number; end: number }[] = []

    for (const term of terms) {
        const lowerTerm = term.toLocaleLowerCase('en')
        let start = lowerText.indexOf(lowerTerm)
        while (start >= 0) {
            const end = start + term.length
            const hasWordBoundary = !isWordCharacter(text[start - 1]) && !isWordCharacter(text[end])
            const overlaps = ranges.some((range) => start < range.end && end > range.start)
            if (hasWordBoundary && !overlaps) {
                ranges.push({ start, end })
                break
            }
            if (overlaps) break
            start = lowerText.indexOf(lowerTerm, start + 1)
        }
    }

    ranges.sort((left, right) => left.start - right.start)
    if (ranges.length === 0) return [{ kind: 'text', text }]

    const segments: RuleInlineSegment[] = []
    let offset = 0
    for (const range of ranges) {
        if (range.start > offset) segments.push({ kind: 'text', text: text.slice(offset, range.start) })
        segments.push({ kind: 'strong', text: text.slice(range.start, range.end) })
        offset = range.end
    }
    if (offset < text.length) segments.push({ kind: 'text', text: text.slice(offset) })
    return segments
}

export function getProcedureStepText(
    step: RuleProcedureStep,
    procedure: RuleProcedure,
    indexes: RulebookIndexes,
): string | null {
    if (step.text?.trim()) return step.text
    if (!step.ruleBlockId) return null

    const rule = indexes.ruleById.get(step.ruleBlockId)
    if (!rule?.text) return null

    const sharedStepCount = procedure.steps.filter((item) => item.ruleBlockId === step.ruleBlockId).length
    if (sharedStepCount <= 1) return rule.text

    for (const block of getRuleTextBlocks(rule.text)) {
        if (block.kind !== 'ordered-list') continue
        const item = block.items.find((candidate) => candidate.marker === String(step.order))
        if (!item) continue
        if (item.paragraphs.length > 0) return item.paragraphs.join('\n\n')
        return item.title
    }

    const significantWords = normalizeSearchText(step.title)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4 && !['each', 'make', 'with', 'from', 'that', 'then', 'this'].includes(word))
    const paragraphCandidates = getRuleTextBlocks(rule.text).flatMap((block) => {
        if (block.kind === 'paragraph') return [block.text]
        if (block.kind === 'unordered-list') return block.items
        return []
    })
    const rankedCandidates = paragraphCandidates
        .map((text) => {
            const normalized = normalizeSearchText(text)
            const score = significantWords.filter((word) => normalized.includes(word)).length
            return { text, score }
        })
        .sort((left, right) => right.score - left.score)

    return rankedCandidates[0]?.score ? rankedCandidates[0].text : step.title
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
            printedPages: Array.from(
                { length: rule.printedPageEnd - rule.printedPageStart + 1 },
                (_, index) => rule.printedPageStart + index,
            ),
        })),
        ...data.procedures.map((procedure): RuleSearchResult => ({
            id: procedure.id,
            kind: 'procedure',
            title: procedure.title,
            sectionId: procedure.ruleBlockId
                ? data.ruleBlocks.find((rule) => rule.id === procedure.ruleBlockId)?.sectionId
                : undefined,
            snippet: procedure.steps.map((step) => step.title).join(' · '),
            printedPages: procedure.source.printedPages,
        })),
        ...data.actions.map((action): RuleSearchResult => ({
            id: action.id,
            kind: 'action',
            title: action.name,
            sectionId: action.ruleBlockId
                ? data.ruleBlocks.find((rule) => rule.id === action.ruleBlockId)?.sectionId
                : undefined,
            snippet: `${action.phase} · ${action.category.replaceAll('_', ' ')}`,
            printedPages: action.printedPages,
        })),
        ...data.tokens.map((token): RuleSearchResult => ({
            id: token.id,
            kind: 'token',
            title: token.name,
            sectionId: token.ruleBlockIds[0]
                ? data.ruleBlocks.find((rule) => rule.id === token.ruleBlockIds[0])?.sectionId
                : undefined,
            snippet: makeSnippet(token.text, query),
        })),
        ...[...data.terrain.environmentalFeatures, ...data.terrain.terrainFeatures, ...data.terrain.markers].map(
            (item): RuleSearchResult => ({
                id: item.id,
                kind: 'terrain',
                title: item.name,
                sectionId:
                    'ruleBlockId' in item && item.ruleBlockId
                        ? data.ruleBlocks.find((rule) => rule.id === item.ruleBlockId)?.sectionId
                        : undefined,
                snippet: makeSnippet(('text' in item ? item.text : item.definition) ?? '', query),
                printedPages: item.source.printedPages,
            }),
        ),
        ...data.encounters.map((encounter): RuleSearchResult => ({
            id: encounter.id,
            kind: 'encounter',
            title: encounter.name,
            snippet: makeSnippet(
                [
                    encounter.narrative,
                    encounter.playArea,
                    ...encounter.additionalRules.flatMap((rule) => [rule.name, rule.text]),
                    ...encounter.objectives.flatMap((objective) => [objective.name, objective.text]),
                ].join(' '),
                query,
            ),
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
