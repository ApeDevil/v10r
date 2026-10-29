import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * `/showcases/3d/produce` end to end: the page asks the server for an asset, shows it, reports
 * it, and refuses a request the rules forbid. Assertions read what a visitor gets — the
 * panels, the status line and the downloaded GLB — so the page carries no test-only seam.
 */

const errorsOf = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	errorsOf.set(page, errors);
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(String(error)));

	await page.goto('/showcases/3d/produce');
	await page
		.getByRole('button', { name: /reject all/i })
		.click({ timeout: 5_000 })
		.catch(() => {});
	// The page produces the default ring on load.
	await expect(page.getByRole('status').filter({ hasText: /Generated in \d+ ms/ })).toBeVisible({ timeout: 60_000 });
});

test.afterEach(async ({ page }) => {
	expect(errorsOf.get(page)).toEqual([]);
});

test('generates the default ring, shows it and its report, and downloads a real GLB', async ({ page }) => {
	await expect(page.locator('[data-testid="asset-canvas"] canvas')).toBeVisible();
	await expect(page.getByText('Every gate passed:')).toBeVisible();
	await expect(page.getByText('9,800').first()).toBeVisible();
	await expect(page.getByText('procedural-ts@1')).toBeVisible();
	await expect(page.getByText(/^[0-9a-f]{64}$/).first()).toBeVisible();

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('link', { name: 'Download GLB' }).click(),
	]);
	const bytes = await readFile(await download.path());
	expect(bytes.subarray(0, 4).toString('latin1')).toBe('glTF');
	expect(bytes.byteLength).toBeGreaterThan(100_000);
});

test('a preset changes the asset', async ({ page }) => {
	await page.getByRole('radio', { name: 'Station' }).click();
	await page.getByRole('button', { name: 'Regenerate' }).click();
	await expect(page.getByRole('status').filter({ hasText: /Generated in \d+ ms/ })).toBeVisible({ timeout: 60_000 });
	await expect(page.getByText('9,800')).toHaveCount(0);
});

test('one spoke is refused before and after sending, and no asset is produced', async ({ page }) => {
	const spokes = page.getByRole('slider', { name: 'Spokes' });
	await spokes.focus();
	await spokes.press('Home');
	await spokes.press('ArrowRight');
	await expect(page.getByText(/one spoke cannot hold the ring/i).first()).toBeVisible();

	await page.getByRole('button', { name: 'Regenerate' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'No asset was produced' })).toBeVisible({ timeout: 30_000 });
	await expect(page.getByText('parameter.conflict')).toBeVisible();
	await expect(page.getByText('refused')).toBeVisible();
	// The refusal is a 422 by design; Chromium logs any 4xx fetch as a console error.
	const errors = errorsOf.get(page) ?? [];
	errorsOf.set(
		page,
		errors.filter((text) => !text.includes('status of 422')),
	);
});
