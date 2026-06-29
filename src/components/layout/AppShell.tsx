import { useEffect } from 'react'
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

    return (
        <div className="flex min-h-screen flex-col bg-[var(--panel)] text-[var(--text)]">
            <AppHeader />
            <div className="grid flex-1 grid-cols-[15%_20%_65%] overflow-hidden">
                <div className="min-h-0 overflow-y-auto border-r border-neutral-200">
                    <ListsPanel />
                </div>

                <div className="min-h-0 overflow-hidden border-r border-neutral-200 bg-white">
                    <UnitListColumn />
                </div>

                <div className="min-h-0 overflow-y-auto bg-[var(--panel)] p-4">
                    <UnitDetail />
                </div>
            </div>
        </div>
    )
}
