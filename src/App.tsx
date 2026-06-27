import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import AppShell from './components/layout/AppShell'
import FactionGrid from './components/faction/FactionGrid'
import UnitBrowser from './components/unit/UnitBrowser'
import ListManager from './components/army/ListManager'
import './index.css'

function App() {
  const loadData = useAppStore((state) => state.loadData)
  const dataLoaded = useAppStore((state) => state.dataLoaded)

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!dataLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="rounded-3xl border border-slate-700 bg-slate-900/90 p-8 text-center shadow-xl shadow-slate-950/20">
          <p className="text-lg font-semibold">Chargement des données...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<FactionGrid />} />
          <Route path="faction/:factionId" element={<UnitBrowser />} />
          <Route path="faction/:factionId/unit/:unitId" element={<UnitBrowser />} />
          <Route path="lists" element={<ListManager />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
