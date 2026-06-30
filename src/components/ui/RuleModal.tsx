import { useState } from 'react'
import type { Glossary } from '../../types/index'
import { MarkdownText, type GlossaryRuleLink } from './MarkdownText'

export function RuleModal({
    name,
    value,
    category,
    text,
    glossary,
    onClose,
}: {
    name: string
    value?: number | null
    category: string
    text: string
    glossary?: Glossary | null
    onClose: () => void
}) {
    const [selectedRule, setSelectedRule] = useState<GlossaryRuleLink | null>(null)
    const displayedName = selectedRule?.name ?? name
    const displayedCategory = selectedRule?.category ?? category
    const displayedText = selectedRule?.text ?? text
    const label = selectedRule ? selectedRule.name : value != null ? `${name} (${value})` : name

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                onClick={(event) => event.stopPropagation()}
                style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '24px',
                    maxWidth: '480px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    width: '90%',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
            >
                <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#888', marginBottom: '4px' }}>
                    {displayedCategory}
                </p>
                <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '12px' }}>
                    {label}
                </h2>
                <MarkdownText
                    text={displayedText}
                    className="rule-modal-body"
                    style={{ fontSize: '14px', lineHeight: 1.6, color: '#444' }}
                    glossary={glossary}
                    currentRuleName={displayedName}
                    onRuleClick={setSelectedRule}
                />
                <button
                    onClick={onClose}
                    style={{ marginTop: '20px', padding: '6px 16px', cursor: 'pointer' }}
                >
                    Close
                </button>
            </div>
        </div>
    )
}
