<script lang="ts">
import { converter, formatHex, parse } from 'culori';

const toOklch = converter('oklch');
const toRgb = converter('rgb');

interface Props {
	label: string;
	value: string;
	onchange?: (value: string) => void;
}

let { label, value = $bindable(), onchange }: Props = $props();

// ── Internal slider state ──────────────────────────────────────
let l = $state(0.5);
let c = $state(0.1);
let h = $state(0);
let expanded = $state(false);
let hexInput = $state('');
let lastSyncedValue = $state('');

// Parse the incoming oklch() string
function parseOklchString(v: string): { l: number; c: number; h: number } | null {
	const match = v.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)/);
	if (!match) return null;
	return {
		l: Number(match[1]),
		c: Number(match[2]),
		h: Number(match[3]),
	};
}

function buildOklchString(lv: number, cv: number, hv: number): string {
	return `oklch(${lv.toFixed(3)} ${cv.toFixed(3)} ${hv.toFixed(0)})`;
}

function oklchToHex(oklchStr: string): string {
	try {
		const parsed = toOklch(parse(oklchStr) ?? { mode: 'oklch', l, c, h });
		if (!parsed) return '';
		const rgb = toRgb(parsed);
		if (!rgb) return '';
		return formatHex(rgb) ?? '';
	} catch {
		return '';
	}
}

// Sync from external value changes
$effect(() => {
	if (value === lastSyncedValue) return;
	const parsed = parseOklchString(value);
	if (!parsed) return;
	l = parsed.l;
	c = parsed.c;
	h = parsed.h;
	hexInput = oklchToHex(value);
	lastSyncedValue = value;
});

// Rebuild string and propagate whenever sliders change
function onSliderChange() {
	const next = buildOklchString(l, c, h);
	hexInput = oklchToHex(next);
	lastSyncedValue = next;
	value = next;
	onchange?.(next);
}

