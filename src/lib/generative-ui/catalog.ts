/**
 * The v10r generative UI catalog — the A2UI v1.0 catalog document that says which components
 * a model may compose into a surface, and with which properties. Each entry is a JSON Schema
 * (draft 2020-12), the form the A2UI protocol exchanges catalogs in; `@a2ui/web_core` turns
 * the document into its runtime `Catalog` (`load-catalog.ts`), and `@a2ui/agent` turns it into
 * the model prompt and the payload validator (`#lib/server/ai/generative-ui/`).
 *
 * Every component maps onto one existing `#lib/components/` component (the mapping lives in
 * `composites/generative-surface/GenerativeSurfaceNode.svelte`), so a surface can only ever
 * look like the rest of the product: the component-first rule and the token colours hold for
 * model-composed UI by construction. The catalog is deliberately smaller than A2UI's basic
 * catalog — no Image, Video, Modal, Tabs or free-form markdown, no catalog functions — because
 * each of those is a channel (a URL, an overlay, rich text) this catalog does not need yet.
 *
 * Two sections, one catalog id: the **general** components any product could reuse, and the
 * **domain** components that only make sense for v10r's own subject (architecture). A project
 * adapting the pattern keeps the general section and replaces the domain one. Every component
 * costs prompt tokens on every turn the capability is active (`bun run genui:bench` measures
 * it), so each one is here because a scenario needs it, not for completeness.
 *
 * Plain data: no Svelte, no web_core, so the server, the renderer, the fixtures and the bench
 * all read the same document without pulling a runtime they do not use.
 */
import { GENERATIVE_SURFACE_LIMITS as LIMITS } from './limits.ts';

/** The catalog's identity on the wire (`createSurface.catalogId`). Versioned in the path. */
export const GENERATIVE_UI_CATALOG_ID = 'https://v10r.dev/a2ui/catalogs/v10r/v1/catalog.json';

/** The one protocol version v10r speaks. */
export const GENERATIVE_UI_PROTOCOL_VERSION = '1.0';

const COMMON = 'common_types.json#/$defs/';
const ref = (def: string, description: string) => ({ $ref: `${COMMON}${def}`, description });

const children = {
	$ref: `${COMMON}ChildList`,
	description: `The ids of the child components, in order (at most ${LIMITS.maxChildren}). Children are referenced by id, never inlined.`,
};

/** General-purpose components, in the order the prompt lists them. */
export const GENERATIVE_UI_GENERAL_COMPONENTS = [
	'Column',
	'Row',
	'Card',
	'Expandable',
	'Heading',
	'Text',
	'Badge',
	'Notice',
	'Divider',
	'TextField',
	'Slider',
	'ChoicePicker',
	'CheckBox',
	'Button',
	'Table',
	'Chart',
	'Progress',
] as const;

/** Domain components: v10r's own subject (software architecture). Listed after the general ones. */
export const GENERATIVE_UI_DOMAIN_COMPONENTS = ['ArchitectureFlow'] as const;

/** Every component the catalog holds, in prompt order. */
export const GENERATIVE_UI_COMPONENTS = [
	...GENERATIVE_UI_GENERAL_COMPONENTS,
	...GENERATIVE_UI_DOMAIN_COMPONENTS,
] as const;

export type GenerativeUiComponentName = (typeof GENERATIVE_UI_COMPONENTS)[number];

/** The kinds of architecture component an ArchitectureFlow node can be. */
export const ARCHITECTURE_FLOW_KINDS = ['client', 'server', 'data', 'external', 'job'] as const;

