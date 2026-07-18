interface NamedSavedList {
    name: string
}

export function normalizeSavedListsIndependently<T extends NamedSavedList>(
    lists: T[],
    normalize: (list: T) => T,
): T[] {
    return lists.map((list) => {
        try {
            return normalize(list)
        } catch (error) {
            console.warn(`Could not update saved list "${list.name}". Keeping its saved data unchanged.`, error)
            return list
        }
    })
}
