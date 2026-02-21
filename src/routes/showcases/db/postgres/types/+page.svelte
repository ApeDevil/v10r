<script lang="ts">
	import { enhance } from '$app/forms';
	import { PageHeader, BackLink, Card, SectionNav, ConfirmDialog } from '$lib/components/composites';
	import { Badge, Button, Tooltip } from '$lib/components/primitives';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';
	import { getToast } from '$lib/stores/toast.svelte';

	let { data } = $props();
	const toast = getToast();

	let resetDialogOpen = $state(false);

	const sections = [
		{ id: 'numeric', label: 'Numeric' },
		{ id: 'text', label: 'Text' },
		{ id: 'temporal', label: 'Temporal' },
		{ id: 'boolean', label: 'Boolean' },
		{ id: 'uuid', label: 'UUID' },
		{ id: 'json', label: 'JSON' },
		{ id: 'arrays', label: 'Arrays' },
		{ id: 'ranges', label: 'Ranges' },
		{ id: 'network', label: 'Network' },
		{ id: 'enums', label: 'Enums' },
	];

	function formatValue(val: unknown): string {
		if (val === null || val === undefined) return 'NULL';
		if (typeof val === 'object') return JSON.stringify(val, null, 2);
		return String(val);
	}
</script>

<svelte:head>
	<title>Type System - PostgreSQL - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Type System"
		description="Every PostgreSQL type demonstrated with live data from Neon. Loaded in {data.queryMs}ms ({data.specimens.length + data.temporals.length + data.documents.length + data.collections.length + data.networks.length + data.bookings.length + data.audits.length} total rows, 7 parallel queries)."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'PostgreSQL', href: '/showcases/db/postgres' },
			{ label: 'Types' }
		]}
	/>

	{#if data.error}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Database Error</h2>
			{/snippet}
			<code class="error-msg">{data.error}</code>
			<p class="error-hint">Run <code>db:push</code> to initialize the showcase schema, then use the Reseed button.</p>
		</Card>
	{:else}
		<SectionNav {sections} ariaLabel="Type categories" />

		<div class="sections">
			<!-- NUMERIC TYPES -->
			<section id="numeric">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Numeric Types</h2>
						<p class="section-desc">PostgreSQL stores exact and approximate numbers. Choose based on precision — <code>numeric</code> is exact, <code>real</code>/<code>double</code> are not.</p>
					{/snippet}

					{#if data.specimens.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Label</HeaderCell>
										<HeaderCell><Tooltip content="2-byte signed integer, range -32,768 to +32,767. Use for small bounded values like ratings." side="bottom"><span class="type-hint">smallint</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="4-byte signed integer, range ±2.1 billion. The default integer type." side="bottom"><span class="type-hint">integer</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="8-byte signed integer, range ±9.2 quintillion. Use for counters that may exceed 2 billion." side="bottom"><span class="type-hint">bigint</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Exact decimal with configurable precision. No floating-point rounding errors — use for money and measurements." side="bottom"><span class="type-hint">numeric</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="4-byte floating point, ~6 decimal digits precision. Fast but inexact." side="bottom"><span class="type-hint">real</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="8-byte floating point, ~15 decimal digits. Use for scientific data where exact precision isn't critical." side="bottom"><span class="type-hint">double (lat)</span></Tooltip></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.specimens as s (s.id)}
										<Row>
											<Cell class="font-medium">{s.label}</Cell>
											<Cell><code>{formatValue(s.rating)}</code></Cell>
											<Cell><code>{formatValue(s.quantity)}</code></Cell>
											<Cell><code>{formatValue(s.viewCount)}</code></Cell>
											<Cell><code>{formatValue(s.price)}</code></Cell>
											<Cell><code>{formatValue(s.temperature)}</code></Cell>
											<Cell><code>{formatValue(s.latitude)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- TEXT TYPES -->
			<section id="text">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Text / String Types</h2>
						<p class="section-desc"><code>text</code> is the workhorse — no performance penalty vs <code>varchar</code>. Use <code>varchar(n)</code> only when you need a constraint. <code>char(n)</code> is space-padded and rarely useful.</p>
					{/snippet}

					{#if data.specimens.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell><Tooltip content="Variable unlimited length. The preferred string type in PostgreSQL — no performance penalty vs varchar." side="bottom"><span class="type-hint">text (label)</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Variable length with a max-length check constraint. Use when you need to enforce a limit." side="bottom"><span class="type-hint">varchar(10) (code)</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Fixed-length, space-padded. Rarely useful — text or varchar is almost always better." side="bottom"><span class="type-hint">char(2) (country)</span></Tooltip></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.specimens as s (s.id)}
										<Row>
											<Cell>{s.label}</Cell>
											<Cell><Badge variant="secondary">{s.code}</Badge></Cell>
											<Cell><code>{formatValue(s.countryCode)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{/if}
				</Card>
			</section>

			<!-- TEMPORAL TYPES -->
			<section id="temporal">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Date & Time Types</h2>
						<p class="section-desc">Always use <code>timestamptz</code> for wall-clock times. <code>timestamp</code> without timezone is rarely correct. <code>interval</code> stores durations PostgreSQL can do arithmetic with.</p>
					{/snippet}

					{#if data.temporals.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Description</HeaderCell>
										<HeaderCell><Tooltip content="Calendar date only (no time), 4 bytes. Format: YYYY-MM-DD." side="bottom"><span class="type-hint">date</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Time of day without date or timezone, 8 bytes. Use timestamptz for most real-world needs." side="bottom"><span class="type-hint">time</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Date + time + timezone, always stored as UTC internally. The correct choice for wall-clock times." side="bottom"><span class="type-hint">timestamptz</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Duration that PostgreSQL can do arithmetic with. Supports ISO 8601 and human-readable input like '2 hours 30 minutes'." side="bottom"><span class="type-hint">interval</span></Tooltip></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.temporals as t (t.id)}
										<Row>
											<Cell class="font-medium">{t.description}</Cell>
											<Cell><code>{formatValue(t.eventDate)}</code></Cell>
											<Cell><code>{formatValue(t.eventTime)}</code></Cell>
											<Cell><code class="text-xs">{formatValue(t.utcTimestamp)}</code></Cell>
											<Cell><code>{formatValue(t.duration)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- BOOLEAN -->
			<section id="boolean">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Boolean</h2>
						<p class="section-desc">PostgreSQL accepts many literals: <code>true</code>, <code>'yes'</code>, <code>'on'</code>, <code>'1'</code>. Always store as <code>boolean</code>, never as integer or string.</p>
					{/snippet}

					{#if data.specimens.length > 0}
						<div class="bool-grid">
							{#each data.specimens as s (s.id)}
								<div class="bool-item">
									<span class="bool-label">{s.label}</span>
									<Badge variant={s.isActive ? 'success' : 'error'}>
										{s.isActive ? 'true' : 'false'}
									</Badge>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			</section>

			<!-- UUID -->
			<section id="uuid">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">UUID</h2>
						<p class="section-desc">128-bit universally unique identifiers. <code>gen_random_uuid()</code> generates v4 UUIDs natively (PG 13+, no extension needed). Use for external-facing IDs — keep <code>serial</code> for internal references.</p>
					{/snippet}

					{#if data.specimens.length > 0}
						<div class="uuid-list">
							{#each data.specimens as s (s.id)}
								<div class="uuid-item">
									<span class="uuid-label">{s.label}</span>
									<code class="uuid-val">{s.externalId}</code>
								</div>
							{/each}
						</div>
					{/if}
				</Card>
			</section>

			<!-- JSON TYPES -->
			<section id="json">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">JSON Types</h2>
						<p class="section-desc">Always use <code>jsonb</code>. It's parsed binary — indexable with GIN, queryable with <code>@&gt;</code> containment and <code>-&gt;&gt;</code> path extraction. <code>json</code> stores verbatim text (preserving whitespace and duplicate keys).</p>
					{/snippet}

					{#if data.documents.length > 0}
						<div class="json-grid">
							{#each data.documents as doc (doc.id)}
								<div class="json-card">
									<h3 class="json-title">{doc.title}</h3>
									{#if doc.metadata}
										<div class="json-meta">
											<Badge variant="secondary">{doc.metadata.category}</Badge>
											{#each doc.metadata.tags as tag}
												<Badge variant="default">{tag}</Badge>
											{/each}
										</div>
									{/if}
									<pre class="json-pre"><code>{JSON.stringify(doc.metadata, null, 2)}</code></pre>
									{#if doc.settings}
										<details class="json-details">
											<summary>settings (jsonb)</summary>
											<pre class="json-pre"><code>{JSON.stringify(doc.settings, null, 2)}</code></pre>
										</details>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- ARRAYS -->
			<section id="arrays">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Arrays</h2>
						<p class="section-desc">PostgreSQL arrays are powerful for tags, labels, and ordered lists. GIN indexes enable fast <code>@&gt;</code> containment queries. Use junction tables instead when elements need foreign keys.</p>
					{/snippet}

					{#if data.collections.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Name</HeaderCell>
										<HeaderCell><Tooltip content="Variable-length array of 4-byte integers. Supports indexing with GIN for fast @> containment queries." side="bottom"><span class="type-hint">integer[]</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Variable-length array of strings. Great for tags and labels — use a junction table when elements need foreign keys." side="bottom"><span class="type-hint">text[]</span></Tooltip></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.collections as c (c.id)}
										<Row>
											<Cell class="font-medium">{c.name}</Cell>
											<Cell><code>{formatValue(c.scores)}</code></Cell>
											<Cell>
												{#if c.tags && c.tags.length > 0}
													<span class="tag-list">
														{#each c.tags as tag}
															<Badge variant="secondary">{tag}</Badge>
														{/each}
													</span>
												{:else}
													<code>[]</code>
												{/if}
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- RANGES -->
			<section id="ranges">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Range Types</h2>
						<p class="section-desc">One of PostgreSQL's most underappreciated features. A single <code>tstzrange</code> replaces separate start/end columns, with native overlap (<code>&amp;&amp;</code>), containment (<code>@&gt;</code>), and adjacency (<code>-|-</code>) operators. GiST indexes make them fast.</p>
					{/snippet}

					{#if data.bookings.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Resource</HeaderCell>
										<HeaderCell><Tooltip content="Range of integers with inclusive/exclusive bounds [). Supports overlap (&&), containment (@>), and adjacency (-|-) operators." side="bottom"><span class="type-hint">int4range</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Range of timestamptz values. Replaces separate start/end columns with native overlap and containment queries. Use GiST index." side="bottom"><span class="type-hint">tstzrange</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="Range of dates for period-based queries. Same operators as other range types." side="bottom"><span class="type-hint">daterange</span></Tooltip></HeaderCell>
										<HeaderCell>Priority</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.bookings as b (b.id)}
										<Row>
											<Cell class="font-medium">{b.resourceName}</Cell>
											<Cell><code>{formatValue(b.floorRange)}</code></Cell>
											<Cell><code class="text-xs">{formatValue(b.bookingPeriod)}</code></Cell>
											<Cell><code>{formatValue(b.reservationDates)}</code></Cell>
											<Cell>{b.priority}</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- NETWORK -->
			<section id="network">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Network & Geometry Types</h2>
						<p class="section-desc"><code>inet</code> for host addresses, <code>cidr</code> for networks, <code>macaddr</code> for hardware. All support containment operators (<code>&lt;&lt;</code>, <code>&gt;&gt;</code>). <code>point</code> for simple 2D coordinates — use PostGIS for serious GIS work.</p>
					{/snippet}

					{#if data.networks.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Device</HeaderCell>
										<HeaderCell><Tooltip content="IPv4 or IPv6 host address with optional subnet mask. Supports containment operators (<< and >>)." side="bottom"><span class="type-hint">inet</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="IPv4 or IPv6 network address. Unlike inet, always stores the network portion only (host bits zeroed)." side="bottom"><span class="type-hint">cidr</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="6-byte MAC address in colon-separated hex notation. Accepts multiple input formats." side="bottom"><span class="type-hint">macaddr</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="2D geometric point as (x,y). For basic coordinates only — use PostGIS extension for real GIS work." side="bottom"><span class="type-hint">point</span></Tooltip></HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.networks as n (n.id)}
										<Row>
											<Cell class="font-medium">{n.deviceName}</Cell>
											<Cell><code>{n.ipAddress}</code></Cell>
											<Cell><code>{formatValue(n.networkBlock)}</code></Cell>
											<Cell><code>{formatValue(n.macAddress)}</code></Cell>
											<Cell><code>{n.location ? `(${n.location.x}, ${n.location.y})` : 'NULL'}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>

			<!-- ENUMS -->
			<section id="enums">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Enums & Audit Log</h2>
						<p class="section-desc"><code>pgEnum</code> creates real PostgreSQL ENUM types — 4-byte storage, type-safe at DB level. Caveat: adding values requires <code>ALTER TYPE</code>, can't remove without recreation. Use for stable sets only.</p>
					{/snippet}

					{#if data.audits.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell><Tooltip content="bigserial — auto-incrementing 8-byte integer. Like serial but for tables that may exceed 2 billion rows." side="bottom"><span class="type-hint">#</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="pgEnum 'audit_action' — fixed set: create, update, delete, login, export, restore. Type-safe at the DB level, 4-byte storage." side="bottom"><span class="type-hint">Action (enum)</span></Tooltip></HeaderCell>
										<HeaderCell><Tooltip content="pgEnum 'audit_severity' — fixed set: info, warning, error, critical. Adding values requires ALTER TYPE." side="bottom"><span class="type-hint">Severity (enum)</span></Tooltip></HeaderCell>
										<HeaderCell>Description</HeaderCell>
										<HeaderCell>Actor</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.audits as a (a.id)}
										<Row>
											<Cell><code>{a.sequenceNum}</code></Cell>
											<Cell><Badge variant="secondary">{a.action}</Badge></Cell>
											<Cell>
												<Badge variant={
													a.severity === 'error' || a.severity === 'critical' ? 'error' :
													a.severity === 'warning' ? 'warning' : 'default'
												}>{a.severity}</Badge>
											</Cell>
											<Cell>{a.description}</Cell>
											<Cell><code>{a.actorId}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No data. Run the seed script.</p>
					{/if}
				</Card>
			</section>
		</div>
	{/if}

	<!-- Reset button -->
	<div class="reset-section">
		<Button variant="outline" size="sm" onclick={() => resetDialogOpen = true}>
			<span class="i-lucide-rotate-ccw h-4 w-4 mr-1" />
			Reset to Seed Data
		</Button>
		<span class="reset-hint">Types are read-only. See <a href="/showcases/db/postgres/mutability">Mutability</a> for live write operations.</span>
	</div>

	<BackLink href="/showcases/db/postgres" label="PostgreSQL" />
</div>

<ConfirmDialog
	bind:open={resetDialogOpen}
	title="Reset Showcase Data"
	description="This will truncate all showcase tables and re-insert the original seed data."
	confirmLabel="Reset"
	destructive
	onconfirm={() => {
		resetDialogOpen = false;
		const form = document.getElementById('reseed-form') as HTMLFormElement;
		form?.requestSubmit();
	}}
	oncancel={() => resetDialogOpen = false}
/>

<form
	id="reseed-form"
	method="POST"
	action="?/reseed"
	style="display:none"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.success('Showcase data reset.');
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Failed to reset.');
			}
			return update();
		};
	}}
>
</form>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.section-desc {
		margin: var(--spacing-1) 0 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.empty {
		color: var(--color-muted);
		font-style: italic;
	}

	.error-msg {
		font-family: ui-monospace, monospace;
		color: var(--color-error);
		word-break: break-all;
	}

	.error-hint {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		margin-top: var(--spacing-2);
	}

	/* Boolean grid */
	.bool-grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
	}

	.bool-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
	}

	.bool-label {
		font-weight: 500;
	}

	/* UUID list */
	.uuid-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.uuid-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.uuid-item:nth-child(odd) {
		background: var(--color-subtle);
	}

	.uuid-label {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
	}

	.uuid-val {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* JSON grid */
	.json-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: var(--spacing-4);
	}

	.json-card {
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.json-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0 0 var(--spacing-2);
	}

	.json-meta {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
		margin-bottom: var(--spacing-3);
	}

	.json-pre {
		margin: 0;
		overflow-x: auto;
	}

	.json-pre code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		line-height: 1.5;
		white-space: pre;
	}

	.json-details {
		margin-top: var(--spacing-2);
	}

	.json-details summary {
		cursor: pointer;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-weight: 500;
	}

	/* Tag list */
	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	/* Dashed underline to hint that column headers have tooltips */
	.type-hint {
		text-decoration: underline;
		text-decoration-style: dashed;
		text-underline-offset: 3px;
		text-decoration-color: var(--color-muted);
		cursor: help;
	}

	.reset-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		margin-top: var(--spacing-6);
		margin-bottom: var(--spacing-4);
	}

	.reset-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.reset-hint a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}
	}
</style>
