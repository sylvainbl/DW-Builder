export interface Faction {
    id: string
    name: string
    description: string
    color: string
    accentColor: string
}

export interface Stat {
    MAS: number
    SPD: string
    TRN: number | string
    DEF: number
    ARM: number
    HUL: number
    ACT: number
    BRD: number | string
    REP: number
    CRW: number
}

export interface NamedValue {
    name: string
    value: number | null
    detail?: string
}

export interface Firepower {
    C: number | null
    S: number | null
    E: number | null
}

export interface Weapon {
    name: string
    arc: string
    slot?: string
    firepower: Firepower
    qualities: NamedValue[]
}

export interface ShortRangeSquadron {
    name: string
    attack: number
    intercept: number
    support: number
    resilience: number
    properties: NamedValue[]
}

export interface OptionUpgrade {
    description: string
    cost_per_unit: number | null
    max: number | null
    tag: string
    restrictions?: string[]
    choices?: unknown[]
}

export interface Generator {
    name: string
    point_cost: number
}

export interface FleetDoctrine {
    name: string
    point_cost: number
    text: string
    required_tags?: string[]
    required_role?: string
}

export type BattlefleetType = 'main' | 'specialist'
export type BattlefleetIssueSeverity = 'error' | 'warning'

export interface BattlefleetRequirement {
    all?: string[]
    any?: string[]
    unitIds?: string[]
}

export interface BattlefleetElement {
    id: string
    name: string
    min: number
    max: number
    requirements: BattlefleetRequirement[]
}

export interface BattlefleetAdditionalMainstay {
    flagshipUnitIds: string[]
    classNames: string[]
}

export interface BattlefleetDefinition {
    id: string
    faction_id: string
    name: string
    type: BattlefleetType
    legendary?: boolean
    elements: BattlefleetElement[]
    mainstayClassNames?: string[]
    additionalMainstays?: BattlefleetAdditionalMainstay[]
    specialRules?: string[]
}

export interface Unit {
    id: string
    faction_id: string
    name: string
    sub_name: string
    faction: string
    role: string
    point_cost_per_model: number | null
    vpr: number
    models: number | string
    min?: number
    max?: number
    tags: string[]
    stats: Stat
    properties: NamedValue[]
    systems: NamedValue[]
    weapons: Weapon[]
    short_range_squadrons?: ShortRangeSquadron[]
    hardpoint_options: Record<string, Weapon[]>
    options_and_upgrades: OptionUpgrade[]
    lore: string
    version: string
    date: string
    attachment?: {
        parent_traits: string[]
        max_models?: number | null
    }
}

export interface UnitConfig {
    hardpointSelections: Record<number, string>
    generatorSelection: {
        weaponIndex: number
        generatorName: string
        generatorCost: number
    } | null
    fleetDoctrineSelection: {
        doctrineName: string
        doctrineCost: number
    } | null
    optionQuantities: Record<string, number>
}

export interface ArmyModel {
    modelId: string
    config: UnitConfig
}

export interface ArmyUnit {
    instanceId: string
    unitId: string
    battlefleetInstanceId?: string | null
    config: UnitConfig
    models: ArmyModel[]
    totalPoints: number
    attachedUnits?: ArmyUnit[]
}

export interface ArmyBattlefleet {
    instanceId: string
    definitionId: string
    name: string
}

export interface ArmyList {
    id: string
    name: string
    faction_id: string
    battlefleets?: ArmyBattlefleet[]
    units: ArmyUnit[]
    createdAt: string
    updatedAt: string
}

export interface BattlefleetIssue {
    severity: BattlefleetIssueSeverity
    message: string
    battlefleetInstanceId?: string
    unitInstanceId?: string
}

export type Glossary = Record<string, Record<string, string>>
