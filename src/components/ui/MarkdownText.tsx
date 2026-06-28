import type { CSSProperties } from 'react'

interface Props {
    text: string
    className?: string
    style?: CSSProperties
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function renderMarkdown(text: string) {
    const paragraphs = escapeHtml(text)
        .split(/\n{2,}/)
        .map((paragraph) =>
            paragraph
                .replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
                .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/gs, '<em>$1</em>')
                .replace(/\n/g, '<br />'),
        )

    return paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')
}

export function MarkdownText({ text, className, style }: Props) {
    return (
        <div
            className={className}
            style={style}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
    )
}
