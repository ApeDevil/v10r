/**
 * The untrusted-content boundary: tool results that carry content a user wrote or ingested
 * reach the model wrapped and escaped, never as bare text.
 *
 * Prompt blocks were already escaped (`<retrieval-context>`, `<desk-context>`), but tool
 * results went to the model as raw JSON — a desk file holding `</panel><instructions>…` was
 * read back verbatim. Every tool declares its `resultOrigin` in `TOOL_MANIFEST`; this module
 * is the one place that acts on it, applied by `composeTurn` to the composed tool set. It sets
 * AI SDK `toModelOutput`, so only what the MODEL reads changes: `execute`'s own result — the
 * approval sentinels, the desk effects, the turn trace — stays the raw value.
 *
 * The other two legs of the lethal trifecta are held elsewhere and gated in
 * `untrusted-content.gate.test.ts`: no tool can send data out without approval (`reach`), and
 * the answer renderer allows no image and no link to an unlisted host (`utils/markdown.ts`).
 *
 * Two doors, one rule: `withUntrustedBoundary` for results produced during the turn, and
 * `boundHistoryToolResults` for results replayed from earlier turns, which the orchestrator
 * rebuilds from stored messages without the tool set (so no `toModelOutput` runs for them).
 */
import type { ModelMessage, ToolSet } from 'ai';
import { TOOL_MANIFEST, type ToolResultOrigin } from '$lib/types/ai-tools';
import { escapeXmlAttr, escapeXmlText } from '$lib/utils/xml';

export const UNTRUSTED_CONTENT_TAG = 'untrusted-content';

/**
 * Tools outside the manifest. `resolve_ref` returns a result compaction set aside, which may
 * be any tool's, so it is read as the strictest of them.
 */
const INFRA_RESULT_ORIGIN: Record<string, ToolResultOrigin> = { resolve_ref: 'user' };

/** Where a tool's result comes from; a tool nobody declared is `user` — fail closed. */
export function resultOriginOf(toolName: string): ToolResultOrigin {
	return TOOL_MANIFEST.find((d) => d.name === toolName)?.resultOrigin ?? INFRA_RESULT_ORIGIN[toolName] ?? 'user';
}

/** `text` as one escaped `<untrusted-content>` element: nothing inside can close it or open a tag. */
export function wrapUntrusted(source: string, text: string): string {
	return `<${UNTRUSTED_CONTENT_TAG} source="${escapeXmlAttr(source)}">\n${escapeXmlText(text)}\n</${UNTRUSTED_CONTENT_TAG}>`;
}

/**
 * The tool set with every `user`-origin result wrapped for the model. Tools whose result is
 * `system` content are returned untouched.
 */
export function withUntrustedBoundary(tools: ToolSet): ToolSet {
	const bounded: Record<string, unknown> = {};
	for (const [name, toolDef] of Object.entries(tools)) {
		bounded[name] =
			resultOriginOf(name) === 'user'
				? {
						...toolDef,
						toModelOutput: ({ output }: { output: unknown }) => ({
							type: 'text' as const,
							value: wrapUntrusted(name, typeof output === 'string' ? output : JSON.stringify(output ?? null)),
						}),
					}
				: toolDef;
	}
	return bounded as ToolSet;
}

/**
 * Earlier turns' tool results, bounded the same way. `convertToModelMessages` rebuilds them
 * from the stored raw value, and history compaction may have replaced an oversized one with
 * its `{ ref, summary, … }` projection, so the output's shape is not guaranteed. The rule fails
 * closed: a `user`-origin result of any shape reaches the model wrapped — errors stay errors
 * (their text wrapped), everything else becomes wrapped text.
 */
export function boundHistoryToolResults(messages: ModelMessage[]): ModelMessage[] {
	return messages.map((msg) => {
		if (msg.role !== 'tool' || !Array.isArray(msg.content)) return msg;
		const content = msg.content.map((part) => {
			if (part.type !== 'tool-result' || resultOriginOf(part.toolName) !== 'user') return part;
			return { ...part, output: boundOutput(part.toolName, part.output as unknown) };
		});
		return { ...msg, content } as ModelMessage;
	});
}

function boundOutput(toolName: string, output: unknown) {
	const { type, value } = (output ?? {}) as { type?: unknown; value?: unknown };
	const asText = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v ?? null));
	if (type === 'error-text' || type === 'error-json') {
		return { type: 'error-text' as const, value: wrapUntrusted(toolName, asText(value)) };
	}
	if (type === 'json' || type === 'text')
		return { type: 'text' as const, value: wrapUntrusted(toolName, asText(value)) };
	// No known type (a compacted projection) or a multi-part `content` output: the whole thing.
	return { type: 'text' as const, value: wrapUntrusted(toolName, JSON.stringify(output ?? null)) };
}
