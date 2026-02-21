<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card, SectionNav, Alert } from '$lib/components/composites';
	import { Badge, Button, Input, Progress, Spinner, Typography } from '$lib/components/primitives';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';
	import { getToast } from '$lib/stores/toast.svelte';
	import { PageContainer, Stack, Cluster } from '$lib/components/layout';

	let { data } = $props();

	function formatTtl(seconds: number): string {
		if (seconds === -2) return 'expired';
		if (seconds === -1) return 'no expiry';
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		return m > 0 ? `${h}h ${m}m` : `${h}h`;
	}
	const toast = getToast();

	const sections = [
		{ id: 'ttl-countdown', label: 'TTL Countdown' },
		{ id: 'sliding-expiry', label: 'Sliding Expiry' },
		{ id: 'rate-limiting', label: 'Rate Limiting' },
		{ id: 'cache-vs-db', label: 'Cache vs DB' },
	];

	// ─── TTL state ──────────────────────────────────────
	let newTtlKey = $state('showcase:ttl:');
	let newTtlValue = $state('');
	let newTtlSeconds = $state('60');

	// ─── Sliding state ──────────────────────────────────
	let slideResult = $state<{ before: any; after: any } | null>(null);

	// ─── Rate limit state ───────────────────────────────
	let rateLimitResult = $state<any>(null);
	let rateLoading = $state(false);

	// ─── Loading ────────────────────────────────────────
	let actionLoading = $state('');

	function handleResult(successMsg?: string) {
		return ({ result, update }: { result: any; update: (opts?: any) => Promise<void> }) => {
			actionLoading = '';
			rateLoading = false;
			if (result.type === 'success' && result.data) {
				if (result.data.rateLimit) rateLimitResult = result.data.rateLimit;
				if (result.data.before && result.data.after) {
					slideResult = { before: result.data.before, after: result.data.after };
				}
				toast.success(result.data.message || successMsg || 'Done.');
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Operation failed.');
			}
			return update();
		};
	}
</script>

