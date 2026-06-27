import type { Stat } from '../../types/index'

interface Props {
    stats: Stat
}

const keys: Array<keyof Stat> = ['MAS', 'SPD', 'TRN', 'DEF', 'ARM', 'HUL', 'ACT', 'BRD', 'REP', 'CRW']

export default function StatBlock({ stats }: Props) {
    return (
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="grid min-w-[640px] grid-cols-10 gap-2 text-center text-sm text-slate-300">
                {keys.map((key) => (
                    <div key={key} className="rounded-3xl bg-slate-900/80 px-2 py-4">
                        <div className="text-lg font-semibold text-white">{stats[key]}</div>
                        <div className="mt-2 uppercase tracking-[0.12em] text-[0.65rem] text-slate-500">{key}</div>
                    </div>
                ))}
            </div>
        </div>
    )
}
