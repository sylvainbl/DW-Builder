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

interface Firepower {
    C: number | null
    S: number | null
    E: number | null
}

export interface Weapon {
    name: string
    arc: string
    slot?: string
    hardpoint_locked?: boolean
    firepower: Firepower
    qualities: NamedValue[]
}

export interface WeaponMatch {
    name: string
    arc?: string
    slot?: string
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
    display_name?: string
    exclusive_group?: string
    mandatory?: boolean
    applies_per_model?: boolean
    generator_replaces_weapon?: boolean
    generator_weapon_match?: WeaponMatch
    restrictions?: string[]
    adds_tags?: string[]
    removes_tags?: string[]
    adds_properties?: NamedValue[]
    adds_systems?: NamedValue[]
    adds_qualities?: NamedValue[]
    removes_properties?: string[]
    replaces_systems?: NamedValue[]
    removes_systems?: string[]
    removes_options?: string[]
    removes_weapons?: string[]
    removes_weapon_slots?: string[]
    system_generator_slots?: number
    choices?: unknown[] | string
    attachment_unit_ids?: string[]
}

export interface Generator {
    name: string
    point_cost: number
    weapon_choices?: Weapon[]
}

export interface FleetDoctrine {
    name: string
    point_cost: number
    text: string
    required_tags?: string[]
    required_role?: string
}

export type BattlefleetType = 'main' | 'specialist'
type BattlefleetIssueSeverity = 'error' | 'warning'

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

interface BattlefleetAdditionalMainstay {
    flagshipUnitIds: string[]
    classNames: string[]
}

interface BattlefleetBonus {
    name: string
    text: string
}

export interface BattlefleetEffect {
    scope: 'battlefleet' | 'force'
    requirements?: BattlefleetRequirement[]
    addTags?: string[]
    addProperties?: NamedValue[]
    addSystems?: NamedValue[]
}

export interface BattlefleetDefinition {
    id: string
    faction_id: string
    name: string
    type: BattlefleetType
    legendary?: boolean
    mercenary?: boolean
    unitSourceFactionIds?: string[]
    elements: BattlefleetElement[]
    mainstayClassNames?: string[]
    additionalMainstays?: BattlefleetAdditionalMainstay[]
    specialRules?: string[]
    specialRuleText?: string[]
    battlefleetBonus?: BattlefleetBonus
    effects?: BattlefleetEffect[]
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
        only_as_attachment?: boolean
        eligibility?: {
            anyOf: {
                allOfTags?: string[]
                parentUnitIds?: string[]
            }[]
        }
        note?: string
    }
}

export interface UnitConfig {
    hardpointSelections: Record<number, string>
    generatorSelection: {
        weaponIndex: number
        generatorName: string
        generatorCost: number
        mountedWeaponName?: string
    } | null
    generatorSelections?: {
        weaponIndex: number
        generatorName: string
        generatorCost: number
        mountedWeaponName?: string
    }[]
    fleetDoctrineSelection: {
        doctrineName: string
        doctrineCost: number
    } | null
    optionQuantities: Record<string, number>
}

export interface ArmyModel {
    modelId: string
    customName?: string
    config: UnitConfig
}

export interface ArmyUnit {
    instanceId: string
    unitId: string
    customName?: string
    battlefleetInstanceId?: string | null
    config: UnitConfig
    models: ArmyModel[]
    totalPoints: number
    attachedUnits?: ArmyUnit[]
    generatedByOption?: {
        parentInstanceId: string
        optionTag: string
    }
}

export interface ArmyBattlefleet {
    instanceId: string
    definitionId: string
    name: string
    customName?: string
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
