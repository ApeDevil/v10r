import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/**
 * `/showcases/3d/compose` end to end. Every assertion reads the document the way a user gets
 * it — through the page's own Export JSON — so the page carries no test-only seam. The same
 * steps run on the core alone in `src/lib/showcases/3d/compose/compose.test.ts`.
 */

interface ExportedComposition {
	occurrences: { id: string; placement: { position: [number, number, number] } }[];
	couplings: { id: string; a: { occurrence: string; port: string }; b: { occurrence: string; port: string } }[];
	conduits: { coupling: string; waypoints: unknown[] }[];
}

const errorsOf = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	errorsOf.set(page, errors);
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error) => errors.push(String(error)));

	const webgl = await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')));
	expect(webgl, 'WebGL 2 is unavailable — Chromium needs the SwiftShader launch args').toBe(true);

	await page.goto('/showcases/3d/compose');
	await expect(page.locator('[data-testid="composition-canvas"] canvas')).toBeVisible();
	await page
		.getByRole('button', { name: /reject all/i })
		.click({ timeout: 5_000 })
		.catch(() => {});
});

test.afterEach(async ({ page }) => {
	expect(errorsOf.get(page)).toEqual([]);
});

const panel = (page: Page) => page.locator('aside.panel');
const findings = (page: Page) => page.getByTestId('composition-findings');

async function exportText(page: Page): Promise<string> {
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Export JSON' }).click(),
	]);
	return readFile(await download.path(), 'utf8');
}
const exported = async (page: Page): Promise<ExportedComposition> => JSON.parse(await exportText(page));
const positionOf = (composition: ExportedComposition, id: string) => {
	const occurrence = composition.occurrences.find((candidate) => candidate.id === id);
	if (!occurrence) throw new Error(`no occurrence ${id}`);
	return occurrence.placement.position;
};
const hasCoupling = (composition: ExportedComposition, a: string, b: string) =>
	composition.couplings.some(
		(coupling) =>
			(coupling.a.occurrence === a && coupling.b.occurrence === b) ||
			(coupling.a.occurrence === b && coupling.b.occurrence === a),
	);

test('heating by keyboard: couple, route, round-trip, refuse, move, switch, undo', async ({ page }) => {
	// 1. The fixture loads clean.
	await expect(findings(page)).toContainText('No errors or warnings');
	const initial = await exported(page);

	// 2. Products list → radiator → its Ports list → Out → couple to the tank through the picker.
	await panel(page)
		.getByRole('button', { name: /\(radiator-2\)/ })
		.click();
	await panel(page).getByRole('button', { name: 'Out', exact: true }).click();
	await panel(page).locator('.select-trigger').first().click();
	await page.getByRole('option', { name: /Secondary in — Buffer tank/ }).click();
	await panel(page).getByRole('button', { name: 'Couple', exact: true }).click();
	await expect(page.getByTestId('composition-notice')).not.toBeEmpty();
	const coupled = await exported(page);
	expect(hasCoupling(coupled, 'radiator-2', 'tank-1')).toBe(true);
	expect(coupled.couplings).toHaveLength(initial.couplings.length + 1);

	// 3. The new pipe is selected: add a waypoint, then export → import → export is byte-equal.
	await panel(page).getByRole('button', { name: 'Add waypoint' }).click();
	const routed = await exportText(page);
	const added = coupled.couplings.find((coupling) => !initial.couplings.some((old) => old.id === coupling.id));
	expect(JSON.parse(routed).conduits.find((conduit: { coupling: string }) => conduit.coupling === added?.id)).toEqual(
		expect.objectContaining({ waypoints: [expect.any(Array)] }),
	);
	await page.locator('input[type="file"]').setInputFiles({
		name: 'composition.json',
		mimeType: 'application/json',
		buffer: Buffer.from(routed),
	});
	await expect(page.getByTestId('composition-notice')).toContainText('Imported');
	expect(await exportText(page)).toBe(routed);

	// 4. The tank's last open DN 20 port is not offered the open DN 15 towel radiator — nor anything else.
	await panel(page)
		.getByRole('button', { name: /\(tank-1\)/ })
		.click();
	await panel(page).getByRole('button', { name: 'Spare out', exact: true }).click();
	await expect(panel(page)).toContainText('No port can take this coupling in the current mode.');
	await expect(panel(page).locator('.select-trigger')).toHaveCount(0);

	// 5. Nudging the boiler carries the hydraulic unit mated to it, by exactly the same amount.
	await panel(page)
		.getByRole('button', { name: /\(boiler-1\)/ })
		.click();
	const move = panel(page).getByRole('button', { name: /along \+X/ });
	for (let step = 0; step < 3; step++) await move.click();
	const moved = await exported(page);
	const boilerDx = positionOf(moved, 'boiler-1')[0] - positionOf(coupled, 'boiler-1')[0];
	const unitDx = positionOf(moved, 'hydraulic-unit-1')[0] - positionOf(coupled, 'hydraulic-unit-1')[0];
	expect(boilerDx).toBeCloseTo(0.15, 9);
	expect(unitDx).toBeCloseTo(boilerDx, 9);
	await expect(findings(page)).toContainText('No errors or warnings');

	// 6. The other catalogue runs on the same engine; switching back keeps the work.
	await page.getByRole('radio', { name: 'Shelving' }).click();
	await expect(panel(page).getByRole('button', { name: /\(sofa-1\)/ })).toBeVisible();
	await expect(findings(page)).toContainText('No errors or warnings');
	await page.getByRole('radio', { name: 'Heating' }).click();
	await expect(panel(page).getByRole('button', { name: /\(boiler-1\)/ })).toBeVisible();
	expect(await exported(page)).toEqual(moved);

	// Undo walks the nudges back one step at a time.
	const undo = page.getByRole('button', { name: 'Undo', exact: true });
	for (let step = 0; step < 3; step++) await undo.click();
	expect(positionOf(await exported(page), 'boiler-1')).toEqual(positionOf(coupled, 'boiler-1'));
});

