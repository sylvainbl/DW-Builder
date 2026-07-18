import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import AppShell from './components/layout/AppShell'
import './index.css'
import './theme.css'

function App() {
    const loadData = useAppStore((state) => state.loadData)
    const dataLoaded = useAppStore((state) => state.dataLoaded)
    const dataError = useAppStore((state) => state.dataError)

    useEffect(() => {
        void loadData()
    }, [loadData])

    if (dataError) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--navy)] p-6 text-white">
                <div className="max-w-md rounded-3xl border border-red-300/40 bg-white/10 p-8 text-center shadow-xl backdrop-blur">
                    <h1 className="text-xl font-semibold">Builder data unavailable</h1>
                    <p className="mt-3 text-sm leading-6 text-white/75">{dataError}</p>
                    <button
                        type="button"
                        onClick={() => void loadData()}
                        className="mt-5 rounded-lg bg-[var(--gold)] px-4 py-2 text-sm font-semibold text-[var(--navy)]"
                    >
                        Try again
                    </button>
                </div>
            </div>
        )
    }

    if (!dataLoaded) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--navy)] p-6 text-white">
                <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-xl backdrop-blur">
                    <p className="text-lg font-semibold">Loading data...</p>
                </div>
            </div>
        )
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<AppShell />} />
                <Route path="/faction/:factionId" element={<AppShell />} />
                <Route path="/faction/:factionId/unit/:unitId" element={<AppShell />} />
                <Route path="/rules" element={<AppShell />} />
                <Route path="/rules/:sectionId" element={<AppShell />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default App
