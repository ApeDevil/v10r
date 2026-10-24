import { expect, type Page, test } from '@playwright/test';

/**
 * `/showcases/external-service`: an enhanced action that produces no result must say so,
 * clear its spinner and keep the session's earlier results. The platform failures are
 * produced by intercepting the action POST, so this needs no running service — the first
 * check answers whatever the configured `local` target is (a real call, or "unconfigured").
 */

const ACTION = '**/showcases/external-service?/check';

async function check(page: Page) {
	await page.locator('#es-targets').getByRole('button', { name: 'Check', exact: true }).first().click();
}

const historyRows = (page: Page) => page.locator('#es-history tbody tr');

test.beforeEach(async ({ page }) => {
	await page.goto('/showcases/external-service');
	// Hydrated, or the click is a plain form POST and `enhance` never sees it.
	await page.waitForLoadState('networkidle');
	// The honeypot refuses a form submitted within 2 s of rendering (`HONEYPOT_MIN_FILL_MS`).
	await page.waitForTimeout(2_200);
	await check(page);
	await expect(historyRows(page).first()).toBeVisible();
});

test('an error page from the platform is reported, not swallowed', async ({ page }) => {
	const before = await historyRows(page).count();
	// Vercel's own 504 at the function's time limit: an HTML page, not a SvelteKit result.
	await page.route(ACTION, (route) =>
		route.fulfill({ status: 504, contentType: 'text/html', body: 'An error occurred with your deployment' }),
	);
	await check(page);
	// Since SvelteKit 3 a non-result response reaches `enhance` with its status.
	await expect(page.getByText(/did not finish this action.*\(HTTP 504\)/)).toBeVisible();
	// Cleared, not merely absent: the buttons are disabled while an action is pending.
	await expect(page.locator('#es-targets').getByRole('button', { name: 'Check', exact: true }).first()).toBeEnabled();
	await expect(historyRows(page)).toHaveCount(before);

	// A SvelteKit error result carries its status.
	await page.route(ACTION, (route) =>
		route.fulfill({
			status: 500,
			contentType: 'application/json',
			body: JSON.stringify({ type: 'error', error: { message: 'Internal Error' } }),
		}),
	);
	await check(page);
	await expect(page.getByText(/did not finish this action.*\(HTTP 500\)/)).toBeVisible();
	await expect(historyRows(page)).toHaveCount(before);

	// No lab action redirects: a redirect is reported, not followed.
	await page.route(ACTION, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ type: 'redirect', status: 303, location: '/elsewhere' }),
		}),
	);
	await check(page);
	await expect(page.getByText(/did not finish this action.*\(HTTP 303\)/)).toBeVisible();
	await expect(page).toHaveURL(/\/showcases\/external-service/);
	await expect(historyRows(page)).toHaveCount(before);
});

test('a request that never gets an answer is reported as a connection failure', async ({ page }) => {
	const before = await historyRows(page).count();
	await page.route(ACTION, (route) => route.abort('connectionreset'));
	await check(page);

	await expect(page.getByText(/never got an answer/)).toBeVisible();
	await expect(page.locator('#es-targets [role="status"]')).toHaveCount(0);
	await expect(historyRows(page)).toHaveCount(before);

	// The next successful action clears the notice.
	await page.unroute(ACTION);
	await check(page);
	await expect(page.getByText(/never got an answer/)).toHaveCount(0);
	await expect(historyRows(page)).not.toHaveCount(before);
});
