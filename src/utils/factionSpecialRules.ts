import type { NamedValue, Unit } from '../types/index'

type SystemRuleTrigger = {
    factionId: string
    systemName: string
    specialRuleName: string
}

const systemRuleTriggers: SystemRuleTrigger[] = [
    {
        factionId: 'commonwealth',
        systemName: 'Cryo Generator',
        specialRuleName: 'Cryogenic Blast',
    },
]

export function getFactionSpecialRules(unit: Unit, selectedGeneratorName: string | string[] | null): NamedValue[] {
    const selectedGeneratorNames = Array.isArray(selectedGeneratorName)
        ? selectedGeneratorName
        : selectedGeneratorName ? [selectedGeneratorName] : []
    const systemNames = new Set([
        ...unit.systems.map((system) => system.name),
        ...selectedGeneratorNames,
    ])

    return systemRuleTriggers
        .filter((trigger) => trigger.factionId === unit.faction_id && systemNames.has(trigger.systemName))
        .map((trigger) => ({
            name: trigger.specialRuleName,
            value: null,
            detail: 'Special Rule',
        }))
}
