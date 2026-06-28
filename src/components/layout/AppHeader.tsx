import { useAppStore } from '../../store'

export default function AppHeader() {
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const factions = useAppStore((state) => state.factions)
    const activeFaction = factions.find((item) => item.id === selectedFactionId)

    return (
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-4 text-sm text-white" style={{ background: 'var(--navy)' }}>
            <div className="flex items-center gap-2 truncate">
                <span className="font-semibold tracking-[0.24em] text-[var(--gold)]">DYSTOPIAN WARS</span>
                <span className="text-white/70">›</span>
                <span className="text-sky-100">{activeFaction?.name ?? 'Select a faction'}</span>
            </div>
        </header>
    )
}
