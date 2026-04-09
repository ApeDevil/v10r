/**
 * Reads CSS custom properties from the document at mount time.
 * Used by viz components to consume design tokens for chart theming.
 */

// --- Singleton theme observer (pub/sub) ---

type Listener = () => void;
const listeners = new Set<Listener>();
let observer: MutationObserver | undefined;

function ensureObserver() {
	if (observer || typeof document === 'undefined') return;
	observer = new MutationObserver(() => {
		for (const fn of listeners) fn();
	});
	observer.observe(document.documentElement, {
		attributeFilter: ['class', 'data-accent'],
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

// --- CSS variable resolution ---

/** Read a single CSS custom property value (e.g., getCSSVar('chart-1') reads --chart-1) */
export function getCSSVar(token: string): string {
	if (typeof document === 'undefined') return '#000';
	return getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
}

/** Get the 8-color chart palette from CSS custom properties */
export function getVizPalette(): string[] {
	return [
		getCSSVar('chart-1'),
		getCSSVar('chart-2'),
		getCSSVar('chart-3'),
		getCSSVar('chart-4'),
		getCSSVar('chart-5'),
		getCSSVar('chart-6'),
		getCSSVar('chart-7'),
		getCSSVar('chart-8'),
	];
}

/** Batch-resolve an array of color strings that may contain CSS var() references. */
export function resolveColors(values: string[]): string[] {
	if (typeof document === 'undefined') return values.map(() => '#000');
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
 * Resolve a color string that may contain CSS var() references.
 * Handles:
 *   - 'var(--chart-1)' → resolved computed value
 *   - 'color-mix(in srgb, var(--chart-1) 20%, transparent)' → computed via temp element
 *   - '#ff0000' or 'rgb(...)' → returned as-is
 */
export function resolveColor(value: string): string {
	return resolveColors([value])[0];
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
		grid: getCSSVar('chart-grid'),
		axis: getCSSVar('chart-axis'),
		label: getCSSVar('chart-label'),
		bg: getCSSVar('chart-bg'),
		tooltipBg: getCSSVar('chart-tooltip-bg'),
	};
}
