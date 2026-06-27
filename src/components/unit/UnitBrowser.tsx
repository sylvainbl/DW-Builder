import { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store'
import { getFilteredUnits } from '../../store/selectors'
import UnitCard from './UnitCard'
import UnitDetail from './UnitDetail'
import type { Unit } from '../../types/index'

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
    return (
        <label className="block">
            <span className="sr-only">Recherche</span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="Rechercher une unité, un tag ou un sous-nom"
                className="w-full rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:border-slate-500 focus:outline-none"
            />
        </label>
    )
}

export default function UnitBrowser() {
    const { factionId, unitId } = useParams()
    const navigate = useNavigate()
    const factions = useAppStore((state) => state.factions)
    const units = useAppStore((state) => state.units)
    const selectedFactionId = useAppStore((state) => state.selectedFactionId)
    const setSelectedFactionId = useAppStore((state) => state.setSelectedFactionId)
    const selectedUnitId = useAppStore((state) => state.selectedUnitId)
    const setSelectedUnitId = useAppStore((state) => state.setSelectedUnitId)
    const searchQuery = useAppStore((state) => state.searchQuery)
    const setSearchQuery = useAppStore((state) => state.setSearchQuery)
    const selectedRoles = useAppStore((state) => state.selectedRoles)
    const toggleRoleFilter = useAppStore((state) => state.toggleRoleFilter)
    const addUnitToList = useAppStore((state) => state.addUnitToList)

    const faction = factions.find((item) => item.id === factionId)

    useEffect(() => {
        if (factionId && selectedFactionId !== factionId) {
            setSelectedFactionId(factionId)
        }
    }, [factionId, selectedFactionId, setSelectedFactionId])

    const factionUnits = useMemo(
        () => units.filter((item) => item.faction_id === factionId),
        [units, factionId],
    )

    const filteredUnits = useMemo(
        () => getFilteredUnits({ units, selectedFactionId: factionId ?? null, searchQuery, selectedRoles }),
        [units, factionId, searchQuery, selectedRoles],
    )

    const availableRoles = useMemo(
        () => Array.from(new Set(factionUnits.map((item) => item.role))).sort(),
        [factionUnits],
    )

    return (
        <div className="space-y-6">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Faction</p>
                        <h2 className="text-2xl font-semibold text-white">{faction?.name ?? 'Faction inconnue'}</h2>
                    </div>
                    <button
                        className="rounded-full border border-slate-700 bg-slate-800/80 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
                        onClick={() => navigate('/')}
                    >
                        Changer de faction
                    </button>
                </div>
                <div className="mt-6 grid gap-4">
                    <SearchBar value={searchQuery} onChange={setSearchQuery} />
                    <div className="flex flex-wrap gap-2">
                        {availableRoles.map((role) => {
                            const active = selectedRoles.includes(role)
                            return (
                                <button
                                    key={role}
                                    type="button"
                                    className={`rounded-full border px-4 py-2 text-sm transition ${active ? 'border-slate-300 bg-slate-700 text-white' : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'}`}
                                    onClick={() => toggleRoleFilter(role)}
                                >
                                    {role}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="grid gap-4">
                    {filteredUnits.map((unit: Unit) => (
                        <UnitCard
                            key={unit.id}
                            unit={unit}
                            active={selectedUnitId === unitId}
                            onSelect={() => {
                                setSelectedUnitId(unit.id)
                                navigate(`/faction/${factionId}/unit/${unit.id}`)
                            }}
                            onAdd={() => addUnitToList(unit.id)}
                        />
                    ))}
                </div>
                <div>
                    <UnitDetail />
                </div>
            </section>
        </div>
    )
}
