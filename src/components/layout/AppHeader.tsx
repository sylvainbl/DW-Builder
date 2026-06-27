import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'

export default function AppHeader() {
    const navigate = useNavigate()
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const factions = useAppStore((state) => state.factions)
    const createNewList = useAppStore((state) => state.createNewList)
    const activeFaction = factions.find((item) => item.id === selectedFactionId)

    return (
        <header className="flex h-14 items-center justify-between border-b border-white/10 px-4 text-sm text-white" style={{ background: 'var(--navy)' }}>
            <div className="flex items-center gap-2 truncate">
                <span className="font-semibold tracking-[0.24em] text-[var(--gold)]">DYSTOPIAN WARS</span>
                <span className="text-white/70">›</span>
                <span className="text-sky-100">{activeFaction?.name ?? 'Sélectionner une faction'}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/20"
                    onClick={() => {
                        const factionId = selectedFactionId ?? factions[0]?.id
                        if (!factionId) return
                        createNewList(factionId, `Liste ${new Date().toLocaleDateString()}`)
                        navigate('/lists')
                    }}
                >
                    Nouvelle liste
                </button>
                <button
                    type="button"
                    className="rounded border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/20"
                    onClick={() => navigate('/lists')}
                >
                    Listes
                </button>
            </div>
        </header>
    )
}
