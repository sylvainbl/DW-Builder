import { useState } from 'react'
import GlossaryModal from './GlossaryModal'

interface Props {
    category: 'properties' | 'systems' | 'qualities'
    name: string
    value?: number | null
}

export default function RuleTag({ category, name, value }: Props) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:bg-slate-700"
                onClick={() => setOpen(true)}
            >
                {name}{value != null ? ` ${value}` : ''}
            </button>
            {open ? <GlossaryModal category={category} name={name} onClose={() => setOpen(false)} /> : null}
        </>
    )
}