<svelte:head>
	<title>Ephemeral - Cache - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="Ephemeral"
		description="The cache paradigm where disappearance is a feature — TTL countdown, sliding expiry, and rate limiting."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Cache', href: '/showcases/db/cache' },
			{ label: 'Ephemeral' }
		]}
	/>

	{#if data.error}
		<Alert variant="error" title="Cache Error">
			<code>{data.error}</code>
			<p>Seed the cache from the <a href="/showcases/db/cache/connection">Connection</a> page first.</p>
		</Alert>
	{:else}
		<SectionNav {sections} ariaLabel="Ephemeral sections" />

		<Stack gap="6">
			<!-- TTL COUNTDOWN -->
			<section id="ttl-countdown">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">TTL Countdown</Typography>
						<Typography variant="muted" as="p">Every key below has a Time-To-Live. When the TTL reaches 0, Redis deletes the key automatically.</Typography>
					{/snippet}

					{#if data.snapshots.length > 0}
						<div class="ttl-grid">
							{#each data.snapshots as snapshot}
								<div class="ttl-card" class:expired={snapshot.isExpired}>
									<code class="ttl-key">{snapshot.key.split(':').slice(-1)[0]}</code>
									<span class="ttl-value">
										{#if snapshot.isExpired}
											<Badge variant="error">Expired</Badge>
										{:else}
											<span class="ttl-seconds">{formatTtl(snapshot.remainingSeconds)}</span>
										{/if}
									</span>
									<code class="ttl-full-key">{snapshot.key}</code>
								</div>
							{/each}
						</div>
					{:else}
						<Typography variant="muted" as="p">No TTL entries found. Create one below or reseed from the Connection page.</Typography>
					{/if}

					<div class="create-ttl">
						<Typography variant="muted" as="p">Create a key with TTL:</Typography>
						<form
							method="POST"
							action="?/createTtl"
							use:enhance={() => {
								actionLoading = 'createTtl';
								return handleResult();
							}}
						>
							<div class="action-row">
								<Input name="key" type="text" bind:value={newTtlKey} placeholder="showcase:ttl:my-key" aria-label="Key" />
								<Input name="value" type="text" bind:value={newTtlValue} placeholder="Value" aria-label="Value" />
								<Input name="ttl" type="number" bind:value={newTtlSeconds} placeholder="TTL (s)" aria-label="TTL in seconds" class="ttl-input" />
								<Button type="submit" variant="outline" size="sm" disabled={!newTtlKey || !newTtlValue || !newTtlSeconds}>
									{#if actionLoading === 'createTtl'}<Spinner size="xs" class="mr-1" />{/if}
									Create
								</Button>
							</div>
						</form>
					</div>
				</Card>
			</section>

			<!-- SLIDING EXPIRY -->
			<section id="sliding-expiry">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Sliding Expiry</Typography>
						<Typography variant="muted" as="p">Access extends the TTL — like a session that stays alive while you're active. Click "Access" to reset the TTL.</Typography>
					{/snippet}

					<div class="slide-demo">
						{#each data.snapshots.filter(s => !s.isExpired) as snapshot}
							<div class="slide-row">
								<code class="slide-key">{snapshot.key}</code>
								<span class="slide-ttl">{formatTtl(snapshot.remainingSeconds)}</span>
								<form
									method="POST"
									action="?/refreshTtl"
									use:enhance={() => {
										actionLoading = `slide-${snapshot.key}`;
										return handleResult();
									}}
								>
									<input type="hidden" name="key" value={snapshot.key} />
									<input type="hidden" name="seconds" value="300" />
									<Button type="submit" variant="outline" size="sm">
										{#if actionLoading === `slide-${snapshot.key}`}<Spinner size="xs" class="mr-1" />{/if}
										Access (reset to 5m)
									</Button>
								</form>
							</div>
						{/each}
					</div>

					{#if slideResult}
						<div class="slide-comparison" aria-live="polite">
							<div class="slide-before">
								<Badge variant="warning">Before</Badge>
								<code>{slideResult.before.remainingSeconds}s remaining</code>
							</div>
							<span class="slide-arrow" aria-hidden="true">&rarr;</span>
							<div class="slide-after">
								<Badge variant="success">After</Badge>
								<code>{slideResult.after.remainingSeconds}s remaining</code>
							</div>
						</div>
					{/if}
				</Card>
			</section>

			<!-- RATE LIMITING -->
			<section id="rate-limiting">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Rate Limiting</Typography>
						<Typography variant="muted" as="p">Sliding window rate limiter powered by <code>@upstash/ratelimit</code>. Click repeatedly to see the limit in action.</Typography>
					{/snippet}

					<div class="rate-demo">
						<form
							method="POST"
							action="?/rateCheck"
							use:enhance={() => {
								rateLoading = true;
								return handleResult();
							}}
						>
							<input type="hidden" name="identifier" value="showcase-demo" />
							<input type="hidden" name="limit" value="10" />
							<input type="hidden" name="window" value="10" />
							<Button type="submit" variant="outline" size="sm" disabled={rateLoading}>
								{#if rateLoading}<Spinner size="xs" class="mr-1" />{/if}
								<span class="i-lucide-send h-4 w-4 mr-1" />
								Send Request
							</Button>
						</form>

						{#if rateLimitResult}
							<div class="rate-result" aria-live="polite">
								<div class="rate-status">
									{#if rateLimitResult.allowed}
										<Badge variant="success">Allowed</Badge>
									{:else}
										<Badge variant="error">Rate Limited</Badge>
									{/if}
								</div>

								<div class="rate-gauge">
									<Progress
										value={rateLimitResult.remaining}
										max={rateLimitResult.limit}
										variant={rateLimitResult.remaining <= 2 ? 'error' : 'default'}
										size="sm"
									/>
									<Typography variant="muted" as="span">
										{rateLimitResult.remaining} / {rateLimitResult.limit} remaining
									</Typography>
								</div>

								<div class="rate-meta">
									<span>Window: {rateLimitResult.windowSeconds}s</span>
									<span>Resets: {new Date(rateLimitResult.resetAt).toLocaleTimeString()}</span>
								</div>
							</div>
						{/if}
					</div>
				</Card>
			</section>

			<!-- CACHE VS DB -->
			<section id="cache-vs-db">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Cache vs DB</Typography>
						<Typography variant="muted" as="p">When to use each data paradigm — a quick reference for choosing the right tool.</Typography>
					{/snippet}

					<div class="table-wrap">
						<Table>
							<Header>
								<Row>
									<HeaderCell></HeaderCell>
									<HeaderCell>Cache (Redis)</HeaderCell>
									<HeaderCell>Relational (PostgreSQL)</HeaderCell>
									<HeaderCell>Graph (Neo4j)</HeaderCell>
									<HeaderCell>Object Storage (R2)</HeaderCell>
								</Row>
							</Header>
							<Body>
								<Row>
									<Cell><span class="comp-label">Data lifetime</span></Cell>
									<Cell>Ephemeral (TTL)</Cell>
									<Cell>Permanent</Cell>
									<Cell>Permanent</Cell>
									<Cell>Permanent</Cell>
								</Row>
								<Row>
									<Cell><span class="comp-label">Data shape</span></Cell>
									<Cell>Key-value</Cell>
									<Cell>Tabular rows</Cell>
									<Cell>Nodes + edges</Cell>
									<Cell>Binary blobs</Cell>
								</Row>
								<Row>
									<Cell><span class="comp-label">Best for</span></Cell>
									<Cell>Sessions, counters, rate limits</Cell>
									<Cell>Transactions, reports, CRUD</Cell>
									<Cell>Relationships, traversals</Cell>
									<Cell>Files, images, backups</Cell>
								</Row>
								<Row>
									<Cell><span class="comp-label">Latency</span></Cell>
									<Cell><Badge variant="success">&lt;10ms</Badge></Cell>
									<Cell><Badge variant="warning">50-200ms</Badge></Cell>
									<Cell><Badge variant="warning">100-500ms</Badge></Cell>
									<Cell><Badge variant="warning">50-300ms</Badge></Cell>
								</Row>
								<Row>
									<Cell><span class="comp-label">Consistency</span></Cell>
									<Cell>Eventual</Cell>
									<Cell>ACID</Cell>
									<Cell>ACID</Cell>
									<Cell>Eventual</Cell>
								</Row>
								<Row>
									<Cell><span class="comp-label">Query language</span></Cell>
									<Cell>Redis commands</Cell>
									<Cell>SQL</Cell>
									<Cell>Cypher</Cell>
									<Cell>S3 API</Cell>
								</Row>
							</Body>
						</Table>
					</div>
				</Card>
			</section>
		</Stack>
	{/if}

	<BackLink href="/showcases/db/cache" label="Cache" />
</PageContainer>

<style>
	/* ─── TTL Countdown ──────────────────────────────────── */

	.ttl-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-3);
	}

	.ttl-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.ttl-card.expired {
		opacity: 0.5;
	}

	.ttl-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.ttl-seconds {
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-family: ui-monospace, monospace;
	}

	.ttl-full-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		word-break: break-all;
		text-align: center;
	}

	.create-ttl {
		margin-top: var(--spacing-5);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.ttl-input {
		max-width: 100px;
	}

	/* ─── Sliding Expiry ─────────────────────────────────── */

	.slide-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.slide-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.slide-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		flex: 1;
		word-break: break-all;
	}

	.slide-ttl {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		min-width: 60px;
		text-align: right;
	}

	.slide-comparison {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.slide-before,
	.slide-after {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.slide-arrow {
		color: var(--color-muted);
		font-size: var(--text-fluid-lg);
	}

	/* ─── Rate Limiting ──────────────────────────────────── */

	.rate-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.rate-result {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.rate-status {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.rate-gauge {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.rate-meta {
		display: flex;
		gap: var(--spacing-4);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* ─── Cache vs DB ────────────────────────────────────── */

	.table-wrap {
		overflow-x: auto;
	}

	.comp-label {
		font-weight: 500;
		color: var(--color-muted);
	}

	/* ─── Shared ─────────────────────────────────────────── */

	.action-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	@media (max-width: 640px) {
		.ttl-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
