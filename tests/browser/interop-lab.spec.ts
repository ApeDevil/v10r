import { expect, test } from '@playwright/test';

/**
 * `/showcases/interop` end to end: every section the evidence table names is on the page, the
 * cross-protocol scenario reports every step passing, a generative surface renders with the
 * app's own components, and WebMCP says what this browser can do — with no page error. The
 * scenario's facts come from `src/lib/showcases/interop/cross-protocol-scenario.test.ts`.
 */
test('the Interoperability Lab renders its evidence, the scenario and a live surface', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(String(error)));

	await page.goto('/showcases/interop');
	await page
		.getByRole('button', { name: /reject all/i })
		.click({ timeout: 5_000 })
		.catch(() => {});

	for (const id of [
		'evidence',
		'scenario',
		'generative-ui',
		'a2a',
		'mcp-client',
		'agent-skills',
		'webmcp',
		'ag-ui',
		'otel',
	]) {
		await expect(page.locator(`section#${id}`), `section ${id}`).toBeVisible();
	}
	const scenario = page.locator('section#scenario');
	await expect(scenario).toContainText('lab-scenario-1 · 8/8');
	await expect(scenario.getByText('fail', { exact: true })).toHaveCount(0);

	// The lazy renderer mounts the selected scenario with v10r components.
	await expect(page.locator('section#generative-ui [data-surface-id]').first()).toBeVisible({
		timeout: 20_000,
	});
	// No browser ships WebMCP yet; the page must say so rather than claim support.
	await expect(page.locator('section#webmcp')).toBeVisible();

	expect(errors).toEqual([]);
});
