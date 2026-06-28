import { useAppStore } from '../../store'

interface Props {
    category: 'properties' | 'systems' | 'qualities'
    name: string
    onClose: () => void
}

export default function GlossaryModal({ category, name, onClose }: Props) {
    const glossary = useAppStore((state) => state.glossary)
    const entry = glossary?.[category]?.[name]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
            <div className="w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Glossaire</p>
                        <h2 className="mt-2 text-2xl font-semibold text-white">{name}</h2>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 transition hover:border-slate-500 hover:bg-slate-700"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>

                {entry ? (
                    <div className="mt-6 text-slate-300">
                        <p className="text-sm leading-7">{entry}</p>
                    </div>
                ) : (
                    <p className="mt-6 text-sm text-slate-400">No glossary entry found for this rule.</p>
                )}
            </div>
        </div>
    )
}
