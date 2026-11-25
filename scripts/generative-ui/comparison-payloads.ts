/**
 * The bench's comparison payloads — each generative surface scenario written the two other
 * ways a product could ship the same UI, by hand, so the token counts compare like with like:
 *
 * - **baseline**: the tool-driven way v10r ships UI today. The model calls a tool with
 *   structured data and a fixed, hand-built card renders it (`PlanCard` style). The payload is
 *   only the data; the cost moves into one card component per kind of surface.
 * - **json-render**: Vercel json-render's flat spec (`root` + `elements` + `state`, with
 *   `$bindState` and `on.press`), the measured fallback renderer. A follow-up batch is the
 *   RFC 6902 patch list its SpecStream would send.
 *
 * Keyed by scenario id (`#lib/generative-ui/fixtures/scenarios.ts`).
 */

export interface ComparisonPayloads {
	baseline: unknown;
	jsonRender: unknown;
	followUp?: { baseline: unknown; jsonRender: unknown };
}

const bind = (path: string) => ({ $bindState: path });

export const COMPARISON_PAYLOADS: Record<string, ComparisonPayloads> = {
	'requirements-form': {
		baseline: {
			card: 'requirements_form',
			title: 'Project requirements',
			intro: 'Answer what you know; leave the rest blank.',
			fields: [
				{ key: 'name', label: 'Project name', kind: 'text' },
				{ key: 'summary', label: 'What should it do?', kind: 'longText' },
				{
					key: 'deployment',
					label: 'Where will it run?',
					kind: 'choice',
					options: [
						['cloud', 'Cloud'],
						['on-prem', 'On premises'],
						['edge', 'Edge'],
					],
				},
				{ key: 'auth', label: 'Users must sign in', kind: 'boolean' },
				{ key: 'users', label: 'Expected users', kind: 'range', min: 0, max: 1000, step: 10 },
			],
			defaults: { name: '', summary: '', deployment: ['cloud'], auth: true, users: 50 },
			submit: { label: 'Continue', event: 'collect_requirements' },
		},
		jsonRender: {
			root: 'root',
			state: { requirements: { name: '', summary: '', deployment: ['cloud'], auth: true, users: 50 } },
			elements: {
				root: { type: 'Card', props: { title: 'Project requirements' }, children: ['form'] },
				form: {
					type: 'Stack',
					props: {},
					children: ['intro', 'name', 'summary', 'deployment', 'auth', 'users', 'submit'],
				},
				intro: { type: 'Text', props: { text: 'Answer what you know; leave the rest blank.', variant: 'caption' } },
				name: { type: 'TextField', props: { label: 'Project name', value: bind('/requirements/name') } },
				summary: {
					type: 'TextField',
					props: { label: 'What should it do?', value: bind('/requirements/summary'), multiline: true },
				},
				deployment: {
					type: 'Select',
					props: {
						label: 'Where will it run?',
						options: [
							{ label: 'Cloud', value: 'cloud' },
							{ label: 'On premises', value: 'on-prem' },
							{ label: 'Edge', value: 'edge' },
						],
						value: bind('/requirements/deployment'),
					},
				},
				auth: { type: 'Checkbox', props: { label: 'Users must sign in', checked: bind('/requirements/auth') } },
				users: {
					type: 'Slider',
					props: { label: 'Expected users', min: 0, max: 1000, step: 10, value: bind('/requirements/users') },
				},
				submit: {
					type: 'Button',
					props: { label: 'Continue', variant: 'primary' },
					on: { press: { action: 'collect_requirements', params: { requirements: { $state: '/requirements' } } } },
				},
			},
		},
	},
	'technology-comparison': {
		baseline: {
			card: 'comparison_table',
			title: 'Database options',
			caption: 'Fit for a small multi-tenant SaaS',
			columns: ['Option', 'Tenancy model', 'Operations', 'Cost at small scale'],
			rows: [
				['Postgres', 'Schema or row-level security', 'Managed service or one server', 'Low'],
				['SQLite', 'One file per tenant', 'Almost none', 'Lowest'],
				['DynamoDB', 'Partition key per tenant', 'Fully managed', 'Pay per request'],
			],
			verdicts: [
				['success', 'Recommended: Postgres'],
				['warning', 'Watch: connection limits'],
			],
			note: 'Row-level security keeps one schema while isolating tenants.',
		},
		jsonRender: {
			root: 'root',
			elements: {
				root: { type: 'Stack', props: {}, children: ['title', 'table', 'verdicts', 'note'] },
				title: { type: 'Heading', props: { text: 'Database options', level: 3 } },
				table: {
					type: 'Table',
					props: {
						caption: 'Fit for a small multi-tenant SaaS',
						columns: ['Option', 'Tenancy model', 'Operations', 'Cost at small scale'],
						rows: [
							['Postgres', 'Schema or row-level security', 'Managed service or one server', 'Low'],
							['SQLite', 'One file per tenant', 'Almost none', 'Lowest'],
							['DynamoDB', 'Partition key per tenant', 'Fully managed', 'Pay per request'],
						],
					},
				},
				verdicts: { type: 'Inline', props: {}, children: ['pick', 'watch'] },
				pick: { type: 'Badge', props: { text: 'Recommended: Postgres', tone: 'success' } },
				watch: { type: 'Badge', props: { text: 'Watch: connection limits', tone: 'warning' } },
				note: {
					type: 'Text',
					props: { text: 'Row-level security keeps one schema while isolating tenants.', variant: 'caption' },
				},
			},
		},
	},
	'architecture-selection': {
		baseline: {
			card: 'architecture_choice',
			title: 'Choose a starting architecture',
			why: 'A team of three ships fastest with one deployable; the options differ in how they split later.',
			options: [
				['monolith', 'Monolith'],
				['modular-monolith', 'Modular monolith'],
				['services', 'Services'],
			],
			selected: 'modular-monolith',
			primary: { label: 'Use this architecture', event: 'select_architecture' },
			secondary: { label: 'Explain the trade-offs', event: 'explain_tradeoffs' },
		},
		jsonRender: {
			root: 'root',
			state: { selection: { architecture: ['modular-monolith'] } },
			elements: {
				root: { type: 'Card', props: { title: 'Choose a starting architecture' }, children: ['body'] },
				body: { type: 'Stack', props: {}, children: ['why', 'choice', 'actions'] },
				why: {
					type: 'Text',
					props: {
						text: 'A team of three ships fastest with one deployable; the options differ in how they split later.',
					},
				},
				choice: {
					type: 'Select',
					props: {
						label: 'Architecture',
						options: [
							{ label: 'Monolith', value: 'monolith' },
							{ label: 'Modular monolith', value: 'modular-monolith' },
							{ label: 'Services', value: 'services' },
						],
						value: bind('/selection/architecture'),
					},
				},
				actions: { type: 'Inline', props: { justify: 'end' }, children: ['choose', 'explain'] },
				choose: {
					type: 'Button',
					props: { label: 'Use this architecture', variant: 'primary' },
					on: {
						press: {
							action: 'select_architecture',
							params: { architecture: { $state: '/selection/architecture' } },
						},
					},
				},
				explain: {
					type: 'Button',
					props: { label: 'Explain the trade-offs', variant: 'ghost' },
					on: { press: { action: 'explain_tradeoffs' } },
				},
			},
		},
	},
	'dynamic-update': {
		baseline: {
			card: 'cost_estimate',
			title: 'Monthly cost estimate',
			status: 'Estimating…',
		},
		jsonRender: {
			root: 'root',
			state: { estimate: { status: 'Estimating…', monthly: '' } },
			elements: {
				root: { type: 'Card', props: { title: 'Monthly cost estimate' }, children: ['body'] },
				body: { type: 'Stack', props: {}, children: ['status'] },
				status: { type: 'Text', props: { text: { $state: '/estimate/status' } } },
			},
		},
		followUp: {
			// A fixed card cannot be patched: the tool is called again with the whole card.
			baseline: {
				card: 'cost_estimate',
				title: 'Monthly cost estimate',
				status: 'About $70 per month.',
				badge: ['success', 'Within budget'],
				breakdown: [
					['Compute', '$40'],
					['Database', '$25'],
					['Storage', '$5'],
				],
				refine: { label: 'Refine the estimate', event: 'refine_estimate' },
				monthly: '70',
			},
			jsonRender: [
				{ op: 'replace', path: '/elements/body/children', value: ['status', 'badge', 'breakdown', 'refine'] },
				{
					op: 'add',
					path: '/elements/badge',
					value: { type: 'Badge', props: { text: 'Within budget', tone: 'success' } },
				},
				{
					op: 'add',
					path: '/elements/breakdown',
					value: {
						type: 'Table',
						props: {
							columns: ['Item', 'Per month'],
							rows: [
								['Compute', '$40'],
								['Database', '$25'],
								['Storage', '$5'],
							],
						},
					},
				},
				{
					op: 'add',
					path: '/elements/refine',
					value: {
						type: 'Button',
						props: { label: 'Refine the estimate' },
						on: { press: { action: 'refine_estimate', params: { monthly: { $state: '/estimate/monthly' } } } },
					},
				},
				{ op: 'replace', path: '/state/estimate', value: { status: 'About $70 per month.', monthly: '70' } },
			],
		},
	},
};
