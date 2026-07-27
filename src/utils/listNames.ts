import type { ArmyList } from '../types/index'

interface ArmyListState {
    currentList: ArmyList | null
    savedLists: ArmyList[]
}

export function renameArmyListState(
    state: ArmyListState,
    listId: string,
    name: string,
    updatedAt: string,
): ArmyListState {
    return {
        currentList: state.currentList?.id === listId ? { ...state.currentList, name, updatedAt } : state.currentList,
        savedLists: state.savedLists.map((list) => (list.id === listId ? { ...list, name, updatedAt } : list)),
    }
}
