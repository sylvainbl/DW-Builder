import { BookOpen, List as ListIcon, Settings, Ship } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store'

type Theme = 'normal' | 'dark' | 'turquoise-orange'
type StoredTheme = Exclude<Theme, 'turquoise-orange'>

interface AppHeaderProps {
    activeView: 'lists' | 'builder' | 'units' | 'rules'
    onShowLists: () => void
    onShowRules: () => void
    onShowUnits: () => void
}

const THEME_STORAGE_KEY = 'dw-builder-theme'
const SECRET_THEME_STORAGE_KEY = 'dw-builder-secret-theme'

function loadStoredTheme(): StoredTheme {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'normal'
    } catch {
        return 'normal'
    }
}

function saveTheme(theme: StoredTheme): void {
    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
        console.warn('Could not save theme to localStorage')
    }
}

function loadStoredSecretTheme(): boolean {
    try {
        return localStorage.getItem(SECRET_THEME_STORAGE_KEY) === 'unlocked'
    } catch {
        return false
    }
}

function saveSecretTheme(active: boolean): void {
    try {
        if (active) {
            localStorage.setItem(SECRET_THEME_STORAGE_KEY, 'unlocked')
        } else {
            localStorage.removeItem(SECRET_THEME_STORAGE_KEY)
        }
    } catch {
        console.warn('Could not save secret theme to localStorage')
    }
}

export default function AppHeader({ activeView, onShowLists, onShowRules, onShowUnits }: AppHeaderProps) {
    const [builderName, setBuilderName] = useState(() => (loadStoredSecretTheme() ? 'ZIGOUBUILDER' : 'DW Builder'))
    const [theme, setTheme] = useState<Theme>(() => (loadStoredSecretTheme() ? 'turquoise-orange' : loadStoredTheme()))
    const [turquoiseThemeUnlocked, setTurquoiseThemeUnlocked] = useState(loadStoredSecretTheme)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const builderNameClickCount = useRef(0)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const currentList = useAppStore((state) => state.currentList)
    const factions = useAppStore((state) => state.factions)
    const activeFaction = factions.find((item) => item.id === selectedFactionId)
    const contextLabel = currentList?.name ?? activeFaction?.name ?? 'All factions'

    useEffect(() => {
        document.documentElement.dataset.theme = theme

        if (theme === 'turquoise-orange') {
            saveSecretTheme(true)
        } else {
            saveTheme(theme)
            saveSecretTheme(false)
        }
    }, [theme])

    useEffect(() => {
        const handleOutsideClick = () => {
            builderNameClickCount.current = 0
            setSettingsOpen(false)
        }

        document.addEventListener('click', handleOutsideClick)
        return () => document.removeEventListener('click', handleOutsideClick)
    }, [])

    const handleBuilderNameClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        builderNameClickCount.current += 1

        if (builderNameClickCount.current === 13) {
            setBuilderName('ZIGOUBUILDER')
            setTurquoiseThemeUnlocked(true)
            setTheme('turquoise-orange')
        }
    }

    return (
        <header
            className="relative z-30 grid h-14 flex-none grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-white/10 px-3 text-sm text-white sm:px-4"
            style={{ background: 'var(--navy)' }}
        >
            <div className="min-w-0 items-center gap-2 lg:flex">
                <button
                    type="button"
                    className="hidden max-w-none flex-none select-none truncate border-0 bg-transparent p-0 text-left text-sm font-semibold tracking-[0.24em] text-[var(--gold)] lg:block"
                    onClick={handleBuilderNameClick}
                >
                    {builderName}
                </button>
                {activeView === 'builder' ? (
                    <>
                        <span className="hidden text-white/40 lg:inline">›</span>
                        <span className="hidden max-w-64 truncate text-sky-100 lg:inline">{contextLabel}</span>
                    </>
                ) : null}
            </div>

            <nav aria-label="Main navigation" className="flex flex-none items-center gap-1.5 sm:gap-2">
                <button
                    type="button"
                    onClick={onShowLists}
                    aria-current={activeView === 'lists' ? 'page' : undefined}
                    title="Open saved lists"
                    className={`inline-flex flex-none items-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold shadow-sm transition sm:gap-2 sm:px-4 ${activeView === 'lists' ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)] ring-2 ring-[rgb(var(--gold-rgb)/0.2)]' : 'border-white/25 bg-white/10 text-white hover:border-[var(--gold)] hover:bg-white/20'}`}
                >
                    <ListIcon size={16} />
                    List
                </button>
                <button
                    type="button"
                    onClick={onShowRules}
                    aria-current={activeView === 'rules' ? 'page' : undefined}
                    title="Open the core rules"
                    className={`inline-flex flex-none items-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold shadow-sm transition sm:gap-2 sm:px-4 ${activeView === 'rules' ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)] ring-2 ring-[rgb(var(--gold-rgb)/0.2)]' : 'border-white/25 bg-white/10 text-white hover:border-[var(--gold)] hover:bg-white/20'}`}
                >
                    <BookOpen size={16} />
                    <span className="sm:hidden">Rules</span>
                    <span className="hidden sm:inline">Core Rules</span>
                </button>
                <button
                    type="button"
                    onClick={onShowUnits}
                    aria-current={activeView === 'units' ? 'page' : undefined}
                    title="Browse all units"
                    className={`inline-flex flex-none items-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-semibold shadow-sm transition sm:gap-2 sm:px-4 ${activeView === 'units' ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--navy)] ring-2 ring-[rgb(var(--gold-rgb)/0.2)]' : 'border-white/25 bg-white/10 text-white hover:border-[var(--gold)] hover:bg-white/20'}`}
                >
                    <Ship size={16} />
                    Units
                </button>
            </nav>

            <div
                className="relative ml-2 flex-none justify-self-end sm:ml-3"
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
                            {turquoiseThemeUnlocked ? (
                                <option value="turquoise-orange">Turquoise &amp; orange</option>
                            ) : null}
                        </select>
                    </div>
                ) : null}
            </div>
        </header>
    )
}
