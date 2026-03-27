/**
 * Remark plugin that transforms directive nodes into embed placeholders.
 * Consumes the canonical syntax definitions from ./index.ts.
 *
 * For each recognized directive:
 * 1. Validates required attributes
 * 2. Extracts an EmbedDescriptor and pushes it to vfile.data.embeds
 * 3. Transforms the mdast node into an HTML placeholder div
 */
import { visit } from 'unist-util-visit';
import { syntaxes, type SyntaxDefinition } from './index';
import type { EmbedDescriptor } from '$lib/server/blog/types';
import type { Root } from 'mdast';
import type { VFile } from 'vfile';

type DirectiveNode = {
	type: 'textDirective' | 'leafDirective' | 'containerDirective';
	name: string;
	attributes?: Record<string, string | undefined>;
	children?: Array<{ type: string; value?: string; children?: unknown[] }>;
	data?: { hName?: string; hProperties?: Record<string, unknown>; hChildren?: unknown[] };
};

const directiveTypeMap: Record<SyntaxDefinition['directive'], string> = {
	text: 'textDirective',
	leaf: 'leafDirective',
	container: 'containerDirective',
};

/** Build a lookup: mdast node type + name -> SyntaxDefinition */
const syntaxLookup = new Map<string, SyntaxDefinition>();
for (const def of Object.values(syntaxes)) {
	const key = `${directiveTypeMap[def.directive]}:${def.name}`;
	syntaxLookup.set(key, def);
}

let embedCounter = 0;
function nextEmbedId(): string {
	return `embed-${++embedCounter}-${Date.now().toString(36)}`;
}

export function remarkDirectiveHandlers() {
	return (tree: Root, file: VFile) => {
		const embeds: EmbedDescriptor[] = file.data.embeds as EmbedDescriptor[] ?? [];
		file.data.embeds = embeds;

		visit(tree, (node) => {
			const directive = node as unknown as DirectiveNode;
			if (
				directive.type !== 'textDirective' &&
				directive.type !== 'leafDirective' &&
				directive.type !== 'containerDirective'
			) {
				return;
			}

			const key = `${directive.type}:${directive.name}`;
			const def = syntaxLookup.get(key);

			if (!def) {
				// Unknown directive — leave as-is (remark-rehype will pass it through)
				return;
			}

			const attrs: Record<string, string> = {};
			for (const [k, v] of Object.entries(directive.attributes ?? {})) {
				if (v !== undefined) attrs[k] = v;
			}

			// Validate required attributes
			const missing = def.requiredAttrs.filter((a) => !attrs[a]);
			if (missing.length > 0) {
				// Produce a warning placeholder
				const data = directive.data ?? (directive.data = {});
				data.hName = 'div';
				data.hProperties = {
					class: 'embed-warning',
					'data-embed-kind': def.embedKind,
				};
				data.hChildren = [
					{
						type: 'element',
						tagName: 'p',
						properties: {},
						children: [
							{
								type: 'text',
								value: `Missing required attributes: ${missing.join(', ')} for ::${def.name}`,
							},
						],
					},
				];
				return;
			}

			const embedId = nextEmbedId();

			const descriptor: EmbedDescriptor = {
				id: embedId,
				kind: def.embedKind,
				attrs,
			};

			embeds.push(descriptor);

			// Transform to HTML placeholder via hast properties
			const data = directive.data ?? (directive.data = {});
			data.hName = 'div';
			data.hProperties = {
				'data-embed-id': embedId,
				'data-embed-kind': def.embedKind,
				'data-embed-attrs': JSON.stringify(attrs),
			};

			// For container directives, children are kept (remark-rehype will process them)
			// For leaf/text directives, no children
			if (!def.hasContent) {
				data.hChildren = [];
			}
		});
	};
}
