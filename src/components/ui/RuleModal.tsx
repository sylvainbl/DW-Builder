import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
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
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const onCloseRef = useRef(onClose)
    const returnFocusToRef = useRef<HTMLElement | null>(
        typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null,
    )
    const titleId = useId()

    useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    useLayoutEffect(() => {
        closeButtonRef.current?.focus()
    }, [])

    useEffect(() => {
        const returnFocusTo = returnFocusToRef.current
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
                return
            }
            if (event.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = Array.from(
                dialogRef.current.querySelectorAll<HTMLElement>(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
                ),
            ).filter((element) => !element.hasAttribute('disabled'))
            const first = focusableElements[0]
            if (!first) return
            const last = focusableElements.at(-1) ?? first

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => {
            document.removeEventListener('keydown', handleKeyDown)
            returnFocusTo?.focus()
        }
    }, [])

    const displayedName = selectedRule?.name ?? name
    const displayedCategory = selectedRule?.category ?? category
    const displayedText = selectedRule?.text ?? text
    const label = selectedRule ? selectedRule.name : value != null ? `${name} (${value})` : name

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
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
                ref={dialogRef}
                style={{
                    background: 'var(--detail-row)',
                    color: 'var(--detail-ink)',
                    borderRadius: '12px',
                    padding: '28px 32px',
                    maxWidth: '760px',
                    maxHeight: '84vh',
                    overflowY: 'auto',
                    width: 'min(92vw, 760px)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                }}
            >
                <p
                    style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                        color: 'var(--muted)',
                        marginBottom: '4px',
                    }}
                >
                    {displayedCategory}
                </p>
                <h2 id={titleId} style={{ fontSize: '18px', fontWeight: 500, marginBottom: '12px' }}>
                    {label}
                </h2>
                <MarkdownText
                    text={displayedText}
                    className="rule-modal-body"
                    style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--detail-ink)' }}
                    glossary={glossary}
                    currentRuleName={displayedName}
                    onRuleClick={setSelectedRule}
                />
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    style={{ marginTop: '20px', padding: '6px 16px', cursor: 'pointer' }}
                >
                    Close
                </button>
            </div>
        </div>
    )
}