const definitions: Record<GenerativeUiComponentName, Record<string, unknown>> = {
	Column: {
		type: 'object',
		description: 'Arranges its children vertically. The usual root.',
		properties: {
			component: { const: 'Column' },
			children,
			gap: {
				type: 'string',
				enum: ['tight', 'normal', 'loose'],
				default: 'normal',
				description: 'Space between children.',
			},
		},
		required: ['component', 'children'],
		additionalProperties: false,
	},
	Row: {
		type: 'object',
		description: 'Arranges its children horizontally, wrapping on narrow screens.',
		properties: {
			component: { const: 'Row' },
			children,
			justify: {
				type: 'string',
				enum: ['start', 'center', 'end', 'spaceBetween'],
				default: 'start',
				description: 'Distribution along the row.',
			},
		},
		required: ['component', 'children'],
		additionalProperties: false,
	},
	Card: {
		type: 'object',
		description: 'A bordered panel with an optional title around one child. Wrap several elements in a Column first.',
		properties: {
			component: { const: 'Card' },
			child: ref('Child', 'The id of the single child component.'),
			title: ref('DynamicString', 'Optional title shown in the card header.'),
		},
		required: ['component', 'child'],
		additionalProperties: false,
	},
	Expandable: {
		type: 'object',
		description: 'A collapsed section the user opens to see one child, for detail most readers skip.',
		properties: {
			component: { const: 'Expandable' },
			title: ref('DynamicString', 'The visible title.'),
			child: ref('Child', 'The id of the child shown when open.'),
			open: { type: 'boolean', default: false, description: 'Start open.' },
		},
		required: ['component', 'title', 'child'],
		additionalProperties: false,
	},
	Heading: {
		type: 'object',
		description: 'A section heading.',
		properties: {
			component: { const: 'Heading' },
			text: ref('DynamicString', 'The heading text (plain text).'),
			level: { type: 'integer', enum: [2, 3, 4], default: 3, description: 'Outline level: 2 is a major section.' },
		},
		required: ['component', 'text'],
		additionalProperties: false,
	},
	Text: {
		type: 'object',
		description: 'A paragraph of plain text. Markdown and HTML are shown literally, never interpreted.',
		properties: {
			component: { const: 'Text' },
			text: ref('DynamicString', 'The text content.'),
			variant: {
				type: 'string',
				enum: ['body', 'caption'],
				default: 'body',
				description: 'caption is smaller and muted.',
			},
		},
		required: ['component', 'text'],
		additionalProperties: false,
	},
	Badge: {
		type: 'object',
		description: 'A short status label.',
		properties: {
			component: { const: 'Badge' },
			text: ref('DynamicString', 'One to three words.'),
			tone: {
				type: 'string',
				enum: ['neutral', 'info', 'success', 'warning', 'error'],
				default: 'neutral',
				description: 'Colour role of the badge.',
			},
		},
		required: ['component', 'text'],
		additionalProperties: false,
	},
	Notice: {
		type: 'object',
		description: 'A callout: validation feedback, a warning or a confirmation.',
		properties: {
			component: { const: 'Notice' },
			text: ref('DynamicString', 'The message.'),
			tone: { type: 'string', enum: ['info', 'success', 'warning', 'error'], default: 'info' },
			title: ref('DynamicString', 'Optional title.'),
		},
		required: ['component', 'text'],
		additionalProperties: false,
	},
	Divider: {
		type: 'object',
		description: 'A horizontal rule between groups.',
		properties: { component: { const: 'Divider' } },
		required: ['component'],
		additionalProperties: false,
	},
	TextField: {
		type: 'object',
		description: 'A labelled text input, two-way bound to the data model.',
		properties: {
			component: { const: 'TextField' },
			label: ref('DynamicString', 'The visible label.'),
			value: ref('DynamicString', 'Bind to a data model path, e.g. {"@path": "/form/name"}.'),
			variant: {
				type: 'string',
				enum: ['shortText', 'longText'],
				default: 'shortText',
				description: 'longText is a multi-line area.',
			},
			placeholder: ref('DynamicString', 'Hint text shown while empty.'),
			error: ref('DynamicString', 'Validation message under the field.'),
		},
		required: ['component', 'label', 'value'],
		additionalProperties: false,
	},
	Slider: {
		type: 'object',
		description: 'A labelled numeric range, two-way bound to the data model.',
		properties: {
			component: { const: 'Slider' },
			label: ref('DynamicString', 'The visible label.'),
			value: ref('DynamicNumber', 'Bind to a numeric data model path.'),
			max: { type: 'number', description: 'Highest value.' },
			min: { type: 'number', default: 0, description: 'Lowest value.' },
			step: { type: 'number', exclusiveMinimum: 0, default: 1, description: 'Increment.' },
		},
		required: ['component', 'label', 'value', 'max'],
		additionalProperties: false,
	},
	ChoicePicker: {
		type: 'object',
		description:
			'Choose one (mutuallyExclusive, a dropdown) or several (multipleSelection, a checkbox group) of a fixed list. The value is always a string list.',
		properties: {
			component: { const: 'ChoicePicker' },
			label: ref('DynamicString', 'The visible label of the group.'),
			options: {
				type: 'array',
				maxItems: LIMITS.maxChoiceOptions,
				description: 'The choices.',
				items: {
					type: 'object',
					properties: {
						label: { type: 'string', description: 'Shown to the user.' },
						value: { type: 'string', description: 'Stable value written to the data model.' },
					},
					required: ['label', 'value'],
					additionalProperties: false,
				},
			},
			value: ref('DynamicStringList', 'Bind to a string-list data model path.'),
			variant: {
				type: 'string',
				enum: ['mutuallyExclusive', 'multipleSelection'],
				default: 'mutuallyExclusive',
				description: 'One choice or several.',
			},
		},
		required: ['component', 'label', 'options', 'value'],
		additionalProperties: false,
	},
	CheckBox: {
		type: 'object',
		description: 'A labelled yes/no toggle, two-way bound to the data model.',
		properties: {
			component: { const: 'CheckBox' },
			label: ref('DynamicString', 'The visible label.'),
			value: ref('DynamicBoolean', 'Bind to a boolean data model path.'),
			variant: { type: 'string', enum: ['checkbox', 'switch'], default: 'checkbox', description: 'Visual style.' },
		},
		required: ['component', 'label', 'value'],
		additionalProperties: false,
	},
	Button: {
		type: 'object',
		description:
			'Sends an event to the assistant. It never changes anything by itself: the assistant decides what the event means.',
		properties: {
			component: { const: 'Button' },
			label: ref('DynamicString', 'The button text.'),
			action: ref(
				'Action',
				'An event: {"event": {"name": "...", "context": {...}}}. Context values may bind data paths.',
			),
			variant: {
				type: 'string',
				enum: ['primary', 'default', 'borderless'],
				default: 'default',
				description: 'primary for the main call to action.',
			},
		},
		required: ['component', 'label', 'action'],
		additionalProperties: false,
	},
	Table: {
		type: 'object',
		description: 'A static data table of plain-text cells, for comparisons.',
		properties: {
			component: { const: 'Table' },
			columns: {
				type: 'array',
				maxItems: LIMITS.maxTableColumns,
				items: { type: 'string' },
				description: 'Column headers.',
			},
			rows: {
				type: 'array',
				maxItems: LIMITS.maxTableRows,
				items: { type: 'array', maxItems: LIMITS.maxTableColumns, items: { type: 'string' } },
				description: 'One string per column, per row.',
			},
			caption: { type: 'string', description: 'What the table compares.' },
		},
		required: ['component', 'columns', 'rows'],
		additionalProperties: false,
	},
	Chart: {
		type: 'object',
		description:
			'A bar chart (bars from zero, values printed) of up to four series over shared labels, e.g. costs by item.',
		properties: {
			component: { const: 'Chart' },
			title: { type: 'string', description: 'What it shows (also its accessible name).' },
			labels: {
				type: 'array',
				maxItems: LIMITS.maxChartLabels,
				items: { type: 'string' },
				description: 'One per bar group.',
			},
			series: {
				type: 'array',
				minItems: 1,
				maxItems: LIMITS.maxChartSeries,
				items: {
					type: 'object',
					properties: {
						name: { type: 'string' },
						values: {
							type: 'array',
							maxItems: LIMITS.maxChartLabels,
							items: { type: 'number', minimum: 0 },
							description: 'One value per label.',
						},
					},
					required: ['name', 'values'],
					additionalProperties: false,
				},
			},
		},
		required: ['component', 'title', 'labels', 'series'],
		additionalProperties: false,
	},
	Progress: {
		type: 'object',
		description: 'A labelled progress bar, e.g. the step of a multi-step form.',
		properties: {
			component: { const: 'Progress' },
			label: ref('DynamicString', 'e.g. "Step 2 of 3".'),
			value: ref('DynamicNumber', 'Current value.'),
			max: { type: 'number', exclusiveMinimum: 0, default: 100 },
		},
		required: ['component', 'label', 'value'],
		additionalProperties: false,
	},
	ArchitectureFlow: {
		type: 'object',
		description: 'Domain: the components a request or job passes through, in order.',
		properties: {
			component: { const: 'ArchitectureFlow' },
			title: { type: 'string', description: 'What the flow shows.' },
			nodes: {
				type: 'array',
				minItems: 2,
				maxItems: LIMITS.maxFlowNodes,
				items: {
					type: 'object',
					properties: {
						label: { type: 'string', description: 'e.g. "+server.ts".' },
						kind: {
							type: 'string',
							enum: [...ARCHITECTURE_FLOW_KINDS],
							description: ARCHITECTURE_FLOW_KINDS.join(' | '),
						},
						note: { type: 'string', description: 'What happens there.' },
					},
					required: ['label', 'kind'],
					additionalProperties: false,
				},
			},
		},
		required: ['component', 'title', 'nodes'],
		additionalProperties: false,
	},
};

