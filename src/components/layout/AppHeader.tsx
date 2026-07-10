import { Settings } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useAppStore } from '../../store'

type Theme = 'normal' | 'dark' | 'turquoise-orange'

export default function AppHeader() {
    const [builderName, setBuilderName] = useState('DYSTOPIAN WARS BUILDER')
    const [theme, setTheme] = useState<Theme>('normal')
    const [turquoiseThemeUnlocked, setTurquoiseThemeUnlocked] = useState(false)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const builderNameClickCount = useRef(0)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const currentList = useAppStore((state) => state.currentList)
    const factions = useAppStore((state) => state.factions)
    const activeFaction = factions.find((item) => item.id === selectedFactionId)
    const contextLabel = currentList?.name ?? activeFaction?.name ?? 'Select a faction'

    useEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])

    useEffect(() => {
        const handleOutsideClick = () => {
            builderNameClickCount.current = 0
            setSettingsOpen(false)
        }

        document.addEventListener('click', handleOutsideClick)
        return () => document.removeEventListener('click', handleOutsideClick)
    }, [])

    const handleBuilderNameClick = (event: ReactMouseEvent<HTMLSpanElement>) => {
        event.stopPropagation()
        builderNameClickCount.current += 1

        if (builderNameClickCount.current === 13) {
            setBuilderName('ZIGOUBUILDER')
            setTurquoiseThemeUnlocked(true)
            setTheme('turquoise-orange')
        }
    }

    return (
        <header className="relative z-30 flex h-14 items-center justify-between border-b border-white/10 px-4 text-sm text-white" style={{ background: 'var(--navy)' }}>
            <div className="flex min-w-0 items-center gap-2 truncate">
                <span
                    className="flex-none select-none font-semibold tracking-[0.24em] text-[var(--gold)]"
                    onClick={handleBuilderNameClick}
                    onMouseDown={(event) => event.preventDefault()}
                >
                    {builderName}
                </span>
                <span className="text-white/70">›</span>
                <span className="truncate text-sky-100">{contextLabel}</span>
            </div>

            <div
                className="relative ml-3 flex-none"
                onClick={(event) => {
                    event.stopPropagation()
                    builderNameClickCount.current = 0
                }}
            >
                <button
                    type="button"
                    title="Settings"
                    aria-label="Settings"
                    aria-expanded={settingsOpen}
                    onClick={() => setSettingsOpen((open) => !open)}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                >
                    <Settings size={17} />
                </button>

                {settingsOpen ? (
                    <div className="absolute right-0 top-10 w-56 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 text-[var(--text)] shadow-xl">
                        <label htmlFor="theme-selector" className="mb-1.5 block text-xs font-semibold">
                            Theme
                        </label>
                        <select
                            id="theme-selector"
                            value={theme}
                            onChange={(event) => setTheme(event.target.value as Theme)}
                            className="w-full rounded-md border border-[var(--panel-border)] bg-white px-2.5 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--gold)]"
                        >
                            <option value="normal">Normal</option>
                            <option value="dark">Dark theme</option>
                            {turquoiseThemeUnlocked ? <option value="turquoise-orange">Turquoise &amp; orange</option> : null}
                        </select>
                    </div>
                ) : null}
            </div>
        </header>
    )
}
