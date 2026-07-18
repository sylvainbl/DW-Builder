import type { FleetDoctrine, Unit } from '../types/index'

export function unitCanTakeFleetDoctrine(unit: Unit): boolean {
    return unit.role === 'Flagship' || unit.tags.includes('Flagship')
}

export function getAvailableFleetDoctrines(unit: Unit, doctrines: Record<string, FleetDoctrine[]>): FleetDoctrine[] {
    if (!unitCanTakeFleetDoctrine(unit)) return []

    return (doctrines[unit.faction_id] ?? []).filter((doctrine) => {
        if (
            doctrine.required_role &&
            unit.role !== doctrine.required_role &&
            !unit.tags.includes(doctrine.required_role)
        ) {
            return false
        }

        return (doctrine.required_tags ?? []).every((tag) => unit.tags.includes(tag))
    })
}
