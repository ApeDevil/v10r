import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createId } from '#lib/server/db/id.ts';

/**
 * `getCustomPaletteById` runs on every request carrying a `CP_` style cookie, before auth
 * and before any rate limit. These tests pin the two things that keep a forged cookie
 * cheap: malformed ids never reach the database, and the cache evicts the least recently
 * used entry instead of dropping every real visitor's palette at the cap.
 */

const query = vi.hoisted(() => vi.fn(async (): Promise<unknown[]> => []));

vi.mock('#lib/server/db/index.ts', () => ({
	db: { select: () => ({ from: () => ({ where: () => ({ limit: query }) }) }) },
}));

async function freshModule() {
	vi.resetModules();
	return import('./palettes');
}

/** A well-formed id, distinct per `n`. */
const paletteId = (n: number) => `CP_${n.toString(16).padStart(12, '0')}`;

beforeEach(() => {
	query.mockReset();
	query.mockResolvedValue([]);
});

describe('getCustomPaletteById — id format', () => {
	it.each([
		'CP_',
		'CP_xyz',
		'CP_0123456789ab0',
		'CP_0123456789AB',
		"CP_0123456789a' OR 1=1",
		'cp_0123456789ab',
	])('refuses %j without touching the database', async (id) => {
		const { getCustomPaletteById } = await freshModule();
		expect(await getCustomPaletteById(id)).toBeNull();
		expect(query).not.toHaveBeenCalled();
	});

	it('accepts every id createId.palette() mints', async () => {
		const { getCustomPaletteById } = await freshModule();
		await getCustomPaletteById(createId.palette());
		expect(query).toHaveBeenCalledTimes(1);
	});

	it('answers a repeat from the cache', async () => {
		const { getCustomPaletteById } = await freshModule();
		await getCustomPaletteById(paletteId(1));
		await getCustomPaletteById(paletteId(1));
		expect(query).toHaveBeenCalledTimes(1);
	});
});

describe('getCustomPaletteById — eviction at the cap', () => {
	it('evicts the least recently used entry, not the whole cache', async () => {
		const { getCustomPaletteById } = await freshModule();
		const CAP = 1_000;
		for (let n = 0; n < CAP; n++) await getCustomPaletteById(paletteId(n));

		// Touch the oldest entry so it becomes the most recently used.
		await getCustomPaletteById(paletteId(0));
		// One more distinct id pushes the cache over the cap.
		await getCustomPaletteById(paletteId(CAP));
		query.mockClear();

		await getCustomPaletteById(paletteId(0));
		expect(query, 'a recently used entry survived').not.toHaveBeenCalled();

		await getCustomPaletteById(paletteId(1));
		expect(query, 'the least recently used entry was the one evicted').toHaveBeenCalledTimes(1);
	});
});
