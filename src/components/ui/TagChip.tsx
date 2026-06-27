interface Props {
    label: string
}

export default function TagChip({ label }: Props) {
    return (
        <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 text-[9px] text-neutral-500">
            {label}
        </span>
    )
}
