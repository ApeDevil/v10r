import { beforeEach, describe, expect, it, vi } from 'vitest';

const svc = vi.hoisted(() => ({
	getDemoState: vi.fn(),
	setDemoMessage: vi.fn(),
	setDemoColor: vi.fn(),
	resetDemoState: vi.fn(),
	getDemoHistory: vi.fn(),
}));
vi.mock('./service', () => svc);

const { createAdminStateRegistry, ADMIN_STATE_TOOLS } = await import('./tools');

const VIEW = {
	message: 'Hello, Velociraptor.',
	color: 'blue',
	version: 3,
	updatedAt: '2020-01-02T00:00:00.000Z',
	updatedBy: 'admin-mcp',
};

beforeEach(() => vi.clearAllMocks());

describe('ADMIN_STATE_TOOLS', () => {
	it('exposes exactly the five demo-state tools and nothing generic', () => {
		expect(ADMIN_STATE_TOOLS.map((t) => t.name)).toEqual([
			'get_mcp_page_state',
			'set_mcp_page_message',
			'set_mcp_page_color',
			'reset_mcp_page_state',
			'get_mcp_page_history',
		]);
	});
});

describe('admin registry dispatch', () => {
	const reg = createAdminStateRegistry();

	it('get_mcp_page_state renders version + timestamp + build info', async () => {
		svc.getDemoState.mockResolvedValue(VIEW);
		const r = await reg.dispatch('get_mcp_page_state', {});
		expect(r.isError).toBeFalsy();
		expect(r.content[0].text).toMatch(/version: 3/);
		expect(r.content[0].text).toMatch(/2020-01-02/);
		expect(r.content[0].text).toMatch(/build:/);
	});

	it('set_mcp_page_message returns before → after with the version bump', async () => {
		svc.setDemoMessage.mockResolvedValue({
			ok: true,
			field: 'message',
			before: { ...VIEW, version: 2, message: 'old' },
			after: { ...VIEW, message: 'new' },
		});
		const r = await reg.dispatch('set_mcp_page_message', { message: 'new' });
		expect(r.isError).toBeFalsy();
		expect(r.content[0].text).toMatch(/version: 2 → 3/);
	});

	it('set_mcp_page_message maps a validation failure to an error result', async () => {
		svc.setDemoMessage.mockResolvedValue({ ok: false, code: 'invalid_message', message: 'Message must not be empty.' });
		const r = await reg.dispatch('set_mcp_page_message', { message: '' });
		expect(r.isError).toBe(true);
		expect(r.content[0].text).toMatch(/empty/);
	});

	it('set_mcp_page_color renders the before → after color', async () => {
		svc.setDemoColor.mockResolvedValue({
			ok: true,
			field: 'color',
			before: { ...VIEW, color: 'blue', version: 2 },
			after: { ...VIEW, color: 'red' },
		});
		const r = await reg.dispatch('set_mcp_page_color', { color: 'red' });
		expect(r.content[0].text).toMatch(/color: blue → red/);
	});

	it('reset_mcp_page_state renders the reset', async () => {
		svc.resetDemoState.mockResolvedValue({ ok: true, before: { ...VIEW, version: 5 }, after: { ...VIEW, version: 6 } });
		const r = await reg.dispatch('reset_mcp_page_state', {});
		expect(r.content[0].text).toMatch(/version: 5 → 6/);
	});

	it('maps a mutation conflict to a bounded error result', async () => {
		svc.setDemoColor.mockResolvedValue({
			ok: false,
			code: 'conflict',
			message: 'The demo state changed concurrently; please retry.',
		});
		const r = await reg.dispatch('set_mcp_page_color', { color: 'red' });
		expect(r.isError).toBe(true);
		expect(r.content[0].text).toMatch(/concurrently/);
	});

	it('maps a reset conflict to a bounded error result', async () => {
		svc.resetDemoState.mockResolvedValue({
			ok: false,
			code: 'conflict',
			message: 'The demo state changed concurrently; please retry.',
		});
		const r = await reg.dispatch('reset_mcp_page_state', {});
		expect(r.isError).toBe(true);
	});

	it('get_mcp_page_history renders recorded rows with before → after', async () => {
		svc.getDemoHistory.mockResolvedValue([
			{
				field: 'set_color',
				actor: 'admin-mcp@velociraptor.local',
				occurredAt: '2020-01-02T00:00:00.000Z',
				before: { message: 'Hello, Velociraptor.', color: 'blue', version: 1 },
				after: { message: 'Hello, Velociraptor.', color: 'red', version: 2 },
			},
		]);
		const r = await reg.dispatch('get_mcp_page_history', { limit: 5 });
		expect(r.content[0].text).toMatch(/set_color/);
		expect(r.content[0].text).toMatch(/v1.*→.*v2/);
	});

	it('injects the bound actor (incl. request IP) into writes', async () => {
		svc.setDemoColor.mockResolvedValue({ ok: true, field: 'color', before: VIEW, after: VIEW });
		const reg2 = createAdminStateRegistry({ id: 'admin-mcp', email: 'x', label: 'admin-mcp', ip: '1.2.3.4' });
		await reg2.dispatch('set_mcp_page_color', { color: 'red' });
		expect(svc.setDemoColor).toHaveBeenCalledWith('red', expect.objectContaining({ ip: '1.2.3.4' }));
	});

	it('rejects an unknown tool name', async () => {
		const r = await reg.dispatch('run_sql', {});
		expect(r.isError).toBe(true);
	});
});
