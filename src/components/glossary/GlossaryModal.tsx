import { useAppStore } from '../../store'
import type { GlossaryEntry } from '../../types/index'

interface Props {
    category: 'properties' | 'systems' | 'qualities'
    name: string
    onClose: () => void
}

export default function GlossaryModal({ category, name, onClose }: Props) {
    const glossary = useAppStore((state) => state.glossary)
    const entry: GlossaryEntry | undefined = glossary?.[category]?.[name]

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
                        Fermer
                    </button>
                </div>

                {entry ? (
                    <div className="mt-6 space-y-4 text-slate-300">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Résumé</h3>
                            <p className="mt-2 text-sm leading-7">{entry.summary}</p>
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-500">Description complète</h3>
                            <p className="mt-2 text-sm leading-7">{entry.full}</p>
                        </div>
                    </div>
                ) : (
                    <p className="mt-6 text-sm text-slate-400">Aucune entrée de glossaire trouvée pour cette règle.</p>
                )}
            </div>
        </div>
    )
}
