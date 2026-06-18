<script lang="ts">
import QuotaPanel from '$lib/components/admin/ai/QuotaPanel.svelte';
import { Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';

let { data } = $props();

// Tick `now` once a second so cooldown countdowns update with no server round-trip.
let now = $state(Date.now());
$effect(() => {
	const anyCooling = data.providerDetail.some((p) => p.cooldownUntil);
	if (!anyCooling) return;
	const id = setInterval(() => {
		now = Date.now();
	}, 1000);
	return () => clearInterval(id);
});

function secondsLeft(cooldownUntil: string | null): number {
	if (!cooldownUntil) return 0;
	return Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - now) / 1000));
}

function roleFor(id: string): { label: string; variant: 'success' | 'secondary' } | null {
	if (id === data.activeProviderId) return { label: 'Active · chat', variant: 'success' };
	if (id === data.toolProviderId) return { label: 'Tool turns', variant: 'success' };
	if (data.fallbackIds.includes(id)) return { label: 'Fallback', variant: 'secondary' };
	return null;
}

const noneConfigured = $derived(data.providerDetail.every((p) => !p.configured));
</script>
<Stack gap="6">
	{#if noneConfigured}
		<div class="banner" role="alert">
			<span class="i-lucide-alert-triangle h-5 w-5"></span>
			<span>No AI provider is configured — chat is unavailable. Set one of the provider API keys below.</span>
		</div>
	{/if}

	<!-- Provider registry -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Providers</h2>
		{/snippet}

		<div class="table-wrap" tabindex="0" aria-label="AI providers">
			<table class="data-table">
				<thead>
					<tr>
						<th>Provider</th>
						<th>Model</th>
						<th>Tools</th>
						<th>Role</th>
						<th>Status</th>
						<th>Cooldown</th>
					</tr>
				</thead>
				<tbody>
					{#each data.providerDetail as p}
						{@const role = roleFor(p.id)}
						{@const secs = secondsLeft(p.cooldownUntil)}
						<tr>
							<td>
								<Cluster gap="2" align="center">
									<span class="health-dot health-dot--{p.configured ? 'success' : 'secondary'}"></span>
									<span class="provider-name">{p.name}</span>
								</Cluster>
							</td>
							<td><code class="mono">{p.model}</code></td>
							<td>
								{#if p.supportsTools}
									<span class="i-lucide-check h-4 w-4 text-success" aria-label="Supports tools"></span>
								{:else}
									<span class="i-lucide-minus h-4 w-4 text-muted" aria-label="No tool support"></span>
								{/if}
							</td>
							<td>
								{#if role}
									<Badge variant={role.variant}>{role.label}</Badge>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
							<td>
								{#if p.configured}
									<Badge variant="success">Configured</Badge>
								{:else}
									<Cluster gap="2" align="center">
										<Badge variant="secondary">Not configured</Badge>
										<code class="mono envvar">{p.envVar}</code>
									</Cluster>
								{/if}
							</td>
							<td aria-live="polite">
								{#if secs > 0}
									<Badge variant="warning">Cooling · {secs}s</Badge>
								{:else}
									<span class="muted">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="note">
			Cooldown is the circuit-breaker state (60s), now <strong>shared across instances</strong> via Redis
			— a 429 on one serverless instance cools the provider for all. Falls back to per-instance memory
			only when Redis is unavailable (dev).
		</p>
	</Card>

	<!-- Resources & limits -->
	<QuotaPanel resources={data.resources} />

	<!-- Dual resolver -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Routing</h2>
		{/snippet}

		<p class="muted resolver-intro">
			Two resolvers pick the provider per turn. Chat-only turns and tool-calling turns use different
			preference orders, so the active chat provider and the tool provider can differ.
		</p>

		<div class="resolver-grid">
			<div class="resolver-col">
				<h3 class="resolver-title">Chat turns <span class="resolver-fn">resolveActiveProvider</span></h3>
				<ol class="resolver-order">
					<li>User preference</li>
					<li><code class="mono">AI_PROVIDER</code> env</li>
					<li>First configured</li>
				</ol>
				<div class="resolved">
					Resolved:
					{#if data.activeProviderId}
						<Badge variant="success">{data.activeProviderId}</Badge>
					{:else}
						<Badge variant="error">none</Badge>
					{/if}
				</div>
			</div>

			<div class="resolver-col">
				<h3 class="resolver-title">Tool turns <span class="resolver-fn">resolveToolProvider</span></h3>
				<ol class="resolver-order">
					<li>User preference</li>
					<li><code class="mono">AI_PROVIDER</code> env</li>
					<li>OpenAI → Google → others (tool-capable)</li>
				</ol>
				<div class="resolved">
					Resolved:
					{#if data.toolProviderId}
						<Badge variant="success">{data.toolProviderId}</Badge>
					{:else}
						<Badge variant="error">none</Badge>
					{/if}
				</div>
			</div>
		</div>
	</Card>
</Stack>

<style>
	.banner {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid color-mix(in srgb, var(--color-error) 40%, transparent);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.data-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.provider-name {
		font-weight: 600;
	}

	.health-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.health-dot--success {
		background: var(--color-success);
	}

	.health-dot--secondary {
		background: var(--color-muted);
	}

	.mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.envvar {
		color: var(--color-muted);
	}

	.muted {
		color: var(--color-muted);
	}

	.text-success {
		color: var(--color-success);
	}

	.text-muted {
		color: var(--color-muted);
	}

	.note {
		margin: var(--spacing-3) 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.resolver-intro {
		margin: 0 0 var(--spacing-4);
		font-size: var(--text-fluid-sm);
	}

	.resolver-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--spacing-4);
	}

	.resolver-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.resolver-title {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0;
	}

	.resolver-fn {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		font-weight: 400;
		color: var(--color-muted);
	}

	.resolver-order {
		margin: 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.resolved {
		margin-top: auto;
		padding-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
