import type { ArmyUnit, HardpointSelection, Unit, Weapon } from '../../types/index'
import { useAppStore } from '../../store'

interface Props {
    unit: Unit
    armyUnit: ArmyUnit
    hardpoint: HardpointSelection
}

function getDefaultWeapon(unit: Unit, slot: string): Weapon | undefined {
    return unit.weapons.find((weapon) => weapon.slot === slot)
}

export default function HardpointPicker({ unit, armyUnit, hardpoint }: Props) {
    const setHardpoint = useAppStore((state) => state.setHardpoint)
    const defaultWeapon = getDefaultWeapon(unit, hardpoint.slot)
    const options = unit.hardpoint_options[hardpoint.slot] ?? []

    return (
        <div className="rounded-3xl border border-slate-800 bg-slate-950/80 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-slate-400">Slot {hardpoint.slot}</p>
            <select
                value={hardpoint.weaponName}
                onChange={(event) => setHardpoint(armyUnit.instanceId, hardpoint.slot, event.target.value)}
                className="mt-3 w-full rounded-3xl border border-slate-800 bg-slate-900/90 px-4 py-3 text-slate-100 focus:border-slate-500 focus:outline-none"
            >
                {defaultWeapon ? (
                    <option value={defaultWeapon.name}>Garder par défaut — {defaultWeapon.name}</option>
                ) : null}
                {options.map((weapon) => (
                    <option key={weapon.name} value={weapon.name}>{weapon.name}</option>
                ))}
            </select>
        </div>
    )
}
