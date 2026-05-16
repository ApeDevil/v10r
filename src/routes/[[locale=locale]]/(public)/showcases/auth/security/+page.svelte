<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>
<Stack gap="6">
		<!-- Security Headers -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_security_card_headers()}</h2>
			{/snippet}

			<div class="diag-grid">
				{#each Object.entries(data.headers) as [header, value]}
					<div class="diag-row">
						<span class="diag-label">{header}</span>
						<code class="diag-mono">{value}</code>
					</div>
				{/each}
			</div>
		</Card>

		<!-- CSRF -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_security_card_csrf()}</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Status</span>
					<Badge variant={data.csrf.enabled ? 'success' : 'error'}>
						{data.csrf.enabled ? 'Enabled' : 'Disabled'}
					</Badge>
				</div>
				<div class="diag-row">
					<span class="diag-label">Mechanism</span>
					<span class="diag-value">{data.csrf.description}</span>
				</div>
			</div>
		</Card>

		<!-- Trusted Origins -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_security_card_origins()}</h2>
			{/snippet}

			<div class="diag-grid">
				{#each data.trustedOrigins as origin}
					<div class="diag-row">
						<span class="diag-label">Origin</span>
						<code class="diag-mono">{origin}</code>
					</div>
				{/each}
			</div>

			<p class="text-sm text-muted mt-3">
				Only requests from these origins are accepted. No wildcards — explicit origins only (past CVE CVSS 9.3).
			</p>
		</Card>

		<!-- Rate Limiting -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_security_card_rate()}</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Built-in</span>
					<span class="diag-value">{data.rateLimiting.builtin}</span>
				</div>
				<div class="diag-row">
					<span class="diag-label">External</span>
					<span class="diag-value">{data.rateLimiting.external}</span>
				</div>
			</div>
		</Card>

		<!-- Version -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_security_card_info()}</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Better Auth Version</span>
					<code class="diag-mono">{data.betterAuthVersion}</code>
				</div>
				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>
		</Card>

		<a class="see-also" href="/showcases/abuse/captcha">
			<span class="see-also-icon i-lucide-shield-alert" aria-hidden="true"></span>
			<span class="see-also-body">
				<strong>See also: active anti-abuse layer</strong>
				<span class="see-also-sub">Captcha, honeypot, per-email rate limits, AI token budget.</span>
			</span>
			<span class="see-also-arrow i-lucide-arrow-right" aria-hidden="true"></span>
		</a>
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
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.see-also {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		text-decoration: none;
		color: inherit;
		transition: border-color 150ms;
	}

	.see-also:hover {
		border-color: var(--color-primary);
	}

	.see-also:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.see-also-icon {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
	}

	.see-also-body {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.see-also-body strong {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.see-also-sub {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.see-also-arrow {
		flex-shrink: 0;
		width: 1rem;
		height: 1rem;
		color: var(--color-muted);
	}
</style>
