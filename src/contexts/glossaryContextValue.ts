import { createContext } from 'react'

export interface GlossaryContextValue {
    open: (category: 'properties' | 'systems' | 'qualities', name: string) => void
    close: () => void
    current: { category: 'properties' | 'systems' | 'qualities'; name: string } | null
}

export const GlossaryContext = createContext<GlossaryContextValue | null>(null)
