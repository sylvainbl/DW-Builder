import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../../store'
import ListsPanel from '../lists/ListsPanel'
import UnitDetail from '../unit/UnitDetail'
import UnitListColumn from '../unit/UnitListColumn'
import AppHeader from './AppHeader'

type AppView = 'lists' | 'builder' | 'units'
interface UnitPickerTarget {
    battlefleetInstanceId: string | null
    label: string
}

export default function AppShell() {
    const { factionId, unitId } = useParams()
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedBattlefleetInstanceId = useAppStore((state) => state.selectedBattlefleetInstanceId)
    const selectedListGlossary = useAppStore((state) => state.selectedListGlossary)
    const currentList = useAppStore((state) => state.currentList)
    const closeList = useAppStore((state) => state.closeList)
    const [activeView, setActiveView] = useState<AppView>(() => factionId || unitId ? 'units' : 'lists')
    const [unitPickerTarget, setUnitPickerTarget] = useState<UnitPickerTarget | null>(null)
    const detailPaneRef = useRef<HTMLDivElement>(null)
    const hasDetailSelection = Boolean(selectedUnitId || selectedListInstanceId || selectedBattlefleetInstanceId || selectedListGlossary)

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

    const showLists = () => {
        setUnitPickerTarget(null)
        setActiveView('lists')
    }

    const enterBuilder = () => {
        setUnitPickerTarget(null)
        setActiveView('builder')
    }

    const showUnits = () => {
        setUnitPickerTarget(null)
        closeList()
        setActiveView('units')
    }

    const showMobileList = () => {
        setSelectedUnitId(null)
    }

    return (
        <div className="flex h-dvh flex-col overflow-hidden bg-[var(--panel)] text-[var(--text)]">
            <AppHeader activeView={activeView} onShowLists={showLists} onShowUnits={showUnits} />

            {activeView === 'lists' ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <ListsPanel onEnterBuilder={enterBuilder} />
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {activeView === 'builder' ? (
                        <div className="flex min-h-11 flex-none items-center gap-3 border-b border-[var(--panel-border)] bg-[var(--panel)] px-3 sm:px-4">
                            <button
                                type="button"
                                onClick={showLists}
                                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--detail-row)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] shadow-sm transition hover:border-[var(--gold)]"
                            >
                                <ArrowLeft size={14} />
                                Back to lists
                            </button>
                            <div className="min-w-0 truncate text-xs text-[var(--muted)]">
                                {currentList ? (
                                    <><span className="font-semibold text-[var(--text)]">{currentList.name}</span> · {currentList.units.length} units</>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(19rem,34%)_minmax(0,1fr)]">
                        <div className={`${hasDetailSelection ? 'hidden' : 'flex'} min-h-0 overflow-hidden border-r border-[var(--panel-border)] bg-[var(--detail-row)] md:flex`}>
                            <div className="min-w-0 flex-1">
                                <UnitListColumn
                                    unitPickerTarget={activeView === 'builder' ? unitPickerTarget : null}
                                    onUnitPickerTargetChange={setUnitPickerTarget}
                                />
                            </div>
                        </div>

                        <div ref={detailPaneRef} className={`${hasDetailSelection ? 'block' : 'hidden'} min-h-0 overflow-y-auto bg-[var(--panel)] md:block`}>
                            <div className="sticky top-0 z-20 border-b border-[var(--panel-border)] bg-[rgb(var(--panel-rgb)/0.96)] px-3 py-2 backdrop-blur md:hidden">
                                <button
                                    type="button"
                                    onClick={showMobileList}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--detail-row)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] shadow-sm"
                                >
                                    <ArrowLeft size={14} />
                                    Back to {activeView === 'units' ? 'units' : 'builder'}
                                </button>
                            </div>
                            <div className="p-3 sm:p-4">
                                <UnitDetail
                                    addTarget={activeView === 'builder' ? unitPickerTarget : null}
                                    showReadOnlyAttachments={activeView === 'units'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <footer className="flex-none border-t border-[var(--gold)] bg-[var(--navy)] px-4 py-1.5 text-center text-[10px] font-medium text-white sm:py-2 sm:text-xs">
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
