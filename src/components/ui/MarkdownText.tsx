import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { Glossary } from '../../types/index'

interface Props {
    text: string
    className?: string
    style?: CSSProperties
    glossary?: Glossary | null
    currentRuleName?: string
    onRuleClick?: (rule: GlossaryRuleLink) => void
}

export interface GlossaryRuleLink {
    category: string
    name: string
    text: string
}

const inlineTokenPattern = /(\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|\*[\s\S]+?\*)/g
const explicitRulePattern = /\[\[(?:(properties|systems|qualities):)?([^\]|]+)(?:\|([^\]]+))?\]\]/g
const ruleContext = '(?:qualit(?:y|ies)|propert(?:y|ies)|systems?|rules?)'
const criticalDamageQualityNames = new Set([
    'Arc',
    'Breach',
    'Hazard',
    'Navigation Lock',
    'Shredded Defences',
    'Structural Failure',
    'System Failure',
    'Voltaic',
])

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function markedWordPattern(word: string) {
    return `(?:\\*{1,3})?${escapeRegExp(word)}(?:\\*{1,3})?`
}

function ruleNamePattern(name: string, withContext: boolean) {
    const words = name.split(/\s+/)
    const markedName = words.map(markedWordPattern).join('\\s+')
    const lookahead = withContext
        ? `(?=(?:\\s+(?:\\*{1,3})?\\([^)]+\\)(?:\\*{1,3})?(?:\\s+${ruleContext}\\b)?|\\s+${ruleContext}\\b))`
        : '(?=$|[^\\p{L}\\p{N}\'-])'

    return new RegExp(`(^|[^\\p{L}\\p{N}'-])(${markedName})${lookahead}`, 'giu')
}

function buildGlossaryMatcher(glossary?: Glossary | null, currentRuleName?: string) {
    if (!glossary) return null

    const rules = Object.entries(glossary).flatMap(([category, entries]) =>
        Object.entries(entries)
            .filter(([name]) => name !== currentRuleName)
            .map(([name, text]) => ({ category, name, text })),
    )

    if (rules.length === 0) return null

    const byName = new Map(rules.map((rule) => [rule.name, rule]))
    const autoRules = rules
        .map((rule) => ({
            rule,
            pattern: ruleNamePattern(
                rule.name,
                !rule.name.includes(' ')
                    || (rule.category === 'qualities' && criticalDamageQualityNames.has(rule.name)),
            ),
        }))
        .sort((a, b) => b.rule.name.length - a.rule.name.length)

    return { byName, autoRules }
}

function resolveExplicitRule(
    matcher: ReturnType<typeof buildGlossaryMatcher>,
    category: string | undefined,
    name: string,
) {
    if (!matcher) return null

    const rule = matcher.byName.get(name.trim())
    if (!rule) return null
    if (category && rule.category !== category) return null

    return rule
}

function isInsideRange(start: number, end: number, ranges: Array<{ start: number; end: number }>) {
    return ranges.some((range) => start < range.end && end > range.start)
}

function findRuleSegments(
    text: string,
    matcher: ReturnType<typeof buildGlossaryMatcher>,
): Array<{ start: number; end: number; label: string; rule: GlossaryRuleLink }> {
    if (!matcher) return []

    const segments: Array<{ start: number; end: number; label: string; rule: GlossaryRuleLink }> = []
    const explicitRanges: Array<{ start: number; end: number }> = []

    for (const match of text.matchAll(explicitRulePattern)) {
        const rule = resolveExplicitRule(matcher, match[1], match[2])
        const matchIndex = match.index ?? 0
        const end = matchIndex + match[0].length
        explicitRanges.push({ start: matchIndex, end })

        if (!rule) continue

        segments.push({
            start: matchIndex,
            end,
            label: match[3] ?? rule.name,
            rule,
        })
    }

    for (const { pattern, rule } of matcher.autoRules) {
        pattern.lastIndex = 0

        for (const match of text.matchAll(pattern)) {
            const leading = match[1]
            const matchIndex = match.index ?? 0
            const start = matchIndex + leading.length
            const end = matchIndex + match[0].length

            if (isInsideRange(start, end, explicitRanges) || isInsideRange(start, end, segments)) continue

            segments.push({
                start,
                end,
                label: rule.name,
                rule,
            })
        }
    }

    return segments.sort((a, b) => a.start - b.start || b.end - a.end)
}

function renderInline(
    text: string,
    keyPrefix = 'inline',
): ReactNode[] {
    const nodes: ReactNode[] = []
    let lastIndex = 0

    for (const match of text.matchAll(inlineTokenPattern)) {
        const token = match[0]
        const matchIndex = match.index ?? 0

        if (matchIndex > lastIndex) {
            nodes.push(text.slice(lastIndex, matchIndex))
        }

        if (token.startsWith('***')) {
            nodes.push(
                <strong key={`${keyPrefix}-${matchIndex}`}>
                    <em>{token.slice(3, -3)}</em>
                </strong>,
            )
        } else if (token.startsWith('**')) {
            nodes.push(
                <strong key={`${keyPrefix}-${matchIndex}`}>
                    {token.slice(2, -2)}
                </strong>,
            )
        } else {
            nodes.push(
                <em key={`${keyPrefix}-${matchIndex}`}>
                    {token.slice(1, -1)}
                </em>,
            )
        }

        lastIndex = matchIndex + token.length
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex))
    }

    return nodes
}

function renderParagraph(
    paragraph: string,
    matcher: ReturnType<typeof buildGlossaryMatcher>,
    onRuleClick?: (rule: GlossaryRuleLink) => void,
    paragraphIndex = 0,
) {
    return paragraph.split('\n').map((line, lineIndex) => {
        const segments = onRuleClick ? findRuleSegments(line, matcher) : []
        const nodes: ReactNode[] = []
        let lastIndex = 0

        segments.forEach((segment, segmentIndex) => {
            if (segment.start > lastIndex) {
                nodes.push(...renderInline(line.slice(lastIndex, segment.start), `${paragraphIndex}-${lineIndex}-${lastIndex}`))
            }

            nodes.push(
                <button
                    key={`${paragraphIndex}-${lineIndex}-${segment.start}-${segment.rule.name}-${segmentIndex}`}
                    type="button"
                    className="rule-inline-link"
                    onClick={() => onRuleClick?.(segment.rule)}
                >
                    {segment.label}
                </button>,
            )
            lastIndex = segment.end
        })

        if (lastIndex < line.length) {
            nodes.push(...renderInline(line.slice(lastIndex), `${paragraphIndex}-${lineIndex}-${lastIndex}`))
        }

        return (
            <Fragment key={`${paragraphIndex}-${lineIndex}`}>
                {lineIndex > 0 ? <br /> : null}
                {nodes}
            </Fragment>
        )
    })
}

export function MarkdownText({ text, className, style, glossary, currentRuleName, onRuleClick }: Props) {
    const matcher = buildGlossaryMatcher(glossary, currentRuleName)

    return (
        <div className={className} style={style}>
            {text.split(/\n{2,}/).map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>
                    {renderParagraph(paragraph, matcher, onRuleClick, paragraphIndex)}
                </p>
            ))}
        </div>
    )
}