const INSTRUCTIONS = [
	'Compose the surface only from the components listed here; anything else is rejected.',
	'The root component has id "root"; every other component is reachable from it.',
	'Text is plain text: markdown and HTML are shown literally.',
	'Inputs (TextField, Slider, ChoicePicker, CheckBox) bind their value to a data model path; seed defaults in the data model.',
	'Multi-step: show one step and a Progress; replace the step when its event arrives. Feedback after an event: update a bound Notice or TextField error.',
	'Domain components (ArchitectureFlow) only for questions about v10r architecture.',
	'A Button only sends an event with its context to the assistant. Never describe a Button as saving, deleting or sending anything: the assistant decides, and changes still need the user to approve them.',
	'Never put URLs, secrets or personal data the user did not give you into a surface.',
].join('\n');

/**
 * The catalog document, in the A2UI v1.0 catalog format. Frozen so no caller can widen the
 * catalog at runtime; derive a narrower one with web_core's `Catalog.derive` instead.
 */
export const GENERATIVE_UI_CATALOG = Object.freeze({
	$schema: 'https://json-schema.org/draft/2020-12/schema',
	$id: GENERATIVE_UI_CATALOG_ID,
	catalogId: GENERATIVE_UI_CATALOG_ID,
	protocolVersion: GENERATIVE_UI_PROTOCOL_VERSION,
	title: 'v10r generative UI catalog',
	description:
		'Layout, text, feedback, form inputs, an event button, a table, a chart and progress, plus one v10r architecture component, rendered with v10r components.',
	instructions: INSTRUCTIONS,
	components: Object.fromEntries(GENERATIVE_UI_COMPONENTS.map((name) => [name, definitions[name]])),
});

export function isGenerativeUiComponent(name: unknown): name is GenerativeUiComponentName {
	return typeof name === 'string' && (GENERATIVE_UI_COMPONENTS as readonly string[]).includes(name);
}
