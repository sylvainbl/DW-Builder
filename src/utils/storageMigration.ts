export function selectStoredListsValue(current: string | null, legacy: string | null): string | null {
    return current !== null ? current : legacy
}
