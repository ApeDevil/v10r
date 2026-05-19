<script lang="ts">
/**
 * Honest-simulation signal for Identity & Access demo cards.
 *  - live: real, read-only behaviour
 *  - sandbox: real UI / shapes, fabricated data, nothing persists
 *  - recorded: a faithful depiction captured from real behaviour
 */
interface Props {
	mode: 'live' | 'sandbox' | 'recorded';
	class?: string;
}

let { mode, class: className }: Props = $props();

const META = {
	live: { label: 'Live', icon: 'i-lucide-radio', cls: 'mc-live' },
	sandbox: { label: 'Sandbox', icon: 'i-lucide-flask-conical', cls: 'mc-sandbox' },
	recorded: { label: 'Recorded', icon: 'i-lucide-circle-play', cls: 'mc-recorded' },
} as const;

const m = $derived(META[mode]);
</script>

<span class="mode-chip {m.cls} {className ?? ''}" role="status" aria-label="{m.label} demo">
	<span class="{m.icon} mc-icon" aria-hidden="true"></span>
	<span>{m.label}</span>
</span>

<style>
	.mode-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.6875rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 0.15rem 0.5rem;
		border-radius: var(--radius-sm, 0.25rem);
		border: 1px solid transparent;
	}

	.mc-icon {
		width: 0.8125rem;
		height: 0.8125rem;
	}

	.mc-live {
		background: color-mix(in srgb, var(--color-success, green) 14%, transparent);
		color: var(--color-success, green);
		border-color: color-mix(in srgb, var(--color-success, green) 35%, transparent);
	}

	.mc-sandbox {
		background: color-mix(in srgb, var(--color-warning, orange) 16%, transparent);
		color: var(--color-warning, orange);
		border-color: color-mix(in srgb, var(--color-warning, orange) 38%, transparent);
	}

	.mc-recorded {
		background: var(--color-subtle);
		color: var(--color-muted);
		border-color: var(--color-border);
	}
</style>
