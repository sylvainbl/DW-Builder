import { useState } from 'react'
import { useAppStore } from '../../store'
import { RuleModal } from './RuleModal'

export function RuleWord({
    category,
    name,
    value,
    detail,
    showValue = true,
}: {
    category: 'properties' | 'systems' | 'qualities'
    name: string
    value?: number | null
    detail?: string
    showValue?: boolean
}) {
    const glossary = useAppStore((state) => state.glossary)
    const [modalOpen, setModalOpen] = useState(false)

    const resolvedRule = glossary?.[category]?.[name]
        ? { category, text: glossary[category][name] }
        : Object.entries(glossary ?? {})
            .map(([fallbackCategory, rules]) => ({ category: fallbackCategory, text: rules[name] }))
            .find((rule) => rule.text)
    const ruleText = resolvedRule?.text ?? null
    const label = `${showValue && value != null ? `${name} ${value}` : name}${detail ? ` (${detail})` : ''}`

    if (!ruleText) {
        return <span>{label}</span>
    }

    return (
        <>
            <span
                onClick={() => setModalOpen(true)}
                style={{ cursor: 'pointer', textDecoration: 'underline dotted' }}
            >
                {label}
            </span>

            {modalOpen && (
                <RuleModal
                    name={name}
                    value={value}
                    category={resolvedRule?.category ?? category}
                    text={ruleText}
                    glossary={glossary}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    )
}
