/**
 * Generative surface scenarios — the surfaces the pattern exists for, each as the A2UI v1.0
 * messages a model's output compiles to and as the A2UI Express source that compiles to them
 * (`@a2ui/agent`'s compact model-output format; `compileGenerativeSurface` proves the two
 * agree). The tests, the bench and a showcase page render these, so they are committed data,
 * not generated at run time.
 */
import { GENERATIVE_UI_CATALOG_ID as CATALOG } from '../catalog.ts';
import type { GenerativeSurfaceMessage } from '../messages.ts';

export interface GenerativeSurfaceScenario {
	id: string;
	title: string;
	/** What the user asked that made the model compose this surface. */
	prompt: string;
	messages: GenerativeSurfaceMessage[];
	/** The same surface in A2UI Express. */
	express: string;
	/** A later batch against the already rendered surface, when the scenario has one. */
	followUp?: { messages: GenerativeSurfaceMessage[]; express: string };
}

const requirementsForm: GenerativeSurfaceScenario = {
	id: 'requirements-form',
	title: 'Requirement collection form',
	prompt: 'Help me scope a new internal tool. Ask me what you need to know.',
	messages: [
		{
			version: '1.0',
			createSurface: {
				surfaceId: 'requirements',
				catalogId: CATALOG,
				dataModel: {
					requirements: { name: '', summary: '', deployment: ['cloud'], auth: true, users: 50 },
				},
			},
		},
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'requirements',
				components: [
					{ id: 'root', component: 'Card', title: 'Project requirements', child: 'form' },
					{
						id: 'form',
						component: 'Column',
						children: ['intro', 'name', 'summary', 'deployment', 'auth', 'users', 'submit'],
					},
					{
						id: 'intro',
						component: 'Text',
						text: 'Answer what you know; leave the rest blank.',
						variant: 'caption',
					},
					{ id: 'name', component: 'TextField', label: 'Project name', value: { '@path': '/requirements/name' } },
					{
						id: 'summary',
						component: 'TextField',
						label: 'What should it do?',
						value: { '@path': '/requirements/summary' },
						variant: 'longText',
					},
					{
						id: 'deployment',
						component: 'ChoicePicker',
						label: 'Where will it run?',
						options: [
							{ label: 'Cloud', value: 'cloud' },
							{ label: 'On premises', value: 'on-prem' },
							{ label: 'Edge', value: 'edge' },
						],
						value: { '@path': '/requirements/deployment' },
					},
					{ id: 'auth', component: 'CheckBox', label: 'Users must sign in', value: { '@path': '/requirements/auth' } },
					{
						id: 'users',
						component: 'Slider',
						label: 'Expected users',
						value: { '@path': '/requirements/users' },
						min: 0,
						max: 1000,
						step: 10,
					},
					{
						id: 'submit',
						component: 'Button',
						label: 'Continue',
						variant: 'primary',
						action: {
							event: { name: 'collect_requirements', context: { requirements: { '@path': '/requirements' } } },
						},
					},
				],
			},
		},
	],
	express: `surface("requirements")
$/requirements/auth = true
$/requirements/deployment = ["cloud"]
$/requirements/name = ""
$/requirements/summary = ""
$/requirements/users = 50
root = Card(form, "Project requirements")
form = Column([intro, name, summary, deployment, auth, users, submit])
intro = Text("Answer what you know; leave the rest blank.", "caption")
name = TextField("Project name", $/requirements/name)
summary = TextField("What should it do?", $/requirements/summary, "longText")
deployment = ChoicePicker("Where will it run?", [{label: "Cloud", value: "cloud"}, {label: "On premises", value: "on-prem"}, {label: "Edge", value: "edge"}], $/requirements/deployment)
auth = CheckBox("Users must sign in", $/requirements/auth)
users = Slider("Expected users", $/requirements/users, 1000, 0, 10)
submit = Button("Continue", Event("collect_requirements", {requirements: $/requirements}), "primary")`,
};

const technologyComparison: GenerativeSurfaceScenario = {
	id: 'technology-comparison',
	title: 'Technology comparison table',
	prompt: 'Compare Postgres, SQLite and DynamoDB for a small multi-tenant SaaS.',
	messages: [
		{ version: '1.0', createSurface: { surfaceId: 'comparison', catalogId: CATALOG } },
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'comparison',
				components: [
					{ id: 'root', component: 'Column', children: ['title', 'table', 'verdicts', 'note'] },
					{ id: 'title', component: 'Heading', text: 'Database options', level: 3 },
					{
						id: 'table',
						component: 'Table',
						caption: 'Fit for a small multi-tenant SaaS',
						columns: ['Option', 'Tenancy model', 'Operations', 'Cost at small scale'],
						rows: [
							['Postgres', 'Schema or row-level security', 'Managed service or one server', 'Low'],
							['SQLite', 'One file per tenant', 'Almost none', 'Lowest'],
							['DynamoDB', 'Partition key per tenant', 'Fully managed', 'Pay per request'],
						],
					},
					{ id: 'verdicts', component: 'Row', children: ['pick', 'watch'] },
					{ id: 'pick', component: 'Badge', text: 'Recommended: Postgres', tone: 'success' },
					{ id: 'watch', component: 'Badge', text: 'Watch: connection limits', tone: 'warning' },
					{
						id: 'note',
						component: 'Text',
						text: 'Row-level security keeps one schema while isolating tenants.',
						variant: 'caption',
					},
				],
			},
		},
	],
	express: `surface("comparison")
root = Column([title, table, verdicts, note])
title = Heading("Database options", 3)
table = Table(["Option", "Tenancy model", "Operations", "Cost at small scale"], [["Postgres", "Schema or row-level security", "Managed service or one server", "Low"], ["SQLite", "One file per tenant", "Almost none", "Lowest"], ["DynamoDB", "Partition key per tenant", "Fully managed", "Pay per request"]], "Fit for a small multi-tenant SaaS")
verdicts = Row([pick, watch])
pick = Badge("Recommended: Postgres", "success")
watch = Badge("Watch: connection limits", "warning")
note = Text("Row-level security keeps one schema while isolating tenants.", "caption")`,
};

