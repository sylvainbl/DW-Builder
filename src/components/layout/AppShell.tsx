import { ArrowLeft } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type UIEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useAppStore } from '../../store'
import ListsPanel from '../lists/ListsPanel'
import UnitDetail from '../unit/UnitDetail'
import UnitListColumn from '../unit/UnitListColumn'
import AppHeader from './AppHeader'

const RulebookPage = lazy(() => import('../rules/RulebookPage'))

type AppView = 'lists' | 'builder' | 'units' | 'rules'
interface UnitPickerTarget {
    battlefleetInstanceId: string | null
    label: string
}

export default function AppShell() {
    const { factionId, unitId } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const selectedListInstanceId = useAppStore((state) => state.selectedListInstanceId)
    const selectedBattlefleetInstanceId = useAppStore((state) => state.selectedBattlefleetInstanceId)
    const selectedListGlossary = useAppStore((state) => state.selectedListGlossary)
    const currentList = useAppStore((state) => state.currentList)
    const closeList = useAppStore((state) => state.closeList)
    const [activeView, setActiveView] = useState<AppView>(() => {
        if (location.pathname.startsWith('/rules')) return 'rules'
        return factionId || unitId ? 'units' : 'lists'
    })
    const [unitPickerTarget, setUnitPickerTarget] = useState<UnitPickerTarget | null>(null)
    const [showMobileFooter, setShowMobileFooter] = useState(false)
    const detailPaneRef = useRef<HTMLDivElement>(null)
    const hasDetailSelection = Boolean(
        selectedUnitId || selectedListInstanceId || selectedBattlefleetInstanceId || selectedListGlossary,
    )
    const currentView: AppView = location.pathname.startsWith('/rules')
        ? 'rules'
        : activeView === 'rules'
          ? factionId || unitId
              ? 'units'
              : 'lists'
          : activeView

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

    const handleScrollCapture = (event: UIEvent<HTMLElement>) => {
        if (!(event.target instanceof HTMLElement)) return
        const scrollContainer = event.target
        const remainingScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight - scrollContainer.scrollTop
        setShowMobileFooter(scrollContainer.scrollHeight > scrollContainer.clientHeight && remainingScroll <= 2)
    }

    const showLists = () => {
        setShowMobileFooter(false)
        setUnitPickerTarget(null)
        setActiveView('lists')
        if (location.pathname.startsWith('/rules')) void navigate('/')
    }

    const enterBuilder = () => {
        setShowMobileFooter(false)
        setUnitPickerTarget(null)
        setActiveView('builder')
    }

    const showUnits = () => {
        setShowMobileFooter(false)
        setUnitPickerTarget(null)
        closeList()
        setActiveView('units')
        if (location.pathname.startsWith('/rules')) void navigate('/')
    }

    const showRules = () => {
        setShowMobileFooter(false)
        setUnitPickerTarget(null)
        setActiveView('rules')
        void navigate('/rules')
    }

    const showMobileList = () => {
        setShowMobileFooter(false)
        setSelectedUnitId(null)
    }

    const handleUnitPickerTargetChange = (target: UnitPickerTarget | null) => {
        setShowMobileFooter(false)
        setUnitPickerTarget(target)
    }

    return (
        <div
            className="flex h-dvh flex-col overflow-hidden bg-[var(--panel)] text-[var(--text)]"
            onScrollCapture={handleScrollCapture}
        >
            <AppHeader
                activeView={currentView}
                onShowLists={showLists}
                onShowRules={showRules}
                onShowUnits={showUnits}
            />

            {currentView === 'rules' ? (
                <div className="min-h-0 flex-1 overflow-hidden">
                    <Suspense
                        fallback={
                            <div className="flex h-full items-center justify-center text-sm font-semibold text-[var(--muted)]">
                                Loading core rules…
                            </div>
                        }
                    >
                        <RulebookPage />
                    </Suspense>
                </div>
            ) : currentView === 'lists' ? (
                <div className="min-h-0 flex-1 overflow-y-auto">
                    <ListsPanel onEnterBuilder={enterBuilder} />
                </div>
            ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    {currentView === 'builder' ? (
                        <div
                            className={`${unitPickerTarget ? 'hidden md:flex' : 'flex'} min-h-11 flex-none items-center gap-3 border-b border-[var(--panel-border)] bg-[var(--panel)] px-3 sm:px-4`}
                        >
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
                                    <>
                                        <span className="font-semibold text-[var(--text)]">{currentList.name}</span> ·{' '}
                                        {currentList.units.length} units
                                    </>
                                ) : null}
                            </div>
                        </div>
                    ) : null}

                    <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(19rem,34%)_minmax(0,1fr)]">
                        <div
                            className={`${hasDetailSelection ? 'hidden' : 'flex'} min-h-0 overflow-hidden border-r border-[var(--panel-border)] bg-[var(--detail-row)] md:flex`}
                        >
                            <div className="min-w-0 flex-1">
                                <UnitListColumn
                                    unitPickerTarget={currentView === 'builder' ? unitPickerTarget : null}
                                    onUnitPickerTargetChange={handleUnitPickerTargetChange}
                                />
                            </div>
                        </div>

                        <div
                            ref={detailPaneRef}
                            className={`${hasDetailSelection ? 'block' : 'hidden'} min-h-0 overflow-y-auto bg-[var(--panel)] md:block`}
                        >
                            <div className="sticky top-0 z-20 border-b border-[var(--panel-border)] bg-[rgb(var(--panel-rgb)/0.96)] px-3 py-2 backdrop-blur md:hidden">
                                <button
                                    type="button"
                                    onClick={showMobileList}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--panel-border)] bg-[var(--detail-row)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-foreground)] shadow-sm"
                                >
                                    <ArrowLeft size={14} />
                                    Back to {currentView === 'units' ? 'units' : 'builder'}
                                </button>
                            </div>
                            <div className="p-3 sm:p-4">
                                <UnitDetail
                                    addTarget={currentView === 'builder' ? unitPickerTarget : null}
                                    showReadOnlyAttachments={currentView === 'units'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <footer
                className={`${unitPickerTarget || !showMobileFooter ? 'hidden md:block' : 'block'} flex-none border-t border-[var(--gold)] bg-[var(--navy)] px-4 py-1.5 text-center text-[10px] font-medium text-white sm:py-2 sm:text-xs`}
            >
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
