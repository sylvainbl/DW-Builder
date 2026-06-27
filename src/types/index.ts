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
    TRN: number
    DEF: number
    ARM: number
    HUL: number
    ACT: number
    BRD: number
    REP: number
    CRW: number
}

export interface NamedValue {
    name: string
    value: number | null
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

export interface OptionUpgrade {
    description: string
    cost_per_unit: number | null
    max: number
    tag: string
}

export interface Generator {
    name: string
    point_cost: number
}

export interface Unit {
    id: string
    faction_id: string
    name: string
    sub_name: string
    faction: string
    role: string
    point_cost_per_model: number
    vpr: number
    models: number
    tags: string[]
    stats: Stat
    properties: NamedValue[]
    systems: NamedValue[]
    weapons: Weapon[]
    hardpoint_options: Record<string, Weapon[]>
    options_and_upgrades: OptionUpgrade[]
    lore: string
    version: string
    date: string
}

export interface HardpointSelection {
    slot: string
    weaponName: string
}

export interface OptionSelection {
    tag: string
    quantity: number
}

export interface ArmyUnit {
    instanceId: string
    unitId: string
    quantity: number
    hardpoints: HardpointSelection[]
    options: OptionSelection[]
}

export interface ArmyList {
    id: string
    name: string
    faction_id: string
    units: ArmyUnit[]
    createdAt: string
    updatedAt: string
}

export type Glossary = Record<string, Record<string, string>>