// Handle hex input
function onHexChange(raw: string) {
	hexInput = raw;
	const normalised = raw.startsWith('#') ? raw : `#${raw}`;
	if (!/^#[0-9a-fA-F]{6}$/.test(normalised)) return;
	try {
		const oklch = toOklch(parse(normalised));
		if (!oklch) return;
		l = Math.max(0, Math.min(1, oklch.l ?? 0));
		c = Math.max(0, Math.min(0.4, oklch.c ?? 0));
		h = ((oklch.h ?? 0) + 360) % 360;
		const next = buildOklchString(l, c, h);
		lastSyncedValue = next;
		value = next;
		onchange?.(next);
	} catch {
		// Invalid hex — ignore
	}
}

// Gradient helpers for slider tracks
const lGradient = $derived(
	`linear-gradient(to right, oklch(0 ${c.toFixed(3)} ${h.toFixed(0)}), oklch(1 ${c.toFixed(3)} ${h.toFixed(0)}))`,
);
const cGradient = $derived(
	`linear-gradient(to right, oklch(${l.toFixed(3)} 0 ${h.toFixed(0)}), oklch(${l.toFixed(3)} 0.4 ${h.toFixed(0)}))`,
);
const hGradient = $derived(
	`linear-gradient(to right, oklch(${l.toFixed(3)} ${c.toFixed(3)} 0), oklch(${l.toFixed(3)} ${c.toFixed(3)} 60), oklch(${l.toFixed(3)} ${c.toFixed(3)} 120), oklch(${l.toFixed(3)} ${c.toFixed(3)} 180), oklch(${l.toFixed(3)} ${c.toFixed(3)} 240), oklch(${l.toFixed(3)} ${c.toFixed(3)} 300), oklch(${l.toFixed(3)} ${c.toFixed(3)} 360))`,
);

const currentColor = $derived(buildOklchString(l, c, h));
</script>

<!-- Collapsed row -->
<div class="oklch-input">
	<button
		type="button"
		class="row"
		onclick={() => (expanded = !expanded)}
		aria-expanded={expanded}
	>
		<span
			class="swatch"
			style="background: {currentColor};"
			aria-hidden="true"
		></span>
		<span class="label">{label}</span>
		<span class="value-string">{value}</span>
		<span class="chevron" class:rotated={expanded} aria-hidden="true">
			<span class="i-lucide-chevron-down"></span>
		</span>
	</button>

	<!-- Expanded sliders -->
	{#if expanded}
		<div class="sliders">
			<!-- L slider -->
			<div class="slider-row">
				<span class="axis-label">L</span>
				<div class="track-wrap" style="background: {lGradient};">
					<input
						type="range"
						min="0"
						max="1"
						step="0.01"
						bind:value={l}
						oninput={onSliderChange}
						class="range-input"
						aria-label="Lightness"
					/>
				</div>
				<span class="axis-value">{l.toFixed(2)}</span>
			</div>

			<!-- C slider -->
			<div class="slider-row">
				<span class="axis-label">C</span>
				<div class="track-wrap" style="background: {cGradient};">
					<input
						type="range"
						min="0"
						max="0.4"
						step="0.005"
						bind:value={c}
						oninput={onSliderChange}
						class="range-input"
						aria-label="Chroma"
					/>
				</div>
				<span class="axis-value">{c.toFixed(3)}</span>
			</div>

			<!-- H slider -->
			<div class="slider-row">
				<span class="axis-label">H</span>
				<div class="track-wrap" style="background: {hGradient};">
					<input
						type="range"
						min="0"
						max="360"
						step="1"
						bind:value={h}
						oninput={onSliderChange}
						class="range-input"
						aria-label="Hue"
					/>
				</div>
				<span class="axis-value">{h.toFixed(0)}°</span>
			</div>

			<!-- Hex input -->
			<div class="hex-row">
				<span class="axis-label">Hex</span>
				<input
					type="text"
					class="hex-input font-mono text-fluid-xs"
					value={hexInput}
					oninput={(e) => onHexChange((e.target as HTMLInputElement).value)}
					placeholder="#rrggbb"
					spellcheck="false"
					aria-label="Hex color value"
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.oklch-input {
		width: 100%;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.5rem;
		border-radius: var(--radius-md);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		color: inherit;
		transition: background-color var(--duration-fast) ease;
	}

	.row:hover {
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.swatch {
		width: 28px;
		height: 28px;
		flex-shrink: 0;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		display: block;
	}

	.label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-fg);
		min-width: 8rem;
		flex-shrink: 0;
	}

	.value-string {
		font-size: var(--text-fluid-xs);
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--color-muted);
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.chevron {
		flex-shrink: 0;
		color: var(--color-muted);
		display: flex;
		align-items: center;
		transition: transform var(--duration-fast) ease;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	/* Sliders panel */
	.sliders {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.5rem 0.5rem 0.75rem 0.5rem;
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.axis-label {
		font-size: var(--text-fluid-xs);
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--color-muted);
		width: 1rem;
		flex-shrink: 0;
		text-align: center;
	}

	.track-wrap {
		flex: 1;
		height: 0.5rem;
		border-radius: var(--radius-full);
		position: relative;
		overflow: visible;
		display: flex;
		align-items: center;
	}

	/* Keep the range slim so the gradient track shows behind it */
	.range-input {
		position: absolute;
		inset: 0;
		width: 100%;
		margin: 0;
		cursor: pointer;
		top: 50%;
		transform: translateY(-50%);
		opacity: 1;
		height: 0.5rem;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		border-radius: var(--radius-full);
	}

	.range-input::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: white;
		border: 2px solid var(--color-primary);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
	}

	.range-input::-moz-range-thumb {
		width: 1rem;
		height: 1rem;
		border-radius: 50%;
		background: white;
		border: 2px solid var(--color-primary);
		box-shadow: var(--shadow-sm);
		cursor: pointer;
	}

	.range-input::-webkit-slider-runnable-track {
		background: transparent;
	}

	.range-input::-moz-range-track {
		background: transparent;
	}

	.range-input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-full);
	}

	.axis-value {
		font-size: var(--text-fluid-xs);
		font-family: var(--font-mono, ui-monospace, monospace);
		color: var(--color-muted);
		width: 3.5rem;
		flex-shrink: 0;
		text-align: right;
	}

	.hex-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.hex-input {
		width: 6rem;
		padding: 0.25rem 0.5rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-input-border);
		background: var(--color-input);
		color: var(--color-fg);
		font-size: var(--text-fluid-xs);
	}

	.hex-input:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	/* Dark mode thumb */
	:global(.dark) .range-input::-webkit-slider-thumb {
		background: var(--color-fg);
	}

	:global(.dark) .range-input::-moz-range-thumb {
		background: var(--color-fg);
	}
</style>
