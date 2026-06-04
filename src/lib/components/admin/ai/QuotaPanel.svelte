<script lang="ts">
import { Card } from '$lib/components/composites';
import { Cluster } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';

/**
 * Provider Resources & Limits board. Table-primary and honesty-first: documented
 * ceilings (with a confidence flag + last-verified date), our own *estimated*
 * logged usage (a lower bound), the truthful Gemini-specific signals (embedding
 * calls + 429s that conversation_step can't see), and live availability.
 *
 * Client-safe local type — mirrors the serialized `ProviderQuota` from the loader
 * (never imports the server module).
 */
interface ProviderQuota {
	id: string;
	name: string;
	configured: boolean;
	model: string;
	rpd: number | null;
	rpm: number | null;
	tpm: number | null;
	rpdConfidence: 'documented' | 'estimated' | 'unknown';
	resetKind: 'fixed-daily' | 'rolling' | 'unknown';
	resetTimezone: string | null;
	resetAt: string | null;
	verifiedOn: string;
	sourceUrl: string;
	note?: string;
	requestsToday: number;
	tokensToday: number;
	embeddingsToday: number;
	rateLimitedToday: number;
	usageSource: 'estimated' | 'unknown';
	remaining: number | null;
	cooledDown: boolean;
	cooldownUntil: string | null;
}

let { resources }: { resources: ProviderQuota[] } = $props();

// Tick only while something is actually counting down (cooldown or a fixed reset).
let now = $state(Date.now());
$effect(() => {
	const ticking = resources.some((p) => p.cooldownUntil || p.resetAt);
	if (!ticking) return;
	const id = setInterval(() => {
		now = Date.now();
	}, 1000);
	return () => clearInterval(id);
});

function secondsLeft(until: string | null): number {
	if (!until) return 0;
	return Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000));
}

function resetsIn(resetAt: string | null): string {
	if (!resetAt) return '';
	const ms = new Date(resetAt).getTime() - now;
	if (ms <= 0) return 'soon';
	const totalMin = Math.floor(ms / 60_000);
	const h = Math.floor(totalMin / 60);
	const m = totalMin % 60;
	return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Low headroom = warning (text + icon, never color alone).
function isLow(p: ProviderQuota): boolean {
	return p.rpd !== null && p.remaining !== null && p.remaining <= Math.max(1, p.rpd * 0.2);
}
</script>

<Card>
	{#snippet header()}
		<h2 class="text-fluid-lg font-semibold">Resources &amp; Limits</h2>
	{/snippet}

	<div class="table-wrap" tabindex="0" aria-label="Provider resources and rate limits">
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">Provider</th>
					<th scope="col">Documented limit</th>
					<th scope="col">Logged today</th>
					<th scope="col">Est. remaining</th>
					<th scope="col">Rate-limited</th>
					<th scope="col">Availability</th>
				</tr>
			</thead>
			<tbody>
				{#each resources as p (p.id)}
					{@const secs = secondsLeft(p.cooldownUntil)}
					{@const low = isLow(p)}
					<tr class:dim={!p.configured}>
						<td>
							<Cluster gap="2" align="center">
								<span class="health-dot health-dot--{p.configured ? 'success' : 'secondary'}"></span>
								<span class="provider-name">{p.name}</span>
							</Cluster>
							<code class="mono sub">{p.model}</code>
						</td>

						<td>
							{#if p.rpd !== null}
								<span class="num">{p.rpd.toLocaleString()}<span class="unit">/day</span></span>
							{:else if p.resetKind === 'rolling'}
								<span class="muted">no daily cap</span>
							{:else}
								<span class="muted">—</span>
							{/if}
							{#if p.rpm !== null}
								<span class="sub">{p.rpm}/min</span>
							{/if}
							<span class="meta">
								{#if p.rpdConfidence === 'estimated'}
									<Badge variant="warning">estimated</Badge>
								{:else if p.rpdConfidence === 'documented'}
									<Badge variant="secondary">documented</Badge>
								{:else}
									<Badge variant="secondary">unknown</Badge>
								{/if}
								<span class="verified" title={p.note ?? ''}>verified {p.verifiedOn}</span>
							</span>
						</td>

						<td>
							{#if p.usageSource === 'unknown'}
								<span class="muted">—</span>
							{:else}
								<span class="num">{p.requestsToday.toLocaleString()}<span class="unit"> req</span></span>
								<span class="est">est.</span>
								{#if p.embeddingsToday > 0}
									<span class="sub">+{p.embeddingsToday.toLocaleString()} embeds</span>
								{/if}
							{/if}
						</td>

						<td>
							{#if p.remaining === null}
								<span class="muted" title="No fixed daily cap to subtract from">—</span>
							{:else}
								<Cluster gap="1" align="center">
									{#if low}
										<span class="i-lucide-alert-triangle h-4 w-4 text-warning" aria-hidden="true"></span>
									{/if}
									<span class="num" class:low>~{p.remaining.toLocaleString()}</span>
									{#if low}<span class="sr-only">low headroom</span>{/if}
								</Cluster>
							{/if}
						</td>

						<td>
							{#if p.rateLimitedToday > 0}
								<Cluster gap="1" align="center">
									<span class="i-lucide-ban h-4 w-4 text-error" aria-hidden="true"></span>
									<span class="num">{p.rateLimitedToday.toLocaleString()}</span>
									<span class="sr-only">rate-limit hits today</span>
								</Cluster>
							{:else}
								<span class="muted">0</span>
							{/if}
						</td>

						<td aria-live="polite">
							{#if !p.configured}
								<span class="muted">not configured</span>
							{:else if secs > 0}
								<Badge variant="warning">Cooling · {secs}s</Badge>
							{:else if p.resetAt}
								<Cluster gap="1" align="center">
									<span class="i-lucide-check h-4 w-4 text-success" aria-hidden="true"></span>
									<span>available</span>
									<span class="sub">· resets in {resetsIn(p.resetAt)}</span>
								</Cluster>
							{:else}
								<Cluster gap="1" align="center">
									<span class="i-lucide-check h-4 w-4 text-success" aria-hidden="true"></span>
									<span>available</span>
								</Cluster>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="note">
		Usage is <strong>estimated</strong> from this app's own logged calls — a lower bound that excludes
		retries, failed requests, and any other tooling sharing a provider key. Limits are documented
		ceilings (last verified per row); providers change them without notice. Cooldown is shared across
		instances (Redis-backed). Gemini's free-tier daily limit is unstable and its real wall is usually
		the per-minute rate, not the daily count.
	</p>
</Card>

<style>
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
		vertical-align: top;
	}
	tr.dim {
		opacity: 0.6;
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
	.num {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.num.low {
		color: var(--color-warning);
	}
	.unit {
		font-weight: 400;
		color: var(--color-muted);
	}
	.sub {
		display: block;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.est {
		margin-left: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-style: italic;
	}
	.meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin-top: 2px;
	}
	.verified {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}
	.muted {
		color: var(--color-muted);
	}
	.text-success {
		color: var(--color-success);
	}
	.text-warning {
		color: var(--color-warning);
	}
	.text-error {
		color: var(--color-error);
	}
	.note {
		margin: var(--spacing-3) 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
