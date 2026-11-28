/**
 * The pattern explorer View — the browser program inside the MCP Apps resource
 * `ui://v10r/pattern-explorer.html`. Built into one self-contained HTML document by
 * `scripts/mcp/build-app-views.ts`; never imported by the app (it lives under `server/` so
 * SvelteKit refuses to put it in the client bundle by accident).
 *
 * It talks to the host only through the official app-side bridge (`App` over
 * `PostMessageTransport`): the host pushes the `explore_patterns` result it called, and picking
 * another pattern asks the host to call the same tool on the server. No fetch, no storage, no
 * credentials — the resource's CSP declares no domain at all. It renders the server's projection
 * (`pattern-library/dependency-explorer.ts`) and computes nothing about the graph itself.
 */

import {
	App,
	applyDocumentTheme,
	applyHostStyleVariables,
	type McpUiHostContext,
	PostMessageTransport,
} from '@modelcontextprotocol/ext-apps';
import type { ExploredPattern, PatternExploration } from '#patterns/dependency-explorer.ts';

const TOOL = 'explore_patterns';

interface ToolAnswer {
	isError?: boolean;
	content?: Array<{ type: string; text?: string }>;
	structuredContent?: unknown;
}

interface ViewModel {
	exploration: PatternExploration | null;
	/** Every pattern the View can name — grows as answers arrive; the picker lists it. */
	known: Map<string, ExploredPattern>;
	/** The overview's ids in category order, once loaded. */
	catalog: string[];
	filter: string;
	notice: { tone: 'info' | 'error'; text: string } | null;
	busy: boolean;
}

const model: ViewModel = { exploration: null, known: new Map(), catalog: [], filter: '', notice: null, busy: false };

const app = new App({ name: 'v10r-pattern-explorer', version: '1.0.0' }, {}, { autoResize: true });

// ---------------------------------------------------------------------------------------------
// DOM helpers — text only; nothing from an answer is ever parsed as HTML.

type Child = Node | string | null | false;

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...children: Child[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
	for (const child of children) {
		if (child === null || child === false) continue;
		element.append(child);
	}
	return element;
}

function chip(id: string, current: boolean): HTMLButtonElement {
	const title = model.known.get(id)?.title ?? id;
	const button = el('button', { type: 'button', class: 'chip', title, 'aria-current': String(current) }, id);
	button.addEventListener('click', () => void explore(id));
	return button;
}

// ---------------------------------------------------------------------------------------------
// Answers

function isExploration(value: unknown): value is PatternExploration {
	if (typeof value !== 'object' || value === null) return false;
	const kind = (value as { kind?: unknown }).kind;
	return (kind === 'focus' || kind === 'overview') && Array.isArray((value as { patterns?: unknown }).patterns);
}

function textOf(answer: ToolAnswer): string {
	return (answer.content ?? [])
		.map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
		.join('\n')
		.trim();
}

function absorb(answer: ToolAnswer): void {
	if (answer.isError) {
		model.notice = { tone: 'error', text: textOf(answer).split('\n\n')[0] || 'The explorer could not answer.' };
		return;
	}
	if (!isExploration(answer.structuredContent)) {
		model.notice = { tone: 'error', text: 'The answer carried no explorer data.' };
		return;
	}
	const exploration = answer.structuredContent;
	for (const pattern of exploration.patterns) model.known.set(pattern.id, pattern);
	if (exploration.kind === 'overview') model.catalog = exploration.categories.flatMap((category) => category.patterns);
	model.exploration = exploration;
	model.notice = null;
}

async function call(args: Record<string, unknown>): Promise<ToolAnswer | null> {
	try {
		return (await app.callServerTool({ name: TOOL, arguments: args })) as ToolAnswer;
	} catch {
		model.notice = { tone: 'error', text: 'The host did not complete the call.' };
		return null;
	}
}

async function explore(id: string | null): Promise<void> {
	model.busy = true;
	render();
	const answer = await call(id === null ? {} : { id });
	model.busy = false;
	if (answer) absorb(answer);
	render();
	if (answer && !answer.isError && id !== null) shareFocus(id);
}

