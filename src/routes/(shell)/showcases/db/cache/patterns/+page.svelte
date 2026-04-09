<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { Alert, Card, FormField, NavSection } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import {
	Badge,
	Body,
	Button,
	Cell,
	Header,
	HeaderCell,
	Input,
	Row,
	Spinner,
	Table,
	Typography,
} from '$lib/components/primitives';
import { getToast } from '$lib/state/toast.svelte';

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
	{ id: 'overview', label: 'Overview' },
	{ id: 'strings', label: 'Strings' },
	{ id: 'hashes', label: 'Hashes' },
	{ id: 'counters', label: 'Counters' },
	{ id: 'sorted-sets', label: 'Sorted Sets' },
	{ id: 'lists', label: 'Lists' },
];

// ─── Inspect state ──────────────────────────────────
let inspectLoading = $state(false);
let inspectResult = $state<{ key: string; type: string; value: unknown } | null>(null);

// ─── String state ───────────────────────────────────
let newStringKey = $state('showcase:');
let newStringValue = $state('');
let newStringTtl = $state('');

// ─── Hash state ─────────────────────────────────────
let hashField = $state('');
let hashValue = $state('');

// ─── Sorted set state ───────────────────────────────
let newMember = $state('');
let newScore = $state('');

// ─── List state ─────────────────────────────────────
let listValue = $state('');

// ─── Loading states ─────────────────────────────────
let actionLoading = $state('');

function handleResult(successMsg?: string) {
	return ({
		result,
		update,
	}: {
		result: ActionResult;
		update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
	}) => {
		actionLoading = '';
		if (result.type === 'success' && result.data) {
			if (result.data.detail) inspectResult = result.data.detail;
			toast.success((result.data.message as string) || successMsg || 'Done.');
		} else if (result.type === 'failure') {
			toast.error((result.data?.message as string) || 'Operation failed.');
		}
		return update();
	};
}

function formatValue(val: unknown): string {
	if (val === null || val === undefined) return 'null';
	if (typeof val === 'object') return JSON.stringify(val, null, 2);
	return String(val);
}

const typeBadgeVariant = (type: string) => {
	const map: Record<string, 'success' | 'warning' | 'error' | 'secondary'> = {
		string: 'success',
		hash: 'warning',
		list: 'secondary',
		zset: 'error',
		set: 'secondary',
	};
	return map[type] ?? 'secondary';
};
</script>

<svelte:head>
	<title>Patterns - Cache - Showcases - Velociraptor</title>
</svelte:head>

