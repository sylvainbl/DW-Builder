import type { Weapon } from '../../types/index'
import RuleTag from '../glossary/RuleTag'

interface Props {
    weapons: Weapon[]
}

function displayFirepower(value: number | null) {
    return value === null ? '—' : value
}

export default function WeaponTable({ weapons }: Props) {
    return (
        <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-4 grid gap-2 text-sm text-slate-400 sm:grid-cols-[1.7fr_1fr_0.7fr_0.7fr_0.7fr_1.4fr]">
                <span className="font-semibold text-slate-100">Nom</span>
                <span className="font-semibold text-slate-100">Arc</span>
                <span className="font-semibold text-slate-100">C</span>
                <span className="font-semibold text-slate-100">S</span>
                <span className="font-semibold text-slate-100">E</span>
                <span className="font-semibold text-slate-100">Qualités</span>
            </div>
            <div className="space-y-3">
                {weapons.map((weapon) => (
                    <div key={weapon.name} className="grid gap-2 rounded-3xl border border-slate-800 bg-slate-900/80 p-4 text-sm text-slate-200 sm:grid-cols-[1.7fr_1fr_0.7fr_0.7fr_0.7fr_1.4fr]">
                        <span className="font-medium text-slate-100">{weapon.name}</span>
                        <span>{weapon.arc}</span>
                        <span>{displayFirepower(weapon.firepower.C)}</span>
                        <span>{displayFirepower(weapon.firepower.S)}</span>
                        <span>{displayFirepower(weapon.firepower.E)}</span>
                        <span className="flex flex-wrap gap-2">
                            {weapon.qualities.map((quality) => (
                                <RuleTag key={quality.name} category="qualities" name={quality.name} value={quality.value} />
                            ))}
                        </span>
                    </div>
                ))}
            </div>
            <p className="mt-4 text-xs text-slate-500">
                Légende&nbsp;: F = Avant, P = Tribord, S = Bâbord, R = Arrière
            </p>
        </div>
    )
}
