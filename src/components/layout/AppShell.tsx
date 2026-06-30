import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../../store'
import ListsPanel from '../lists/ListsPanel'
import UnitDetail from '../unit/UnitDetail'
import UnitListColumn from '../unit/UnitListColumn'
import AppHeader from './AppHeader'

export default function AppShell() {
    const { factionId, unitId } = useParams()
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedBattlefleetInstanceId = useAppStore((state) => state.selectedBattlefleetInstanceId)
    const selectedListGlossary = useAppStore((state) => state.selectedListGlossary)
    const [listsCollapsed, setListsCollapsed] = useState(false)
    const detailPaneRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (factionId && factionId !== selectedFactionId) {
            setSelectedFactionId(factionId)
        }
    }, [factionId, selectedFactionId, setSelectedFactionId])

    useEffect(() => {
        if (unitId) {
            setSelectedUnitId(unitId)
        } else {
            setSelectedUnitId(null)
        }
    }, [unitId, setSelectedUnitId])

    useEffect(() => {
        detailPaneRef.current?.scrollTo({ top: 0 })
    }, [selectedUnitId, selectedListInstanceId, selectedBattlefleetInstanceId, selectedListGlossary])

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[var(--panel)] text-[var(--text)]">
            <AppHeader />
            <div className={`grid flex-1 overflow-hidden ${listsCollapsed ? 'grid-cols-[2.25rem_24%_1fr]' : 'grid-cols-[15%_20%_65%]'}`}>
                <div className="min-h-0 overflow-hidden border-r border-neutral-200">
                    {listsCollapsed ? (
                        <div className="flex h-full flex-col items-center bg-[var(--panel)] py-3">
                            <button
                                type="button"
                                title="Show lists"
                                onClick={() => setListsCollapsed(false)}
                                className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-[var(--navy)] shadow-sm transition hover:bg-neutral-50"
                            >
                                <ChevronRight size={15} />
                            </button>
                            <div className="mt-3 rotate-180 text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 [writing-mode:vertical-rl]">
                                Lists
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-full">
                            <button
                                type="button"
                                title="Hide lists"
                                onClick={() => setListsCollapsed(true)}
                                className="absolute right-2 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md border border-neutral-200 bg-white text-[var(--navy)] shadow-sm transition hover:bg-neutral-50"
                            >
                                <ChevronLeft size={15} />
                            </button>
                            <div className="h-full overflow-y-auto">
                                <ListsPanel />
                            </div>
                        </div>
                    )}
                </div>

                <div className="min-h-0 overflow-hidden border-r border-neutral-200 bg-white">
                    <UnitListColumn />
                </div>

                <div ref={detailPaneRef} className="min-h-0 overflow-y-auto bg-[var(--panel)] p-4">
                    <UnitDetail />
                </div>
            </div>
            <footer className="border-t border-[var(--gold)] bg-[var(--navy)] px-4 py-2 text-center text-xs font-medium text-white">
                All rights belong to{' '}
                <a
                    href="https://www.dystopianwars.com/"
                    className="underline decoration-[var(--gold)] underline-offset-2 hover:text-[var(--gold-light)]"
                    target="_blank"
                    rel="noreferrer"
                >
                    Dystopian Wars
                </a>{' '}
                and Warcradle.
            </footer>
        </div>
    )
}