/** Tell the model what the person is looking at — only where the host offers it. */
function shareFocus(id: string): void {
	if (!app.getHostCapabilities()?.updateModelContext) return;
	const pattern = model.known.get(id);
	void app
		.updateModelContext({
			content: [
				{
					type: 'text',
					text: `The user is viewing pattern "${id}"${pattern ? ` (${pattern.title})` : ''} in the explorer.`,
				},
			],
		})
		.catch(() => {});
}

/** The picker needs the overview's id list; a focus answer arrives without it. */
async function loadCatalog(): Promise<void> {
	if (model.catalog.length > 0) return;
	const answer = await call({});
	if (!answer || answer.isError || !isExploration(answer.structuredContent)) return;
	const overview = answer.structuredContent;
	for (const pattern of overview.patterns) model.known.set(pattern.id, pattern);
	if (overview.kind === 'overview') model.catalog = overview.categories.flatMap((category) => category.patterns);
	render();
}

// ---------------------------------------------------------------------------------------------
// Rendering

function picker(): HTMLElement {
	const focusId = model.exploration?.kind === 'focus' ? model.exploration.focus.id : null;
	const needle = model.filter.trim().toLowerCase();
	const ids = (model.catalog.length > 0 ? model.catalog : [...model.known.keys()]).filter((id) => {
		if (needle.length === 0) return true;
		const pattern = model.known.get(id);
		return id.includes(needle) || (pattern?.title.toLowerCase().includes(needle) ?? false);
	});
	return el(
		'div',
		{ class: 'picker', role: 'list', 'aria-label': 'Patterns in the dependency graph' },
		...ids.map((id) => chip(id, id === focusId)),
		ids.length === 0 ? el('span', { class: 'notice' }, 'No pattern matches the filter.') : null,
	);
}

function linkList(entries: Array<{ id: string; depth?: number }>, empty: string): HTMLElement {
	if (entries.length === 0) return el('p', { class: 'muted' }, empty);
	return el(
		'ul',
		{ class: 'links' },
		...entries.map(({ id, depth }) =>
			el(
				'li',
				{},
				depth === undefined ? null : el('span', { class: 'depth', title: 'adoption hops' }, `${depth}↑`),
				chip(id, false),
				el('span', { class: 'muted' }, model.known.get(id)?.maturity ?? ''),
			),
		),
	);
}

function focusCard(exploration: Extract<PatternExploration, { kind: 'focus' }>): HTMLElement {
	const { focus } = exploration;
	const needs = focus.needsSummary;
	const more = focus.invariantCount - focus.invariants.length;
	const docs = el('button', { type: 'button', class: 'action' }, 'Open docs');
	docs.addEventListener('click', () => {
		void app.openLink({ url: focus.docsUrl }).catch(() => {
			model.notice = { tone: 'info', text: `Docs: ${focus.docsUrl}` };
			render();
		});
	});
	const overview = el('button', { type: 'button', class: 'action', 'data-variant': 'quiet' }, 'Graph overview');
	overview.addEventListener('click', () => void explore(null));
	return el(
		'article',
		{ class: 'card', 'aria-live': 'polite' },
		el('h2', {}, focus.title),
		el(
			'div',
			{ class: 'badges' },
			el('span', { class: 'badge', 'data-maturity': focus.maturity }, focus.maturity),
			el('span', { class: 'badge' }, focus.tier),
			el('span', { class: 'badge' }, focus.category),
		),
		el('p', {}, focus.summary),
		el('p', { class: 'muted' }, `Needs: ${needs.length > 0 ? needs : 'nothing beyond the app runtime'}`),
		focus.avoidWhen ? el('p', { class: 'muted' }, `Avoid when: ${focus.avoidWhen}`) : null,
		focus.invariantCount > 0
			? el(
					'section',
					{},
					el('h3', {}, `Invariants (${focus.invariantCount})`),
					el(
						'ul',
						{ class: 'invariants' },
						...focus.invariants.map((line) => el('li', {}, line)),
						more > 0 ? el('li', { class: 'muted' }, `… ${more} more in get_pattern`) : null,
					),
				)
			: null,
		el(
			'div',
			{ class: 'columns' },
			el(
				'section',
				{},
				el('h3', {}, `Adopting it builds (${focus.prerequisites.length})`),
				linkList(focus.prerequisites, 'Nothing beyond itself.'),
				focus.open.length > 0 ? el('h3', {}, `Conditional or optional (${focus.open.length})`) : null,
				focus.open.length > 0 ? linkList(focus.open, '') : null,
			),
			el(
				'section',
				{},
				el('h3', {}, `Built on or contained by (${focus.allDependents.length})`),
				linkList(
					focus.allDependents.map((id) => ({ id })),
					'Nothing builds on it yet.',
				),
			),
		),
		focus.cyclic ? el('p', { class: 'notice', 'data-tone': 'error' }, 'An adoption cycle touches this pattern.') : null,
		el('div', { class: 'actions' }, docs, overview),
	);
}

