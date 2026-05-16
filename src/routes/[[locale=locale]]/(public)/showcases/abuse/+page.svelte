<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

const modeVariant = data.mode === 'live' ? 'success' : data.mode === 'dry_run' ? 'warning' : 'error';

const defenses = [
	{
		href: '/showcases/abuse/captcha',
		icon: 'i-lucide-shield-check',
		titleKey: m.showcase_abuse_overview_card_captcha,
		body: 'Proof-of-work captcha (ALTCHA) on auth flows. Single-use payload via Upstash replay store.',
		status: data.captcha.configured ? 'success' : 'error',
		statusLabel: data.captcha.configured ? 'Configured' : 'Missing HMAC key',
	},
	{
		href: '/showcases/abuse/honeypot',
		icon: 'i-lucide-flower',
		titleKey: m.showcase_abuse_overview_card_honeypot,
		body: `Hidden field "${data.honeypot.field}" + ${data.honeypot.minFillMs}ms minimum fill time. Currently on the feedback form.`,
		status: 'success',
		statusLabel: 'Active',
	},
	{
		href: '/showcases/abuse/rate-limits',
		icon: 'i-lucide-gauge',
		titleKey: m.showcase_abuse_overview_card_rate,
		body: `Per-IP and per-email Upstash limiters across auth, feedback, AI, and the captcha endpoint. Per-email: ${data.perEmail.max}/${data.perEmail.window}.`,
		status: 'success',
		statusLabel: 'Active',
	},
	{
		href: '/showcases/abuse/ai-budget',
		icon: 'i-lucide-coins',
		titleKey: m.showcase_abuse_overview_card_budget,
		body: `Daily token cap of ${data.aiBudget.dailyCap.toLocaleString()} per user. Caps cost-amplification abuse.`,
		status: 'success',
		statusLabel: 'Active',
	},
] as const;
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_overview_card_mode()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">BOT_DETECTION_MODE</span>
				<Badge variant={modeVariant}>{data.mode}</Badge>
			</div>
			<div class="diag-row">
				<span class="diag-label">Description</span>
				<span class="diag-value">
					{#if data.mode === 'live'}
						Checks enforced — denials short-circuit the request.
					{:else if data.mode === 'dry_run'}
						Checks computed and audited but never deny (calibration mode).
					{:else}
						Checks skipped entirely. Emergency-only — do not run in production.
					{/if}
				</span>
			</div>
		</div>
	</Card>

	<div class="defense-grid">
		{#each defenses as d}
			<a class="defense-card" href={d.href}>
				<header class="defense-head">
					<span class="defense-icon {d.icon}" aria-hidden="true"></span>
					<h3 class="defense-title">{d.titleKey()}</h3>
					<Badge variant={d.status}>{d.statusLabel}</Badge>
				</header>
				<p class="defense-body">{d.body}</p>
				<span class="defense-arrow i-lucide-arrow-right" aria-hidden="true"></span>
			</a>
		{/each}
	</div>
</Stack>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		font-size: var(--text-fluid-sm);
		text-align: right;
	}

	.defense-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-3);
	}

	.defense-card {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4) var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		text-decoration: none;
		color: inherit;
		transition: border-color 150ms, transform 150ms;
	}

	.defense-card:hover {
		border-color: var(--color-primary);
		transform: translateY(-1px);
	}

	.defense-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.defense-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.defense-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
	}

	.defense-title {
		flex: 1;
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.defense-body {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.defense-arrow {
		position: absolute;
		top: var(--spacing-4);
		right: var(--spacing-3);
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
		opacity: 0;
		transition: opacity 150ms, transform 150ms;
	}

	.defense-card:hover .defense-arrow {
		opacity: 1;
		transform: translateX(2px);
	}
</style>
