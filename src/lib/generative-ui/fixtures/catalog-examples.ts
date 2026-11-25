/**
 * One committed surface per job the catalog's newer components exist for — a multi-step form
 * with validation feedback, parameter exploration with a chart, and the domain section's
 * architecture flow — each as A2UI v1.0 messages and as the Express source that compiles to
 * them, with the follow-up batch a model sends after the user's event. The compiler test
 * proves the two forms agree, the renderer test reads their markup, and the bench reports
 * their payload tokens beside the four comparison scenarios.
 */
import { GENERATIVE_UI_CATALOG_ID as CATALOG } from '../catalog.ts';
import type { GenerativeSurfaceScenario } from './scenarios.ts';

/**
 * Multi-step interaction and validation feedback: step 1 of 2 with a Progress; after the
 * user pressed Next with the name empty, the model answers with the field's bound error and a
 * Notice instead of moving on (the surface checks nothing itself — it has no functions).
 */
const stepForm: GenerativeSurfaceScenario = {
	id: 'step-form',
	title: 'Multi-step form with validation feedback',
	prompt: 'Walk me through setting up a new v10r project, one step at a time.',
	messages: [
		{
			version: '1.0',
			createSurface: {
				surfaceId: 'setup',
				catalogId: CATALOG,
				dataModel: { setup: { step: 1, name: '', nameError: '', notice: '' } },
			},
		},
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'setup',
				components: [
					{ id: 'root', component: 'Card', title: 'New project', child: 'body' },
					{ id: 'body', component: 'Column', children: ['progress', 'feedback', 'name', 'more', 'next'] },
					{ id: 'progress', component: 'Progress', label: 'Step 1 of 2', value: { '@path': '/setup/step' }, max: 2 },
					{ id: 'feedback', component: 'Notice', text: { '@path': '/setup/notice' }, tone: 'warning' },
					{
						id: 'name',
						component: 'TextField',
						label: 'Project name',
						value: { '@path': '/setup/name' },
						error: { '@path': '/setup/nameError' },
					},
					{ id: 'more', component: 'Expandable', title: 'Why a name?', child: 'why' },
					{ id: 'why', component: 'Text', text: 'It becomes the package name and the database prefix.' },
					{
						id: 'next',
						component: 'Button',
						label: 'Next',
						variant: 'primary',
						action: { event: { name: 'next_step', context: { name: { '@path': '/setup/name' } } } },
					},
				],
			},
		},
	],
	express: `surface("setup")
$/setup/name = ""
$/setup/nameError = ""
$/setup/notice = ""
$/setup/step = 1
root = Card(body, "New project")
body = Column([progress, feedback, name, more, next])
progress = Progress("Step 1 of 2", $/setup/step, 2)
feedback = Notice($/setup/notice, "warning")
name = TextField("Project name", $/setup/name, error=$/setup/nameError)
more = Expandable("Why a name?", why)
why = Text("It becomes the package name and the database prefix.")
next = Button("Next", Event("next_step", {name: $/setup/name}), "primary")`,
	followUp: {
		messages: [
			{
				version: '1.0',
				updateDataModel: {
					surfaceId: 'setup',
					path: '/setup',
					value: {
						step: 1,
						name: '',
						nameError: 'Give the project a name first.',
						notice: 'One field needs an answer before step 2.',
					},
				},
			},
		],
		express: `surface("setup")
$/setup = {step: 1, name: "", nameError: "Give the project a name first.", notice: "One field needs an answer before step 2."}`,
	},
};

/**
 * Parameter exploration: a Slider the user moves and a chart of what it changes. The surface
 * cannot recompute (no functions), so Recalculate sends the value and the model answers with
 * new chart data — an `updateComponents` of the Chart alone.
 */