test('pointer: dragging the gizmo moves the mated cluster as one undo step', async ({ page }) => {
	await panel(page)
		.getByRole('button', { name: /\(boiler-1\)/ })
		.click();
	const stage = page.getByTestId('composition-canvas');
	await stage.scrollIntoViewIfNeeded();
	await expect(page.getByTestId('composition-selection')).toContainText('boiler-1');
	const before = await exported(page);

	// TransformControls draws its X arrow in pure red: find that arrow in a picture of the stage.
	const box = await stage.boundingBox();
	if (!box) throw new Error('the stage has no box');
	const shot = await stage.screenshot();
	await test.info().attach('stage', { body: shot, contentType: 'image/png' });
	const picture = shot.toString('base64');
	const arrow = await page.evaluate(async (png) => {
		const image = new Image();
		image.src = `data:image/png;base64,${png}`;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext('2d');
		if (!context) return null;
		context.drawImage(image, 0, 0);
		const { data } = context.getImageData(0, 0, image.width, image.height);
		const xs: number[] = [];
		const ys: number[] = [];
		for (let index = 0; index < data.length; index += 4) {
			if (data[index] > 200 && data[index + 1] < 60 && data[index + 2] < 60) {
				xs.push((index / 4) % image.width);
				ys.push(Math.floor(index / 4 / image.width));
			}
		}
		if (xs.length < 20) return null;
		// The arrowhead: the outer fifth of the red pixels, away from the handles at the centre.
		const right = Math.max(...xs);
		const reach = right - Math.min(...xs);
		const head = xs.flatMap((x, index) => (x >= right - reach / 5 ? [index] : []));
		const median = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
		return {
			x: median(head.map((index) => xs[index])),
			y: median(head.map((index) => ys[index])),
			scale: image.width,
		};
	}, picture);
	expect(arrow, 'no red X arrow on the stage — is the gizmo drawn?').not.toBeNull();
	if (!arrow) return;
	const ratio = box.width / arrow.scale;
	const start = { x: box.x + arrow.x * ratio, y: box.y + arrow.y * ratio };

	// Hover first: the gizmo picks its axis on pointer move, then grabs it on pointer down.
	await page.mouse.move(start.x - 2, start.y);
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	for (let step = 1; step <= 10; step++) await page.mouse.move(start.x + step * 12, start.y, { steps: 2 });
	await page.mouse.up();

	const after = await exported(page);
	const boilerDx = positionOf(after, 'boiler-1')[0] - positionOf(before, 'boiler-1')[0];
	const unitDx = positionOf(after, 'hydraulic-unit-1')[0] - positionOf(before, 'hydraulic-unit-1')[0];
	expect(boilerDx).toBeGreaterThan(0.1);
	expect(unitDx).toBeCloseTo(boilerDx, 9);
	expect(positionOf(after, 'boiler-1').slice(1)).toEqual(positionOf(before, 'boiler-1').slice(1));

	await page.getByRole('button', { name: 'Undo', exact: true }).click();
	expect(await exported(page)).toEqual(before);
});
