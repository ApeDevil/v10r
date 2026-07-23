<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<div>
					<h1 class="text-fluid-lg font-semibold">{m.admin_mcp_title()}</h1>
					<p class="text-fluid-sm text-muted">{m.admin_mcp_description()}</p>
				</div>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					{m.admin_action_refresh()}
				</Button>
			</Cluster>
		{/snippet}

		{#if data.unavailable || !data.state}
			<EmptyState
				icon="i-lucide-database"
				title={m.admin_mcp_unavailable_title()}
				description={m.admin_mcp_unavailable_description()}
			/>
		{:else}
			<Stack gap="5">
				<!-- Color: shown as a swatch AND as text (never by color alone). -->
				<div class="field">
					<span class="field-label">{m.admin_mcp_color_label()}</span>
					<Cluster gap="3" align="center">
						<span class="swatch" data-color={data.state.color} role="img" aria-label={data.state.color}></span>
						<Badge variant="secondary">{data.state.color}</Badge>
					</Cluster>
				</div>

				<div class="field">
					<span class="field-label">{m.admin_mcp_message_label()}</span>
					<p class="message">{data.state.message}</p>
				</div>

				<div class="meta">
					<div class="meta-item">
						<span class="field-label">{m.admin_mcp_version_label()}</span>
						<span class="meta-value">v{data.state.version}</span>
					</div>
					<div class="meta-item">
						<span class="field-label">{m.admin_mcp_updated_label()}</span>
						<time class="meta-value" datetime={data.state.updatedAt}>{data.state.updatedAt}</time>
					</div>
					<div class="meta-item">
						<span class="field-label">{m.admin_mcp_updater_label()}</span>
						<span class="meta-value">{data.state.updatedBy ?? m.admin_mcp_updater_none()}</span>
					</div>
				</div>
			</Stack>
		{/if}

		{#snippet footer()}
			<p class="text-fluid-sm text-muted">{m.admin_mcp_readonly_note()}</p>
		{/snippet}
	</Card>
</Stack>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.field-label {
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
	}

	.message {
		font-size: var(--text-fluid-base);
		color: var(--color-fg);
		/* Wrap arbitrary user text safely; it is rendered as text (auto-escaped), never HTML. */
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	/*
	 * The demo palette is DATA, not UI chrome — a fixed, curated categorical set (like a
	 * chart's series colors). Values are authored in oklch to match the design system's color
	 * space and live in one scoped block rather than scattered inline.
	 */
	.swatch {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-muted);
		flex-shrink: 0;
	}
	.swatch[data-color='blue'] {
		background: oklch(0.55 0.18 260);
	}
	.swatch[data-color='red'] {
		background: oklch(0.55 0.2 25);
	}
	.swatch[data-color='green'] {
		background: oklch(0.6 0.16 150);
	}
	.swatch[data-color='yellow'] {
		background: oklch(0.85 0.15 95);
	}
	.swatch[data-color='orange'] {
		background: oklch(0.68 0.16 55);
	}
	.swatch[data-color='purple'] {
		background: oklch(0.5 0.18 300);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-5);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.meta-item {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.meta-value {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}
</style>
