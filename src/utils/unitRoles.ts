const roleTagOrder = ['Flagship', 'Line', 'Patrol', 'Support', 'Scout', 'Logistical']

export function getRoleSortRank(role: string): number {
    const index = roleTagOrder.indexOf(role)
    return index === -1 ? roleTagOrder.length : index
}

export function sortRoleTags(a: string, b: string): number {
    const aRank = getRoleSortRank(a)
    const bRank = getRoleSortRank(b)
    if (aRank !== bRank) return aRank - bRank
    return a.localeCompare(b)
}
