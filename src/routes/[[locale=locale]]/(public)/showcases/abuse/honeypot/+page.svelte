<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_honeypot_card_field()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Field name</span>
				<code class="diag-mono">{data.field}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Visibility</span>
				<span class="diag-value">Hidden via CSS (visually-hidden + aria-hidden)</span>
			</div>
		</div>

		<p class="card-note">
			Naive bots fill every form field they see. The hidden <code>{data.field}</code> field is invisible to humans
			(screen readers included), so any non-empty value is a high-confidence signal of automation. Field names like
			<code>website</code>, <code>url</code>, and <code>homepage</code> appear in solver blocklists, so we use an
			innocuous name that does not pattern-match. Rotate the constant if a particular form starts seeing zero blocks.
		</p>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_honeypot_card_timing()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Minimum fill time</span>
				<code class="diag-mono">{data.minFillMs} ms</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Renders</span>
				<span class="diag-value">timestamp injected at <code>load</code> time, validated server-side on submit</span>
			</div>
		</div>

		<p class="card-note">
			Bots submit forms in milliseconds; humans take seconds to read, type, and click. Submissions faster than
			the minimum are silently rejected as bot traffic — same response shape as a successful submit, so probing
			doesn't surface the threshold.
		</p>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_honeypot_card_surfaces()}</h2>
		{/snippet}

		<ul class="surface-list">
			{#each data.surfaces as s}
				<li>
					<a class="surface-link" href={s.href}>{s.label}</a>
					<code class="diag-mono">{s.path}</code>
				</li>
			{/each}
		</ul>

		<p class="card-note">
			Auth flows use ALTCHA instead — the honeypot is reserved for unauthenticated form posts where adding a
			captcha widget would add too much friction.
		</p>
	</Card>
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

	.diag-value code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.card-note {
		margin: var(--spacing-3) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.card-note code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.surface-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.surface-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		flex-wrap: wrap;
	}

	.surface-link {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		font-size: var(--text-fluid-sm);
	}
</style>
