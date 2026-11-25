import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { ClientActionContract } from './contract';
import { createClientActionRunner } from './runner';
import { exposeClientActionsToWebMcp, WEBMCP_CALLS_PER_MINUTE, type WebMcpModelContext, webMcpRiskOf } from './webmcp';

const focus: ClientActionContract<{ section: string }> = {
	name: 'lab_focus_section',
	input: v.strictObject({ section: v.picklist(['skills', 'mcp', 'a2a']) }),
	timeoutMs: 500,
};
const erase: ClientActionContract<{ id: string }> = {
	name: 'lab_erase_everything',
	input: v.strictObject({ id: v.string() }),
	timeoutMs: 500,
};

type Registered = Parameters<WebMcpModelContext['registerTool']>[0] & { signal?: AbortSignal };

function fakeContext() {
	const tools: Registered[] = [];
	const context: WebMcpModelContext = {
		registerTool(tool, options) {
			tools.push({ ...tool, signal: options?.signal });
		},
	};
	return { context, tools };
}

describe('exposeClientActionsToWebMcp', () => {
	it('publishes a view action with its contract schema and runs it through the runner', async () => {
		const runner = createClientActionRunner([focus]);
		runner.register(focus, ({ section }) => ({ status: 'completed', observed: { focused: section } }));
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'Bring one section of the Lab into view.' },
			risks: { lab_focus_section: 'view' },
			shareObserved: ['lab_focus_section'],
			modelContext: context,
		});
		expect(exposure.published).toEqual(['lab_focus_section']);
		expect(tools[0].inputSchema).toMatchObject({ type: 'object', required: ['section'] });
		expect(tools[0].annotations).toEqual({ readOnlyHint: false, untrustedContentHint: true, consequentialHint: false });
		expect(await tools[0].execute({ section: 'mcp' })).toEqual({ status: 'completed', observed: { focused: 'mcp' } });
	});

	it('refuses invalid input the same way the in-app agent is refused', async () => {
		const runner = createClientActionRunner([focus]);
		runner.register(focus, () => ({ status: 'completed' }));
		const { context, tools } = fakeContext();
		exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
		});
		expect(await tools[0].execute({ section: '<script>' })).toMatchObject({ status: 'refused', code: 'invalid_input' });
	});

	it('never publishes an action that changes stored data, whatever the description says', () => {
		const runner = createClientActionRunner([erase]);
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [erase], {
			consent: true,
			descriptions: { lab_erase_everything: 'Harmless, read-only.' },
			risks: { lab_erase_everything: 'destructive' },
			modelContext: context,
		});
		expect(tools).toHaveLength(0);
		expect(exposure.refused).toEqual([{ name: 'lab_erase_everything', reason: 'risk_not_publishable' }]);
	});

	it('fails closed on an action with no declared risk or no description', () => {
		const runner = createClientActionRunner([focus, erase]);
		const exposure = exposeClientActionsToWebMcp(runner, [focus, erase], {
			consent: true,
			descriptions: {},
			modelContext: fakeContext().context,
		});
		expect(exposure.refused.map((r) => r.reason).sort()).toEqual(['unknown_risk', 'unknown_risk']);
	});

	it('publishes nothing in a browser without WebMCP and withdraws everything on dispose', () => {
		const runner = createClientActionRunner([focus]);
		const none = exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: null,
		});
		expect(none.published).toEqual([]);
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
		});
		expect(tools[0].signal?.aborted).toBe(false);
		exposure.dispose();
		expect(tools[0].signal?.aborted).toBe(true);
	});

	it('bounds an external agent that loops', async () => {
		const runner = createClientActionRunner([focus]);
		runner.register(focus, () => ({ status: 'completed' }));
		const { context, tools } = fakeContext();
		exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
			now: () => 1_000,
		});
		const results = [];
		for (let i = 0; i <= WEBMCP_CALLS_PER_MINUTE; i++) results.push(await tools[0].execute({ section: 'a2a' }));
		expect(results.at(-1)).toMatchObject({ status: 'refused', code: 'budget_exhausted' });
		expect(results.filter((r) => (r as { status: string }).status === 'completed')).toHaveLength(
			WEBMCP_CALLS_PER_MINUTE,
		);
	});

	it('lets the catalogue decide a known action: a page cannot lower its risk', () => {
		const openFile: ClientActionContract<{ fileId: string }> = {
			name: 'desk_open_file',
			input: v.strictObject({ fileId: v.string() }),
			timeoutMs: 500,
		};
		const runner = createClientActionRunner([openFile]);
		const lowered = exposeClientActionsToWebMcp(runner, [openFile], {
			consent: true,
			descriptions: { desk_open_file: 'Open a file.' },
			risks: { desk_open_file: 'read' },
			grantedScopes: ['desk:arrange'],
			modelContext: fakeContext().context,
		});
		expect(lowered.refused).toEqual([{ name: 'desk_open_file', reason: 'risk_conflicts_with_catalogue' }]);
		expect(webMcpRiskOf('desk_open_file', { desk_open_file: 'write' })).toEqual({ ok: true, risk: 'write' });
		expect(webMcpRiskOf('desk_open_file', undefined)).toEqual({ ok: true, risk: 'view' });
	});

	it('refuses a catalogued action whose scope the user does not hold', () => {
		const openFile: ClientActionContract<{ fileId: string }> = {
			name: 'desk_open_file',
			input: v.strictObject({ fileId: v.string() }),
			timeoutMs: 500,
		};
		const runner = createClientActionRunner([openFile]);
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [openFile], {
			consent: true,
			descriptions: { desk_open_file: 'Open a file.' },
			grantedScopes: [],
			modelContext: context,
		});
		expect(tools).toHaveLength(0);
		expect(exposure.refused).toEqual([{ name: 'desk_open_file', reason: 'scope_not_granted' }]);
	});

	it('publishes nothing without the user consenting', () => {
		const runner = createClientActionRunner([focus]);
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [focus], {
			consent: false,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
		});
		expect(tools).toHaveLength(0);
		expect(exposure.refused).toEqual([{ name: 'lab_focus_section', reason: 'no_consent' }]);
	});

	it('withholds observed facts unless the page shares them', async () => {
		const runner = createClientActionRunner([focus]);
		runner.register(focus, ({ section }) => ({ status: 'completed', observed: { focused: section } }));
		const { context, tools } = fakeContext();
		exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
		});
		expect(await tools[0].execute({ section: 'mcp' })).toEqual({ status: 'completed' });
	});

	it('refuses a second registration until the first lifecycle disposes, then refuses late calls', async () => {
		const runner = createClientActionRunner([focus]);
		runner.register(focus, () => ({ status: 'completed' }));
		const { context, tools } = fakeContext();
		const publication = {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' as const },
			modelContext: context,
		};
		const first = exposeClientActionsToWebMcp(runner, [focus], publication);
		const second = exposeClientActionsToWebMcp(runner, [focus], publication);
		expect(second.refused).toEqual([{ name: 'lab_focus_section', reason: 'already_published' }]);
		first.dispose();
		first.dispose();
		expect(await tools[0].execute({ section: 'mcp' })).toMatchObject({ status: 'unavailable', code: 'unpublished' });
		const third = exposeClientActionsToWebMcp(runner, [focus], publication);
		expect(third.published).toEqual(['lab_focus_section']);
		third.dispose();
	});

	it('refuses a call its caller already cancelled, without running the handler', async () => {
		const runner = createClientActionRunner([focus]);
		let ran = 0;
		runner.register(focus, () => {
			ran += 1;
			return { status: 'completed' };
		});
		const { context, tools } = fakeContext();
		const exposure = exposeClientActionsToWebMcp(runner, [focus], {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' },
			modelContext: context,
		});
		const aborted = new AbortController();
		aborted.abort();
		expect(await tools[0].execute({ section: 'mcp' }, { signal: aborted.signal })).toMatchObject({
			status: 'refused',
			code: 'cancelled',
		});
		expect(ran).toBe(0);
		exposure.dispose();
	});

	it('keeps two exposures apart: the same input is two runs, never a deduplicated one', async () => {
		const runner = createClientActionRunner([focus]);
		let ran = 0;
		runner.register(focus, () => {
			ran += 1;
			return { status: 'completed' };
		});
		const a = fakeContext();
		const b = fakeContext();
		const base = {
			consent: true,
			descriptions: { lab_focus_section: 'x' },
			risks: { lab_focus_section: 'view' as const },
		};
		exposeClientActionsToWebMcp(runner, [focus], { ...base, modelContext: a.context });
		exposeClientActionsToWebMcp(runner, [focus], { ...base, modelContext: b.context });
		await a.tools[0].execute({ section: 'mcp' });
		await b.tools[0].execute({ section: 'mcp' });
		expect(ran).toBe(2);
	});
});
