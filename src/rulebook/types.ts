export interface RulebookManifestModules {
    navigation: string
    sections: string
    ruleBlocks: string
    tables: string
    procedures: string
    actions: string
    tokens: string
    terrain: string
    encounters: string
    references: string
    visuals: string
}

export interface RulebookManifest {
    id: string
    title: string
    version: string
    datasetVersion: string
    schemaVersion: string
    modules: RulebookManifestModules
}

interface RuleSource {
    documentId: string
    printedPages: number[]
    pdfPages: number[]
    anchor?: {
        page: number
        bbox: number[] | null
    }
}

export interface RulebookNavigationItem {
    id: string
    sectionId: string
    title: string
    path: string[]
    printedPageStart: number
    printedPageEnd: number
    children: RulebookNavigationItem[]
}

export interface RulebookSection {
    id: string
    title: string
    parentId: string | null
    level: number
    path: string[]
    childSectionIds: string[]
    printedPageStart: number
    printedPageEnd: number
    source: RuleSource
    descriptionRuleBlockId: string | null
    ruleBlockIds: string[]
    tableIds: string[]
}

interface RuleNote {
    id: string
    type: string
    title: string | null
    text: string
}

export interface RuleBlock {
    id: string
    title: string
    type: string
    contentMode: string
    sectionId: string
    printedPageStart: number
    printedPageEnd: number
    text: string | null
    summary: string | null
    tableIds: string[]
    notes: RuleNote[]
}

export type RuleTableValue = string | number | boolean | null | undefined
export type RuleStructuredValue = RuleTableValue | string[]

interface RuleTableColumn {
    id: string
    title: string
    type: string
}

export interface RuleTable {
    id: string
    title: string
    printedPage: number
    columns?: RuleTableColumn[]
    records?: Record<string, RuleTableValue>[]
    rows: RuleTableValue[][]
    hasGraphicCells: boolean
}

export interface RuleProcedureStep {
    order: number
    title: string
    ruleBlockId: string | null
    text?: string
}

export interface RuleProcedure {
    id: string
    title: string
    source: RuleSource
    printedPages: number[]
    ruleBlockId: string | null
    steps: RuleProcedureStep[]
}

export interface RuleAction {
    id: string
    name: string
    category: string
    phase: string
    procedureId: string | null
    ruleBlockId: string | null
    source: RuleSource
    printedPages: number[]
    text: string
    limits: Record<string, RuleStructuredValue>
}

export interface RuleToken {
    id: string
    name: string
    scope: string
    stacking: string
    maximumLevel?: number
    ruleBlockIds: string[]
    effectsTableId?: string
    text: string
    tracking?: Record<string, RuleStructuredValue>
}

interface CriticalDamageEffect {
    id: string
    name: string
    source: RuleSource
    text: string
    structuredEffect: Record<string, RuleStructuredValue>
}

interface TerrainSharedRule {
    id: string
    name: string
    ruleBlockId: string
    text: string
    structuredEffect: Record<string, RuleStructuredValue>
}

export interface EnvironmentalFeature {
    id: string
    name: string
    source: RuleSource
    impedes: string[]
    hampersVisibility: boolean
    specialRules?: string[]
    sharedRuleIds: string[]
    text: string
}

export interface TerrainFeature {
    id: string
    name: string
    source: RuleSource
    examples?: string[]
    visibilityMass?: number
    minimumSizeAcrossInches?: number
    inheritsTerrainFeatureId?: string
    definition?: string
    treacherousWaterBandInches?: number
    canContainImpassableGround?: boolean
    defaultArmour?: number
    destroyedAtDamageEqualMass?: boolean
    destroyedReplacementMarkerId?: string
    massReducedPerDamage?: number
    removedAtMass?: number
    ruleBlockId?: string
    text?: string
    impassableGround?: {
        description: string
        canNormallyMoveThrough: boolean
        terrainIgnoringModelsCanMoveThrough: boolean
    }
}

export interface TerrainMarker {
    id: string
    name: string
    source: RuleSource
    sectionId: string
    ruleBlockId: string
    text: string
    controlCondition?: Record<string, RuleStructuredValue>
    triggeredByTraits?: string[]
    criticalDamageResultsThatRemoveMarker?: string[]
    onTrigger?: Record<string, RuleStructuredValue>
}

interface EncounterDiagram {
    visualId: string
    assetReference: string
}

interface EncounterObjective {
    id: string
    tier: string
    role: string
    name: string
    availability: string
    text: string
}

interface EncounterAdditionalRule {
    id: string
    name: string
    text: string
}

export interface RuleEncounter {
    id: string
    number: number
    name: string
    source: RuleSource
    narrative: string
    playArea: string
    deployment: {
        description: string | null
        diagram: EncounterDiagram
    }
    additionalRules: EncounterAdditionalRule[]
    objectives: EncounterObjective[]
}

export interface CuratedVisual {
    id: string
    title: string
    category: string
    description: string
    altText: string
    assetReference: string
    mimeType: string
    width: number
    height: number
    sha256: string
    requiredForUnderstanding: boolean
    relatedRuleIds?: string[]
    relatedSectionIds?: string[]
    relatedProcedureIds?: string[]
    relatedActionIds?: string[]
    relatedTokenIds?: string[]
    relatedMarkerIds?: string[]
    relatedTableIds?: string[]
    relatedEncounterIds?: string[]
}

interface PageReferenceLink {
    id: string
    sourcePrintedPage: number
    label: string
    targetPrintedPage: number
    targetSectionId: string
    targetRuleBlockId?: string
}

interface SemanticLink {
    id: string
    from: string
    to: string
    relation: string
}

export interface RulebookData {
    manifest: RulebookManifest
    navigation: RulebookNavigationItem[]
    sections: RulebookSection[]
    ruleBlocks: RuleBlock[]
    tables: RuleTable[]
    procedures: RuleProcedure[]
    actions: RuleAction[]
    tokens: RuleToken[]
    criticalDamageEffects: CriticalDamageEffect[]
    terrain: {
        sharedRules: TerrainSharedRule[]
        markerGeneralRules: string
        environmentalFeatures: EnvironmentalFeature[]
        terrainFeatures: TerrainFeature[]
        markers: TerrainMarker[]
    }
    encounters: RuleEncounter[]
    pageReferenceLinks: PageReferenceLink[]
    semanticLinks: SemanticLink[]
    visuals: CuratedVisual[]
}

type RuleSearchResultKind = 'section' | 'rule' | 'procedure' | 'action' | 'token' | 'terrain' | 'encounter'

export interface RuleSearchResult {
    id: string
    kind: RuleSearchResultKind
    title: string
    sectionId?: string
    snippet: string
    printedPages?: number[]
}

export type RulebookView = 'sections' | 'procedures' | 'actions' | 'tokens' | 'terrain' | 'encounters'
