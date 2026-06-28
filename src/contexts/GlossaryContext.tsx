import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import GlossaryModal from '../components/glossary/GlossaryModal'
import { GlossaryContext, type GlossaryContextValue } from './glossaryContextValue'

interface Props {
    children: ReactNode
}

export function GlossaryProvider({ children }: Props) {
    const [current, setCurrent] = useState<{ category: 'properties' | 'systems' | 'qualities'; name: string } | null>(null)

    const value = useMemo<GlossaryContextValue>(
        () => ({
            open: (category: 'properties' | 'systems' | 'qualities', name: string) => setCurrent({ category, name }),
            close: () => setCurrent(null),
            current,
        }),
        [current],
    )

    return (
        <GlossaryContext.Provider value={value}>
            {children}
            {current ? <GlossaryModal category={current.category} name={current.name} onClose={() => setCurrent(null)} /> : null}
        </GlossaryContext.Provider>
    )
}