const costExplorer: GenerativeSurfaceScenario = {
	id: 'cost-explorer',
	title: 'Parameter exploration with a chart',
	prompt: 'How does hosting cost change with the number of users?',
	messages: [
		{
			version: '1.0',
			createSurface: { surfaceId: 'costs', catalogId: CATALOG, dataModel: { costs: { users: 1000 } } },
		},
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'costs',
				components: [
					{ id: 'root', component: 'Column', children: ['chart', 'users', 'recalc'] },
					{
						id: 'chart',
						component: 'Chart',
						title: 'Monthly cost in dollars, 1,000 users',
						labels: ['Compute', 'Database', 'Storage'],
						series: [{ name: 'Cost', values: [40, 25, 5] }],
					},
					{
						id: 'users',
						component: 'Slider',
						label: 'Users',
						value: { '@path': '/costs/users' },
						max: 10000,
						step: 500,
					},
					{
						id: 'recalc',
						component: 'Button',
						label: 'Recalculate',
						action: { event: { name: 'recalculate', context: { users: { '@path': '/costs/users' } } } },
					},
				],
			},
		},
	],
	express: `surface("costs")
$/costs/users = 1000
root = Column([chart, users, recalc])
chart = Chart("Monthly cost in dollars, 1,000 users", ["Compute", "Database", "Storage"], [{name: "Cost", values: [40, 25, 5]}])
users = Slider("Users", $/costs/users, 10000, step=500)
recalc = Button("Recalculate", Event("recalculate", {users: $/costs/users}))`,
	followUp: {
		messages: [
			{
				version: '1.0',
				updateComponents: {
					surfaceId: 'costs',
					components: [
						{
							id: 'chart',
							component: 'Chart',
							title: 'Monthly cost in dollars, 1,000 and 5,000 users',
							labels: ['Compute', 'Database', 'Storage'],
							series: [
								{ name: '1,000 users', values: [40, 25, 5] },
								{ name: '5,000 users', values: [120, 60, 15] },
							],
						},
					],
				},
			},
		],
		express: `surface("costs")
chart = Chart("Monthly cost in dollars, 1,000 and 5,000 users", ["Compute", "Database", "Storage"], [{name: "1,000 users", values: [40, 25, 5]}, {name: "5,000 users", values: [120, 60, 15]}])`,
	},
};

/** The domain section: how a form post moves through v10r's architecture. */
const requestFlow: GenerativeSurfaceScenario = {
	id: 'request-flow',
	title: 'Architecture flow (domain component)',
	prompt: 'How does a form submission reach the database in v10r?',
	messages: [
		{ version: '1.0', createSurface: { surfaceId: 'flow', catalogId: CATALOG } },
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'flow',
				components: [
					{
						id: 'root',
						component: 'ArchitectureFlow',
						title: 'A form post, from the browser to the database',
						nodes: [
							{ label: 'Browser form', kind: 'client', note: 'use:enhance posts the form' },
							{ label: 'hooks.server.ts', kind: 'server', note: 'session, CSRF, rate limit' },
							{ label: '+page.server.ts action', kind: 'server', note: 'validates, calls the domain' },
							{ label: '#lib/server/[domain]', kind: 'server', note: 'framework-free business logic' },
							{ label: 'Postgres (Neon)', kind: 'data' },
						],
					},
				],
			},
		},
	],
	express: `surface("flow")
root = ArchitectureFlow("A form post, from the browser to the database", [{label: "Browser form", kind: "client", note: "use:enhance posts the form"}, {label: "hooks.server.ts", kind: "server", note: "session, CSRF, rate limit"}, {label: "+page.server.ts action", kind: "server", note: "validates, calls the domain"}, {label: "#lib/server/[domain]", kind: "server", note: "framework-free business logic"}, {label: "Postgres (Neon)", kind: "data"}])`,
};

export const GENERATIVE_SURFACE_CATALOG_EXAMPLES: readonly GenerativeSurfaceScenario[] = [
	stepForm,
	costExplorer,
	requestFlow,
];
