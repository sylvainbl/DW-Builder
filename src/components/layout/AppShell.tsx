import { useEffect } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { useAppStore } from '../../store'
import ArmyListPanel from '../army/ArmyListPanel'
import ListManager from '../army/ListManager'
import FactionSidebar from '../faction/FactionSidebar'
import UnitDetail from '../unit/UnitDetail'
import UnitListColumn from '../unit/UnitListColumn'
import AppHeader from './AppHeader'

export default function AppShell() {
    const { factionId, unitId } = useParams()
    const location = useLocation()
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)

    useEffect(() => {
        if (factionId && factionId !== selectedFactionId) {
            setSelectedFactionId(factionId)
        }
    }, [factionId, selectedFactionId, setSelectedFactionId])

    useEffect(() => {
        if (unitId) {
            setSelectedUnitId(unitId)
        } else if (!location.pathname.startsWith('/lists')) {
            setSelectedUnitId(null)
        }
    }, [location.pathname, unitId, setSelectedUnitId])

    const isListsPage = location.pathname.startsWith('/lists')

    return (
        <div className="flex min-h-screen flex-col bg-[var(--panel)] text-[var(--text)]">
            <AppHeader />
            <div className="grid flex-1 grid-cols-[240px_minmax(260px,0.7fr)_1.5fr] overflow-hidden">
                <div className="min-h-0 overflow-y-auto border-r border-neutral-200">
                    <FactionSidebar />
                </div>

                <div className="min-h-0 overflow-y-auto border-r border-neutral-200 bg-white">
                    <div className="p-4">
                        {isListsPage ? <ListManager /> : <UnitListColumn />}
                    </div>
                </div>

                <div className="min-h-0 overflow-y-auto bg-[var(--panel)] p-4">
                    {isListsPage ? <ArmyListPanel /> : <UnitDetail />}
                </div>
            </div>
        </div>
    )
}
