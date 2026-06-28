import { useContext } from 'react'
import { GlossaryContext } from './glossaryContextValue'

export function useGlossary() {
    const context = useContext(GlossaryContext)
    if (!context) {
        throw new Error('useGlossary must be used within a GlossaryProvider')
    }
    return context
}
