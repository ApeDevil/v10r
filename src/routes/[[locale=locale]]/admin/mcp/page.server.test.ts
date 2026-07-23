import { beforeEach, describe, expect, it, vi } from 'vitest';

const guards = vi.hoisted(() => ({ requireAdmin: vi.fn() }));
const svc = vi.hoisted(() => ({ getDemoState: vi.fn() }));
vi.mock('$lib/server/auth/guards', () => guards);
vi.mock('$lib/server/mcp/demo/service', () => svc);

const { load } = await import('./+page.server');

type LoadEvent = Parameters<typeof load>[0];
const event = () => ({ locals: {} }) as unknown as LoadEvent;

type LoadData = {
	state: { message: string; color: string; version: number; updatedAt: string; updatedBy: string | null } | null;
	colors: string[];
	maxMessageLength: number;
	unavailable: boolean;
};
const loadData = async (): Promise<LoadData> => (await load(event())) as unknown as LoadData;

const VIEW = {
	message: 'Hello, Velociraptor.',
	color: 'blue',
	version: 1,
	updatedAt: '2020-01-01T00:00:00.000Z',
	updatedBy: null,
};

beforeEach(() => vi.clearAllMocks());

describe('/admin/mcp +page.server load', () => {
	it('enforces the admin guard', async () => {
		svc.getDemoState.mockResolvedValue(VIEW);
		await load(event());
		expect(guards.requireAdmin).toHaveBeenCalled();
	});

	it('returns the demo state plus page metadata', async () => {
		svc.getDemoState.mockResolvedValue(VIEW);
		const data = await loadData();
		expect(data.state).toEqual(VIEW);
		expect(data.colors).toContain('blue');
		expect(data.maxMessageLength).toBe(500);
		expect(data.unavailable).toBe(false);
	});

	it('degrades to a generic unavailable flag (no raw DB error) when the table is missing', async () => {
		svc.getDemoState.mockRejectedValue(new Error('relation "mcp.demo_state" does not exist'));
		const data = await loadData();
		expect(data.state).toBeNull();
		expect(data.unavailable).toBe(true);
	});

	it('propagates the admin guard rejection (non-admin cannot load)', async () => {
		guards.requireAdmin.mockImplementation(() => {
			throw new Error('Not Found');
		});
		await expect(load(event())).rejects.toThrow(/Not Found/);
	});
});