{#if data.error}
		<Alert variant="error" title="Cache Error">
			<code>{data.error}</code>
			<p>Seed the cache from the <a href="/showcases/db/cache/connection">Connection</a> page first.</p>
		</Alert>
	{:else}
		<NavSection {sections} ariaLabel="Pattern sections" />

		<Stack gap="6">
			<!-- OVERVIEW -->
			<section id="overview">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Overview</Typography>
						<Typography variant="muted" as="p">All showcase keys with their Redis data type and TTL status.</Typography>
					{/snippet}

					<div class="stats-grid">
						<div class="stat-card">
							<span class="stat-value">{data.stats.keyCount}</span>
							<span class="stat-label">Total Keys</span>
						</div>
						{#each Object.entries(data.stats.keysByType) as [type, count]}
							<div class="stat-card">
								<span class="stat-value">{count}</span>
								<span class="stat-label">{type}</span>
							</div>
						{/each}
					</div>

					{#if data.entries.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Key</HeaderCell>
										<HeaderCell>Type</HeaderCell>
										<HeaderCell>TTL</HeaderCell>
										<HeaderCell><span class="sr-only">Actions</span></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.entries as entry}
										<Row>
											<Cell><code class="key-mono">{entry.key}</code></Cell>
											<Cell><Badge variant={typeBadgeVariant(entry.type)}>{entry.type}</Badge></Cell>
											<Cell><code class="ttl-mono">{formatTtl(entry.ttl)}</code></Cell>
											<Cell>
												<form
													method="POST"
													action="?/inspect"
													use:enhance={() => {
														inspectLoading = true;
														return async (event) => {
															inspectLoading = false;
															if (event.result.type === 'success' && event.result.data?.detail) {
																inspectResult = event.result.data.detail as { key: string; type: string; value: unknown };
															} else if (event.result.type === 'failure') {
																toast.error((event.result.data?.message as string) || 'Inspect failed.');
															}
															return event.update();
														};
													}}
												>
													<input type="hidden" name="key" value={entry.key} />
													<Button type="submit" variant="outline" size="sm">Inspect</Button>
												</form>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<Typography variant="muted" as="p">No keys found. Use Reseed on the Connection page.</Typography>
					{/if}

					{#if inspectResult}
						<div class="inspect-panel" aria-live="polite">
							<Cluster justify="between" align="start">
								<div>
									<code class="inspect-key">{inspectResult.key}</code>
									<Badge variant={typeBadgeVariant(inspectResult.type)}>{inspectResult.type}</Badge>
								</div>
								<Button variant="outline" size="sm" onclick={() => inspectResult = null}>Close</Button>
							</Cluster>
							<pre class="inspect-value"><code>{formatValue(inspectResult.value)}</code></pre>
						</div>
					{/if}
				</Card>
			</section>

			<!-- STRINGS -->
			<section id="strings">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Strings</Typography>
						<Typography variant="muted" as="p">The most basic Redis type. SET stores a value, GET retrieves it. Optionally attach a TTL for auto-expiry.</Typography>
					{/snippet}

					<form
						method="POST"
						action="?/setString"
						use:enhance={() => {
							actionLoading = 'setString';
							return handleResult();
						}}
					>
						<div class="form-grid">
							<FormField label="Key" id="str-key">
								{#snippet children(_)}
									<Input id="str-key" name="key" type="text" bind:value={newStringKey} placeholder="showcase:my-key" />
								{/snippet}
							</FormField>
							<FormField label="Value" id="str-value">
								{#snippet children(_)}
									<Input id="str-value" name="value" type="text" bind:value={newStringValue} placeholder="Hello, Redis!" />
								{/snippet}
							</FormField>
							<FormField label="TTL (seconds)" id="str-ttl">
								{#snippet children(_)}
									<Input id="str-ttl" name="ttl" type="number" bind:value={newStringTtl} placeholder="Optional" />
								{/snippet}
							</FormField>
							<div class="form-action">
								<Button type="submit" variant="outline" size="sm" disabled={actionLoading === 'setString'}>
									{#if actionLoading === 'setString'}<Spinner size="xs" class="mr-1" />{/if}
									SET
								</Button>
							</div>
						</div>
					</form>
				</Card>
			</section>

			<!-- HASHES -->
			<section id="hashes">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Hashes</Typography>
						<Typography variant="muted" as="p">A hash maps string fields to string values — like a lightweight row. Use HSET/HGET to manipulate individual fields.</Typography>
					{/snippet}

					{#each data.entries.filter(e => e.type === 'hash') as entry}
						<div class="hash-section">
							<code class="hash-key">{entry.key}</code>
							<form
								method="POST"
								action="?/inspect"
								use:enhance={() => {
									return async (event) => {
										if (event.result.type === 'success' && event.result.data?.detail) {
											inspectResult = event.result.data.detail as { key: string; type: string; value: unknown };
										}
										return event.update();
									};
								}}
							>
								<input type="hidden" name="key" value={entry.key} />
								<Button type="submit" variant="outline" size="sm">Load Fields</Button>
							</form>
						</div>
					{/each}

					<div class="hash-form">
						<Typography variant="muted" as="p">Set or delete a field on <code>showcase:hash:feature-flags</code>:</Typography>
						<div class="action-row">
							<Input type="text" bind:value={hashField} placeholder="Field name" aria-label="Field name" />
							<Input type="text" bind:value={hashValue} placeholder="Value" aria-label="Value" />
							<form
								method="POST"
								action="?/setField"
								use:enhance={() => {
									actionLoading = 'setField';
									return handleResult();
								}}
							>
								<input type="hidden" name="key" value="showcase:hash:feature-flags" />
								<input type="hidden" name="field" value={hashField} />
								<input type="hidden" name="value" value={hashValue} />
								<Button type="submit" variant="outline" size="sm" disabled={!hashField || !hashValue}>HSET</Button>
							</form>
							<form
								method="POST"
								action="?/deleteField"
								use:enhance={() => {
									actionLoading = 'deleteField';
									return handleResult();
								}}
							>
								<input type="hidden" name="key" value="showcase:hash:feature-flags" />
								<input type="hidden" name="field" value={hashField} />
								<Button type="submit" variant="outline" size="sm" disabled={!hashField}>HDEL</Button>
							</form>
						</div>
					</div>
				</Card>
			</section>

			<!-- COUNTERS -->
			<section id="counters">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Counters</Typography>
						<Typography variant="muted" as="p">Redis strings that hold numeric values. INCR/DECR are atomic — safe for concurrent access without locks.</Typography>
					{/snippet}

					<div class="counter-grid">
						{#each data.entries.filter(e => e.key.includes(':counter:')) as entry}
							<div class="counter-card">
								<code class="counter-key">{entry.key.split(':').pop()}</code>
								<div class="counter-actions">
									<form method="POST" action="?/decrement" use:enhance={() => { actionLoading = `dec-${entry.key}`; return handleResult(); }}>
										<input type="hidden" name="key" value={entry.key} />
										<input type="hidden" name="amount" value="1" />
										<Button type="submit" variant="outline" size="sm">-</Button>
									</form>
									<form method="POST" action="?/inspect" use:enhance={() => {
										return async (event) => {
											if (event.result.type === 'success' && event.result.data?.detail) {
												inspectResult = event.result.data.detail as { key: string; type: string; value: unknown };
											}
											return event.update();
										};
									}}>
										<input type="hidden" name="key" value={entry.key} />
										<Button type="submit" variant="outline" size="sm">View</Button>
									</form>
									<form method="POST" action="?/increment" use:enhance={() => { actionLoading = `inc-${entry.key}`; return handleResult(); }}>
										<input type="hidden" name="key" value={entry.key} />
										<input type="hidden" name="amount" value="1" />
										<Button type="submit" variant="outline" size="sm">+</Button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			</section>

			<!-- SORTED SETS -->
			<section id="sorted-sets">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Sorted Sets</Typography>
						<Typography variant="muted" as="p">Each member has a score — the set stays sorted automatically. Perfect for leaderboards, rankings, and priority queues.</Typography>
					{/snippet}

					{#each data.entries.filter(e => e.type === 'zset') as entry}
						<div class="zset-header">
							<code class="zset-key">{entry.key}</code>
							<form method="POST" action="?/inspect" use:enhance={() => {
								return async (event) => {
									if (event.result.type === 'success' && event.result.data?.detail) {
										inspectResult = event.result.data.detail as { key: string; type: string; value: unknown };
									}
									return event.update();
								};
							}}>
								<input type="hidden" name="key" value={entry.key} />
								<Button type="submit" variant="outline" size="sm">Load Members</Button>
							</form>
						</div>
					{/each}

					<div class="zset-form">
						<div class="action-row">
							<Input type="text" bind:value={newMember} placeholder="Member name" aria-label="Member name" />
							<Input type="number" bind:value={newScore} placeholder="Score" aria-label="Score" />
							<form method="POST" action="?/addMember" use:enhance={() => { actionLoading = 'addMember'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:leaderboard:tech-popularity" />
								<input type="hidden" name="member" value={newMember} />
								<input type="hidden" name="score" value={newScore} />
								<Button type="submit" variant="outline" size="sm" disabled={!newMember || !newScore}>ZADD</Button>
							</form>
							<form method="POST" action="?/removeMember" use:enhance={() => { actionLoading = 'removeMember'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:leaderboard:tech-popularity" />
								<input type="hidden" name="member" value={newMember} />
								<Button type="submit" variant="outline" size="sm" disabled={!newMember}>ZREM</Button>
							</form>
						</div>
					</div>
				</Card>
			</section>

			<!-- LISTS -->
			<section id="lists">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Lists</Typography>
						<Typography variant="muted" as="p">Ordered sequences of strings. Push to either end, pop from either end — a double-ended queue (deque).</Typography>
					{/snippet}

					{#each data.entries.filter(e => e.type === 'list') as entry}
						<div class="list-header">
							<code class="list-key">{entry.key}</code>
							<form method="POST" action="?/inspect" use:enhance={() => {
								return async (event) => {
									if (event.result.type === 'success' && event.result.data?.detail) {
										inspectResult = event.result.data.detail as { key: string; type: string; value: unknown };
									}
									return event.update();
								};
							}}>
								<input type="hidden" name="key" value={entry.key} />
								<Button type="submit" variant="outline" size="sm">Load Items</Button>
							</form>
						</div>
					{/each}

					<div class="list-form">
						<div class="action-row">
							<Input type="text" bind:value={listValue} placeholder="Value to push" aria-label="Value to push" />
							<form method="POST" action="?/pushItem" use:enhance={() => { actionLoading = 'lpush'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:queue:recent-events" />
								<input type="hidden" name="value" value={listValue} />
								<input type="hidden" name="side" value="left" />
								<Button type="submit" variant="outline" size="sm" disabled={!listValue}>LPUSH</Button>
							</form>
							<form method="POST" action="?/pushItem" use:enhance={() => { actionLoading = 'rpush'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:queue:recent-events" />
								<input type="hidden" name="value" value={listValue} />
								<input type="hidden" name="side" value="right" />
								<Button type="submit" variant="outline" size="sm" disabled={!listValue}>RPUSH</Button>
							</form>
							<form method="POST" action="?/popItem" use:enhance={() => { actionLoading = 'lpop'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:queue:recent-events" />
								<input type="hidden" name="side" value="left" />
								<Button type="submit" variant="outline" size="sm">LPOP</Button>
							</form>
							<form method="POST" action="?/popItem" use:enhance={() => { actionLoading = 'rpop'; return handleResult(); }}>
								<input type="hidden" name="key" value="showcase:queue:recent-events" />
								<input type="hidden" name="side" value="right" />
								<Button type="submit" variant="outline" size="sm">RPOP</Button>
							</form>
						</div>
					</div>
				</Card>
			</section>
		</Stack>
	{/if}


<style>
	/* ─── Stats ──────────────────────────────────────────── */

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-5);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.stat-value {
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-family: ui-monospace, monospace;
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: capitalize;
	}

	/* ─── Table ──────────────────────────────────────────── */

	.table-wrap {
		overflow-x: auto;
	}

	.key-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.ttl-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	/* ─── Inspect ────────────────────────────────────────── */

	.inspect-panel {
		margin-top: var(--spacing-5);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.inspect-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin-right: var(--spacing-2);
	}

	.inspect-value {
		margin: 0;
		padding: var(--spacing-3);
		background: var(--color-bg);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		overflow-x: auto;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
	}

	/* ─── Forms ──────────────────────────────────────────── */

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr auto auto;
		gap: var(--spacing-3);
		align-items: end;
	}

	.form-action {
		align-self: end;
	}

	.action-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	/* ─── Hashes ─────────────────────────────────────────── */

	.hash-section {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
	}

	.hash-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.hash-form {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	/* ─── Counters ───────────────────────────────────────── */

	.counter-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-3);
	}

	.counter-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.counter-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.counter-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	/* ─── Sorted Sets ────────────────────────────────────── */

	.zset-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
	}

	.zset-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.zset-form {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	/* ─── Lists ──────────────────────────────────────────── */

	.list-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
	}

	.list-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.list-form {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	@media (max-width: 640px) {
		.form-grid {
			grid-template-columns: 1fr;
		}

		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>