function overviewCard(exploration: Extract<PatternExploration, { kind: 'overview' }>): HTMLElement {
	return el(
		'article',
		{ class: 'card' },
		el('h2', {}, 'Dependency graph'),
		el(
			'p',
			{ class: 'muted' },
			`${exploration.patterns.length} patterns build on another or are built on; ${exploration.unconnected} stand alone. Pick one to see what it builds on and what builds on it.`,
		),
		el(
			'section',
			{},
			el('h3', {}, 'Hubs — most built on'),
			linkList(
				exploration.hubs.map((hub) => ({ id: hub.id })),
				'No hubs.',
			),
		),
	);
}

function render(): void {
	const root = document.getElementById('app');
	if (!root) return;
	const filter = el('input', {
		class: 'filter',
		type: 'search',
		placeholder: 'Filter patterns by id or title',
		'aria-label': 'Filter patterns',
	});
	filter.value = model.filter;
	filter.addEventListener('input', () => {
		model.filter = filter.value;
		const list = root.querySelector('.picker');
		list?.replaceWith(picker());
	});
	const exploration = model.exploration;
	root.replaceChildren(
		el(
			'div',
			{ class: 'explorer', 'aria-busy': String(model.busy) },
			el(
				'header',
				{ class: 'bar' },
				el('h1', {}, 'Pattern dependencies'),
				exploration ? el('span', { class: 'version' }, `registry ${exploration.registryDigest}`) : null,
			),
			filter,
			picker(),
			model.notice ? el('p', { class: 'notice', 'data-tone': model.notice.tone }, model.notice.text) : null,
			model.busy ? el('p', { class: 'notice' }, 'Loading…') : null,
			exploration?.kind === 'focus' ? focusCard(exploration) : null,
			exploration?.kind === 'overview' ? overviewCard(exploration) : null,
		),
	);
}

// ---------------------------------------------------------------------------------------------
// Host wiring — handlers are registered before connect so no one-shot notification is missed.

function applyContext(context: McpUiHostContext | undefined): void {
	if (!context) return;
	if (context.theme) applyDocumentTheme(context.theme);
	if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
}

app.ontoolinput = (params) => {
	const id = params.arguments?.id;
	model.notice = { tone: 'info', text: typeof id === 'string' ? `Exploring ${id}…` : 'Loading the graph…' };
	render();
};

app.ontoolresult = (result) => {
	absorb(result as ToolAnswer);
	render();
	void loadCatalog();
};

app.onhostcontextchanged = (context) => applyContext(context);

app.onteardown = async () => ({});

render();
app
	.connect(new PostMessageTransport(window.parent, window.parent))
	.then(() => applyContext(app.getHostContext()))
	.catch(() => {
		model.notice = { tone: 'error', text: 'This view runs inside an MCP Apps host; none answered.' };
		render();
	});
