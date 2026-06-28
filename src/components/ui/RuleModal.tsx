import { MarkdownText } from './MarkdownText'

export function RuleModal({
    name,
    value,
    category,
    text,
    onClose,
}: {
    name: string
    value?: number | null
    category: string
    text: string
    onClose: () => void
}) {
    const label = value != null ? `${name} (${value})` : name

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
                    {category}
                </p>
                <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '12px' }}>
                    {label}
                </h2>
                <MarkdownText
                    text={text}
                    style={{ fontSize: '14px', lineHeight: 1.6, color: '#444' }}
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
