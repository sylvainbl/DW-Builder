import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './store'
import AppShell from './components/layout/AppShell'
import { GlossaryProvider } from './contexts/GlossaryContext'
import './index.css'
import './theme.css'

function App() {
  const loadData = useAppStore((state) => state.loadData)
  const dataLoaded = useAppStore((state) => state.dataLoaded)

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!dataLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--navy)] p-6 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8 text-center shadow-xl backdrop-blur">
          <p className="text-lg font-semibold">Chargement des données...</p>
        </div>
      </div>
    )
  }

  return (
    <GlossaryProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppShell />} />
          <Route path="/faction/:factionId" element={<AppShell />} />
          <Route path="/faction/:factionId/unit/:unitId" element={<AppShell />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GlossaryProvider>
  )
}

export default App