const architectureSelection: GenerativeSurfaceScenario = {
	id: 'architecture-selection',
	title: 'Architecture selection',
	prompt: 'Which architecture should I start with for a team of three?',
	messages: [
		{
			version: '1.0',
			createSurface: {
				surfaceId: 'architecture',
				catalogId: CATALOG,
				dataModel: { selection: { architecture: ['modular-monolith'] } },
			},
		},
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'architecture',
				components: [
					{ id: 'root', component: 'Card', title: 'Choose a starting architecture', child: 'body' },
					{ id: 'body', component: 'Column', children: ['why', 'choice', 'actions'] },
					{
						id: 'why',
						component: 'Text',
						text: 'A team of three ships fastest with one deployable; the options differ in how they split later.',
					},
					{
						id: 'choice',
						component: 'ChoicePicker',
						label: 'Architecture',
						options: [
							{ label: 'Monolith', value: 'monolith' },
							{ label: 'Modular monolith', value: 'modular-monolith' },
							{ label: 'Services', value: 'services' },
						],
						value: { '@path': '/selection/architecture' },
					},
					{ id: 'actions', component: 'Row', children: ['choose', 'explain'], justify: 'end' },
					{
						id: 'choose',
						component: 'Button',
						label: 'Use this architecture',
						variant: 'primary',
						action: {
							event: { name: 'select_architecture', context: { architecture: { '@path': '/selection/architecture' } } },
						},
					},
					{
						id: 'explain',
						component: 'Button',
						label: 'Explain the trade-offs',
						variant: 'borderless',
						action: { event: { name: 'explain_tradeoffs' } },
					},
				],
			},
		},
	],
	express: `surface("architecture")
$/selection/architecture = ["modular-monolith"]
root = Card(body, "Choose a starting architecture")
body = Column([why, choice, actions])
why = Text("A team of three ships fastest with one deployable; the options differ in how they split later.")
choice = ChoicePicker("Architecture", [{label: "Monolith", value: "monolith"}, {label: "Modular monolith", value: "modular-monolith"}, {label: "Services", value: "services"}], $/selection/architecture)
actions = Row([choose, explain], "end")
choose = Button("Use this architecture", Event("select_architecture", {architecture: $/selection/architecture}), "primary")
explain = Button("Explain the trade-offs", Event("explain_tradeoffs"), "borderless")`,
};

/**
 * A surface that changes after it rendered: a progress card first, then — once the model has
 * the answer — the same surface gains a result, a status badge and new data, without being
 * re-created (`updateComponents` replaces by id, `updateDataModel` writes a path).
 */
const dynamicUpdate: GenerativeSurfaceScenario = {
	id: 'dynamic-update',
	title: 'Dynamic update of a rendered surface',
	prompt: 'Estimate the monthly cost of the architecture I picked.',
	messages: [
		{
			version: '1.0',
			createSurface: {
				surfaceId: 'estimate',
				catalogId: CATALOG,
				dataModel: { estimate: { status: 'Estimating…', monthly: '' } },
			},
		},
		{
			version: '1.0',
			updateComponents: {
				surfaceId: 'estimate',
				components: [
					{ id: 'root', component: 'Card', title: 'Monthly cost estimate', child: 'body' },
					{ id: 'body', component: 'Column', children: ['status'] },
					{ id: 'status', component: 'Text', text: { '@path': '/estimate/status' } },
				],
			},
		},
	],
	express: `surface("estimate")
$/estimate/monthly = ""
$/estimate/status = "Estimating…"
root = Card(body, "Monthly cost estimate")
body = Column([status])
status = Text($/estimate/status)`,
	followUp: {
		messages: [
			{
				version: '1.0',
				updateComponents: {
					surfaceId: 'estimate',
					components: [
						{ id: 'body', component: 'Column', children: ['status', 'badge', 'breakdown', 'refine'] },
						{ id: 'badge', component: 'Badge', text: 'Within budget', tone: 'success' },
						{
							id: 'breakdown',
							component: 'Table',
							columns: ['Item', 'Per month'],
							rows: [
								['Compute', '$40'],
								['Database', '$25'],
								['Storage', '$5'],
							],
						},
						{
							id: 'refine',
							component: 'Button',
							label: 'Refine the estimate',
							action: { event: { name: 'refine_estimate', context: { monthly: { '@path': '/estimate/monthly' } } } },
						},
					],
				},
			},
			{
				version: '1.0',
				updateDataModel: {
					surfaceId: 'estimate',
					path: '/estimate',
					value: { status: 'About $70 per month.', monthly: '70' },
				},
			},
		],
		express: `surface("estimate")
body = Column([status, badge, breakdown, refine])
badge = Badge("Within budget", "success")
breakdown = Table(["Item", "Per month"], [["Compute", "$40"], ["Database", "$25"], ["Storage", "$5"]])
refine = Button("Refine the estimate", Event("refine_estimate", {monthly: $/estimate/monthly}))
$/estimate = {status: "About $70 per month.", monthly: "70"}`,
	},
};

export const GENERATIVE_SURFACE_SCENARIOS: readonly GenerativeSurfaceScenario[] = [
	requirementsForm,
	technologyComparison,
	architectureSelection,
	dynamicUpdate,
];
