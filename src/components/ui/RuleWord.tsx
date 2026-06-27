import { useState } from 'react'
import { useAppStore } from '../../store'
import { RuleModal } from './RuleModal'

export function RuleWord({
    category,
    name,
    value,
}: {
    category: 'properties' | 'systems' | 'qualities'
    name: string
    value?: number | null
}) {
    const glossary = useAppStore((state) => state.glossary)
    const [modalOpen, setModalOpen] = useState(false)

    const ruleText = glossary?.[category]?.[name] ?? null
    const label = value != null ? `${name} ${value}` : name

    if (!ruleText) {
        return <span>{label}</span>
    }

    return (
        <>
            <span
                title={ruleText}
                onClick={() => setModalOpen(true)}
                style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
            >
                {label}
            </span>

            {modalOpen && (
                <RuleModal
                    name={name}
                    value={value}
                    category={category}
                    text={ruleText}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    )
}
