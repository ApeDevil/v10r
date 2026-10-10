/**
 * Reads CSS custom properties from the document at mount time.
 * Used by viz components to consume design tokens for chart theming.
 */

// Singleton theme observer (pub/sub)

type Listener = () => void;
const listeners = new Set<Listener>();
let observer: MutationObserver | undefined;

function ensureObserver() {
	if (observer || typeof document === 'undefined') return;
	observer = new MutationObserver(() => {
		for (const fn of listeners) fn();
	});
	observer.observe(document.documentElement, {
		attributeFilter: ['class'],
	});
}

/** Subscribe to theme changes. Returns unsubscribe function. */
export function onThemeChange(fn: Listener): () => void {
	listeners.add(fn);
	ensureObserver();
	return () => {
		listeners.delete(fn);
		if (listeners.size === 0) {
			observer?.disconnect();
			observer = undefined;
		}
	};
}

/** Read a single CSS custom property value (e.g., getCssVar('chart-1') reads --chart-1) */
export function getCssVar(token: string): string {
	// No document during SSR: inherit the text color rather than invent one.
	if (typeof document === 'undefined') return 'currentColor';
	return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
}

/** Get the 8-color chart palette from CSS custom properties */
export function getVizPalette(): string[] {
	return [
		getCssVar('chart-1'),
		getCssVar('chart-2'),
		getCssVar('chart-3'),
		getCssVar('chart-4'),
		getCssVar('chart-5'),
		getCssVar('chart-6'),
		getCssVar('chart-7'),
		getCssVar('chart-8'),
	];
}

/**
 * The palette color for `index`, cycling — or the primary token when the palette is not
 * read yet (an empty array before mount) or a chart token is unset. Never a literal.
 */
export function vizColor(palette: string[], index: number): string {
	return (palette.length > 0 ? palette[index % palette.length] : '') || getCssVar('color-primary');
}

export type Rgb = [number, number, number];

let probe: CanvasRenderingContext2D | null | undefined;

/**
 * Any CSS color (a var() token, oklch(), color-mix(), hex, named) as sRGB channels, or `null` when the
 * string is not a color or there is no DOM. The design tokens are oklch(): a hand-written
 * hex parser turns them into NaN, and appending a hex alpha suffix to one yields an
 * invalid color. So the browser paints the color onto a 1×1 probe and the pixel is read back.
 */
export function colorChannels(color: string): Rgb | null {
	if (typeof document === 'undefined' || !color.trim()) return null;
	probe ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
	if (!probe) return null;
	probe.clearRect(0, 0, 1, 1);
	probe.fillStyle = 'transparent';
	// A canvas has no element to resolve var() against, so tokens are resolved first.
	probe.fillStyle = color.includes('var(') ? resolveColors([color.trim()])[0] : color.trim();
	probe.fillRect(0, 0, 1, 1);
	const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
	return a === 0 ? null : [r, g, b];
}

/**
 * A CSS color as `rgba()`, optionally at reduced opacity — the one form every canvas
 * library parses (Chart.js's color helpers and MapLibre's style parser do not reliably
 * read oklch()). Outside the browser the input is returned unchanged.
 */
export function toRgba(color: string, alpha = 1): string {
	const rgb = colorChannels(color);
	return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : color;
}

function luminance([r, g, b]: Rgb): number {
	const linear = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/**
 * A picker for text drawn on a filled shape: whichever of the foreground and background
 * tokens has the higher WCAG contrast with the fill. Reads the tokens once — create one per
 * draw, call it per shape.
 */
export function readableTextOn(): (fill: Rgb) => string {
	const fg = getCssVar('color-fg');
	const bg = getCssVar('color-bg');
	const fgRgb = colorChannels(fg);
	const bgRgb = colorChannels(bg);
	if (!fgRgb || !bgRgb) return () => fg;
	const fgLum = luminance(fgRgb);
	const bgLum = luminance(bgRgb);
	const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
	return (fill) => {
		const fillLum = luminance(fill);
		return contrast(fgLum, fillLum) >= contrast(bgLum, fillLum) ? fg : bg;
	};
}

/** Batch-resolve an array of color strings that may contain CSS var() references. */
export function resolveColors(values: string[]): string[] {
	if (typeof document === 'undefined') return values.map(() => 'currentColor');
	const needsResolve = values.some((v) => v.includes('var('));
	if (!needsResolve) return values;

	const el = document.createElement('div');
	document.body.appendChild(el);
	const resolved = values.map((v) => {
		if (!v.includes('var(')) return v;
		el.style.color = v;
		return getComputedStyle(el).color;
	});
	document.body.removeChild(el);
	return resolved;
}

/**
 * Walk a ChartData object and resolve any CSS var() references in color properties.
 * Returns a new object (does not mutate the original).
 */
export function resolveDatasetColors<T extends { datasets: unknown[] }>(chartData: T): T {
	if (typeof document === 'undefined') return chartData;

	const COLOR_KEYS = [
		'backgroundColor',
		'borderColor',
		'hoverBackgroundColor',
		'hoverBorderColor',
		'pointBackgroundColor',
		'pointBorderColor',
	];

	type AnyDataset = Record<string, unknown>;
	const datasets = chartData.datasets as AnyDataset[];

	// Collect all color strings for batch resolution
	const colorEntries: { dsIdx: number; key: string; arrIdx?: number; value: string }[] = [];

	for (let dsIdx = 0; dsIdx < datasets.length; dsIdx++) {
		const ds = datasets[dsIdx];
		for (const key of COLOR_KEYS) {
			const val = ds[key];
			if (typeof val === 'string') {
				colorEntries.push({ dsIdx, key, value: val });
			} else if (Array.isArray(val)) {
				for (let arrIdx = 0; arrIdx < val.length; arrIdx++) {
					if (typeof val[arrIdx] === 'string') {
						colorEntries.push({ dsIdx, key, arrIdx, value: val[arrIdx] });
					}
				}
			}
		}
	}

	if (colorEntries.length === 0) return chartData;

	const resolved = resolveColors(colorEntries.map((e) => e.value));

	// Build new datasets with resolved colors
	const newDatasets = datasets.map((ds) => ({ ...ds }));
	for (let i = 0; i < colorEntries.length; i++) {
		const { dsIdx, key, arrIdx } = colorEntries[i];
		if (arrIdx !== undefined) {
			// Array color — clone array on first write
			if (!Array.isArray(newDatasets[dsIdx][key]) || newDatasets[dsIdx][key] === datasets[dsIdx][key]) {
				newDatasets[dsIdx][key] = [...(datasets[dsIdx][key] as unknown[])];
			}
			(newDatasets[dsIdx][key] as unknown[])[arrIdx] = resolved[i];
		} else {
			newDatasets[dsIdx][key] = resolved[i];
		}
	}

	return { ...chartData, datasets: newDatasets } as T;
}

/** Get chart infrastructure colors */
export function getChartInfraColors() {
	return {
		grid: getCssVar('chart-grid'),
		axis: getCssVar('chart-axis'),
		label: getCssVar('chart-label'),
		bg: getCssVar('chart-bg'),
		tooltipBg: getCssVar('chart-tooltip-bg'),
	};
}
