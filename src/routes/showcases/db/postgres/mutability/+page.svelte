<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { PageHeader, BackLink, Card, SectionNav, ConfirmDialog } from '$lib/components/composites';
	import { Badge, Button, Input, Select, Spinner } from '$lib/components/primitives';
	import { Table, Header, Body, Row, HeaderCell, Cell } from '$lib/components/primitives';
	import { Dialog } from '$lib/components/primitives';
	import { getToast } from '$lib/stores/toast.svelte';

	let { data } = $props();
	const toast = getToast();

	const sections = [
		{ id: 'mutable', label: 'Mutable CRUD' },
		{ id: 'versioned', label: 'Versioned' },
		{ id: 'soft-delete', label: 'Soft Delete' },
		{ id: 'append-only', label: 'Append-Only' },
		{ id: 'temporal', label: 'Temporal' },
	];

	// ─── CRUD state ──────────────────────────────────────────
	let showCreateForm = $state(false);
	let editingSpecimen = $state<typeof data.mutableRows[0] | null>(null);
	let editDialogOpen = $state(false);

	// ─── Versioned state ─────────────────────────────────────
	let editingVersioned = $state<typeof data.mutableRows[0] | null>(null);
	let versionedDialogOpen = $state(false);

	// ─── Reset state ─────────────────────────────────────────
	let resetDialogOpen = $state(false);

	// ─── Temporal query state ────────────────────────────────
	let temporalQueryDate = $state('');
	let temporalResults = $state<typeof data.temporalRows>([]);
	let temporalQueryActive = $state(false);

	// ─── Action result handling ──────────────────────────────
	const actionResult = $derived(page.form);

	// ─── Shared ──────────────────────────────────────────────
	function formatTs(val: unknown): string {
		if (!val) return '—';
		const d = new Date(String(val));
		return d.toLocaleString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric',
			hour: '2-digit', minute: '2-digit', second: '2-digit',
		});
	}

	function handleActionResult(opts: { successMsg?: string } = {}) {
		return ({ result, update }: { result: any; update: (opts?: any) => Promise<void> }) => {
			if (result.type === 'success') {
				const msg = result.data?.message || opts.successMsg || 'Done.';
				toast.success(msg);
			} else if (result.type === 'failure') {
				toast.error(result.data?.message || 'Operation failed.');
			}
			return update();
		};
	}

	const actionOptions = [
		{ value: 'create', label: 'create' },
		{ value: 'update', label: 'update' },
		{ value: 'delete', label: 'delete' },
		{ value: 'restore', label: 'restore' },
		{ value: 'export', label: 'export' },
		{ value: 'import', label: 'import' },
		{ value: 'login', label: 'login' },
		{ value: 'logout', label: 'logout' },
	];

	const severityOptions = [
		{ value: 'debug', label: 'debug' },
		{ value: 'info', label: 'info' },
		{ value: 'warning', label: 'warning' },
		{ value: 'error', label: 'error' },
		{ value: 'critical', label: 'critical' },
	];

	// Append-only form state
	let appendAction = $state('create');
	let appendSeverity = $state('info');
</script>

<svelte:head>
	<title>Mutability - PostgreSQL - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Mutability Patterns"
		description="Five data mutability strategies — now interactive. Loaded in {data.queryMs}ms."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'PostgreSQL', href: '/showcases/db/postgres' },
			{ label: 'Mutability' }
		]}
	/>

	{#if data.error}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Database Error</h2>
			{/snippet}
			<code class="error-msg">{data.error}</code>
			<p class="error-hint">Run <code>db:push</code> and <code>db:seed</code> to initialize the showcase schema.</p>
		</Card>
	{:else}
		<SectionNav {sections} ariaLabel="Mutability patterns" />

		<!-- Action result alert -->
		{#if actionResult?.message && !actionResult?.success}
			<div class="error-alert" role="alert" aria-live="assertive">
				<span class="i-lucide-alert-circle h-4 w-4" />
				<code>{actionResult.message}</code>
			</div>
		{/if}

		<div class="sections">
			<!-- ═══ MUTABLE CRUD ═══ -->
			<section id="mutable">
				<Card>
					{#snippet header()}
						<div class="section-header">
							<div>
								<h2 class="text-fluid-lg font-semibold">Mutable CRUD</h2>
								<p class="section-desc">Rows are created, read, updated, and deleted. <code>updated_at</code> tracks last modification. Try creating, editing, and deleting rows below.</p>
							</div>
							<Button variant="primary" size="sm" onclick={() => showCreateForm = !showCreateForm}>
								<span class="i-lucide-plus h-4 w-4 mr-1" />
								Add Row
							</Button>
						</div>
					{/snippet}

					<!-- Create form -->
					{#if showCreateForm}
						<form
							method="POST"
							action="?/createSpecimen"
							class="create-form"
							use:enhance={() => {
								return async ({ result, update }) => {
									if (result.type === 'success') {
										showCreateForm = false;
										toast.success('Specimen created.');
									} else if (result.type === 'failure') {
										toast.error(result.data?.message || 'Failed to create.');
									}
									return update();
								};
							}}
						>
							<Input name="label" placeholder="Label" required />
							<Input name="code" placeholder="Code (max 10)" maxlength={10} required />
							<Input name="rating" type="number" placeholder="Rating (1-5)" min={1} max={5} />
							<Input name="quantity" type="number" placeholder="Quantity" min={0} />
							<div class="form-actions">
								<Button type="submit" variant="primary" size="sm">Insert</Button>
								<Button type="button" variant="ghost" size="sm" onclick={() => showCreateForm = false}>Cancel</Button>
							</div>
						</form>
					{/if}

					{#if data.mutableRows.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Label</HeaderCell>
										<HeaderCell>Code</HeaderCell>
										<HeaderCell>Active</HeaderCell>
										<HeaderCell>Created</HeaderCell>
										<HeaderCell>Updated</HeaderCell>
										<HeaderCell>Actions</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.mutableRows as r (r.id)}
										<Row>
											<Cell class="font-medium">{r.label}</Cell>
											<Cell><Badge variant="secondary">{r.code}</Badge></Cell>
											<Cell>
												<Badge variant={r.isActive ? 'success' : 'error'}>
													{r.isActive ? 'Active' : 'Inactive'}
												</Badge>
											</Cell>
											<Cell><code class="ts">{formatTs(r.createdAt)}</code></Cell>
											<Cell><code class="ts">{formatTs(r.updatedAt)}</code></Cell>
											<Cell>
												<div class="row-actions">
													<Button
														variant="ghost"
														size="sm"
														onclick={() => { editingSpecimen = r; editDialogOpen = true; }}
														aria-label="Edit {r.label}"
													>
														<span class="i-lucide-pencil h-3.5 w-3.5" />
													</Button>
													<form
														method="POST"
														action="?/deleteSpecimen"
														use:enhance={() => handleActionResult({ successMsg: 'Specimen deleted.' })}
													>
														<input type="hidden" name="id" value={r.id} />
														<Button type="submit" variant="ghost" size="sm" aria-label="Delete {r.label}">
															<span class="i-lucide-trash-2 h-3.5 w-3.5 text-error" />
														</Button>
													</form>
												</div>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No specimens. Create one above.</p>
					{/if}
				</Card>
			</section>

			<!-- ═══ VERSIONED RECORDS ═══ -->
			<section id="versioned">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Versioned Records</h2>
						<p class="section-desc">Every update inserts a snapshot into the history table. Edit a specimen below and watch the history grow.</p>
					{/snippet}

					{#if data.mutableRows.length > 0}
						<h3 class="sub-heading">Current Specimens</h3>
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Label</HeaderCell>
										<HeaderCell>Rating</HeaderCell>
										<HeaderCell>Quantity</HeaderCell>
										<HeaderCell>Active</HeaderCell>
										<HeaderCell>Action</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.mutableRows as r (r.id)}
										<Row>
											<Cell class="font-medium">{r.label}</Cell>
											<Cell>{r.rating ?? '—'}</Cell>
											<Cell>{r.quantity}</Cell>
											<Cell>
												<Badge variant={r.isActive ? 'success' : 'error'}>
													{r.isActive ? 'Active' : 'Inactive'}
												</Badge>
											</Cell>
											<Cell>
												<Button
													variant="outline"
													size="sm"
													onclick={() => { editingVersioned = r; versionedDialogOpen = true; }}
												>
													<span class="i-lucide-history h-3.5 w-3.5 mr-1" />
													Edit + Version
												</Button>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{/if}

					{#if data.versionHistory.length > 0}
						<h3 class="sub-heading">Version History</h3>
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Specimen</HeaderCell>
										<HeaderCell>Version</HeaderCell>
										<HeaderCell>Change</HeaderCell>
										<HeaderCell>Label</HeaderCell>
										<HeaderCell>Rating</HeaderCell>
										<HeaderCell>Changed By</HeaderCell>
										<HeaderCell>Changed At</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.versionHistory as h (h.historyId)}
										<Row>
											<Cell><code>{h.specimenId}</code></Cell>
											<Cell><Badge variant="default">v{h.version}</Badge></Cell>
											<Cell>
												<Badge variant={
													h.changeType === 'create' ? 'success' :
													h.changeType === 'delete' ? 'error' : 'warning'
												}>{h.changeType}</Badge>
											</Cell>
											<Cell>{h.label}</Cell>
											<Cell>{h.rating ?? '—'}</Cell>
											<Cell><code>{h.changedBy}</code></Cell>
											<Cell><code class="ts">{formatTs(h.changedAt)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No version history yet. Edit a specimen to create history entries.</p>
					{/if}
				</Card>
			</section>

			<!-- ═══ SOFT DELETE ═══ -->
			<section id="soft-delete">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Soft Delete</h2>
						<p class="section-desc"><code>deleted_at IS NULL</code> = active. Non-NULL = soft-deleted (recoverable). Click delete to move a document right. Click restore to move it back.</p>
					{/snippet}

					<div class="soft-delete-groups">
						<div>
							<h3 class="group-heading">
								Active Documents
								<Badge variant="success">{data.activeDocuments.length}</Badge>
							</h3>
							{#each data.activeDocuments as doc (doc.id)}
								<div class="soft-item active">
									<span>{doc.title}</span>
									<form
										method="POST"
										action="?/softDelete"
										use:enhance={() => handleActionResult({ successMsg: 'Document soft-deleted.' })}
									>
										<input type="hidden" name="id" value={doc.id} />
										<Button type="submit" variant="ghost" size="sm" aria-label="Soft-delete {doc.title}">
											<span class="i-lucide-trash-2 h-3.5 w-3.5 text-error" />
										</Button>
									</form>
								</div>
							{/each}
							{#if data.activeDocuments.length === 0}
								<p class="empty">No active documents.</p>
							{/if}
						</div>

						<div>
							<h3 class="group-heading">
								Soft-Deleted
								<Badge variant="error">{data.deletedDocuments.length}</Badge>
							</h3>
							{#each data.deletedDocuments as doc (doc.id)}
								<div class="soft-item deleted">
									<span class="strikethrough">{doc.title}</span>
									<form
										method="POST"
										action="?/restore"
										use:enhance={() => handleActionResult({ successMsg: 'Document restored.' })}
									>
										<input type="hidden" name="id" value={doc.id} />
										<Button type="submit" variant="ghost" size="sm" aria-label="Restore {doc.title}">
											<span class="i-lucide-undo-2 h-3.5 w-3.5 text-success" />
										</Button>
									</form>
								</div>
							{/each}
							{#if data.deletedDocuments.length === 0}
								<p class="empty">No deleted documents.</p>
							{/if}
						</div>
					</div>

					<div class="pattern-note">
						<h3>Query Patterns</h3>
						<pre><code>-- Active only (most common):
WHERE deleted_at IS NULL

-- Soft delete:
UPDATE SET deleted_at = now() WHERE id = $1

-- Restore:
UPDATE SET deleted_at = NULL WHERE id = $1</code></pre>
					</div>
				</Card>
			</section>

			<!-- ═══ APPEND-ONLY ═══ -->
			<section id="append-only">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Append-Only / Immutable</h2>
						<p class="section-desc">Records are inserted and never modified. There is no Edit button. There is no Delete button. This is intentional.</p>
					{/snippet}

					{#if data.appendLog.length > 0}
						<h3 class="sub-heading">Audit Log</h3>
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Seq</HeaderCell>
										<HeaderCell>Action</HeaderCell>
										<HeaderCell>Severity</HeaderCell>
										<HeaderCell>Description</HeaderCell>
										<HeaderCell>Occurred</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.appendLog as a (a.id)}
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
											<Cell><code class="ts">{formatTs(a.occurredAt)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{/if}

					<!-- Always-visible append form -->
					<div class="append-form-section">
						<h3 class="sub-heading">Add Entry</h3>
						<form
							method="POST"
							action="?/appendAuditEntry"
							class="append-form"
							use:enhance={() => handleActionResult({ successMsg: 'Audit entry appended.' })}
						>
							<div class="append-form-fields">
								<div class="append-field">
									<label for="append-description" class="field-label">Description</label>
									<Input id="append-description" name="description" placeholder="What happened?" required />
								</div>
								<div class="append-field">
									<label for="append-action" class="field-label">Action</label>
									<input type="hidden" name="action" value={appendAction} />
									<Select options={actionOptions} bind:value={appendAction} />
								</div>
								<div class="append-field">
									<label for="append-severity" class="field-label">Severity</label>
									<input type="hidden" name="severity" value={appendSeverity} />
									<Select options={severityOptions} bind:value={appendSeverity} />
								</div>
							</div>
							<Button type="submit" variant="primary" size="sm">
								<span class="i-lucide-plus h-4 w-4 mr-1" />
								Append
							</Button>
						</form>
						<p class="append-note">There is no Edit button. There is no Delete button. This is intentional.</p>
					</div>
				</Card>
			</section>

			<!-- ═══ TEMPORAL ═══ -->
			<section id="temporal">
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-lg font-semibold">Temporal / Bi-temporal</h2>
						<p class="section-desc"><code>valid_from</code> / <code>valid_to</code> track when a fact is true in the real world. Use the date picker to query "what was valid on date X?"</p>
					{/snippet}

					{#if data.temporalRows.length > 0}
						<h3 class="sub-heading">All Temporal Records</h3>
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>Description</HeaderCell>
										<HeaderCell>Valid From</HeaderCell>
										<HeaderCell>Valid To</HeaderCell>
										<HeaderCell>Recorded At</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.temporalRows as t (t.id)}
										<Row>
											<Cell class="font-medium">{t.description}</Cell>
											<Cell><code class="ts">{formatTs(t.validFrom)}</code></Cell>
											<Cell>
												{#if t.validTo}
													<code class="ts">{formatTs(t.validTo)}</code>
												{:else}
													<Badge variant="success">Current</Badge>
												{/if}
											</Cell>
											<Cell><code class="ts">{formatTs(t.recordedAt)}</code></Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<p class="empty">No temporal records. Add one below.</p>
					{/if}

					<!-- Temporal query -->
					<div class="temporal-query">
						<h3 class="sub-heading">Query: "What was valid on...?"</h3>
						<form
							method="POST"
							action="?/temporalQuery"
							class="temporal-query-form"
							use:enhance={() => {
								temporalQueryActive = true;
								return async ({ result, update }) => {
									if (result.type === 'success' && result.data?.temporalResults) {
										temporalResults = result.data.temporalResults;
										temporalQueryDate = result.data.queryDate;
									} else if (result.type === 'failure') {
										toast.error(result.data?.message || 'Query failed.');
									}
									temporalQueryActive = false;
									// Don't call update() — we don't want to invalidate, we keep the query results in local state
								};
							}}
						>
							<Input name="date" type="date" required />
							<Button type="submit" variant="outline" size="sm" disabled={temporalQueryActive}>
								<span class="i-lucide-search h-4 w-4 mr-1" />
								Query
							</Button>
						</form>

						{#if temporalQueryDate && temporalResults.length > 0}
							<div class="temporal-results">
								<h4 class="sub-heading">Records valid on {temporalQueryDate}</h4>
								<div class="table-wrap">
									<Table>
										<Header>
											<Row>
												<HeaderCell>Description</HeaderCell>
												<HeaderCell>Valid From</HeaderCell>
												<HeaderCell>Valid To</HeaderCell>
											</Row>
										</Header>
										<Body>
											{#each temporalResults as t (t.id)}
												<Row>
													<Cell class="font-medium">{t.description}</Cell>
													<Cell><code class="ts">{formatTs(t.validFrom)}</code></Cell>
													<Cell>
														{#if t.validTo}
															<code class="ts">{formatTs(t.validTo)}</code>
														{:else}
															<Badge variant="success">Current</Badge>
														{/if}
													</Cell>
												</Row>
											{/each}
										</Body>
									</Table>
								</div>
							</div>
						{:else if temporalQueryDate && temporalResults.length === 0}
							<p class="empty">No records valid on {temporalQueryDate}.</p>
						{/if}
					</div>

					<!-- Add temporal record -->
					<div class="temporal-add">
						<h3 class="sub-heading">Add Temporal Record</h3>
						<form
							method="POST"
							action="?/addTemporalRecord"
							class="temporal-add-form"
							use:enhance={() => handleActionResult({ successMsg: 'Temporal record added.' })}
						>
							<div class="temporal-add-fields">
								<div class="append-field">
									<label for="temp-desc" class="field-label">Description</label>
									<Input id="temp-desc" name="description" placeholder="What fact is this?" required />
								</div>
								<div class="append-field">
									<label for="temp-from" class="field-label">Valid From</label>
									<Input id="temp-from" name="validFrom" type="datetime-local" required />
								</div>
								<div class="append-field">
									<label for="temp-to" class="field-label">Valid To (optional)</label>
									<Input id="temp-to" name="validTo" type="datetime-local" />
								</div>
							</div>
							<Button type="submit" variant="primary" size="sm">
								<span class="i-lucide-plus h-4 w-4 mr-1" />
								Add Record
							</Button>
						</form>
					</div>
				</Card>
			</section>
		</div>

		<!-- Reset button -->
		<div class="reset-section">
			<Button variant="outline" size="sm" onclick={() => resetDialogOpen = true}>
				<span class="i-lucide-rotate-ccw h-4 w-4 mr-1" />
				Reset All Showcase Data
			</Button>
		</div>
	{/if}

	<BackLink href="/showcases/db/postgres" label="PostgreSQL" />
</div>

<!-- ═══ DIALOGS ═══ -->

<!-- Edit Specimen Dialog (CRUD) -->
{#if editingSpecimen}
	<Dialog bind:open={editDialogOpen} title="Edit Specimen" description="Update {editingSpecimen.label}">
		<form
			method="POST"
			action="?/updateSpecimen"
			class="dialog-form"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						editDialogOpen = false;
						editingSpecimen = null;
						toast.success('Specimen updated.');
					} else if (result.type === 'failure') {
						toast.error(result.data?.message || 'Failed to update.');
					}
					return update();
				};
			}}
		>
			<input type="hidden" name="id" value={editingSpecimen.id} />
			<div class="dialog-fields">
				<div class="append-field">
					<label for="edit-label" class="field-label">Label</label>
					<Input id="edit-label" name="label" value={editingSpecimen.label} />
				</div>
				<div class="append-field">
					<label for="edit-rating" class="field-label">Rating (1-5)</label>
					<Input id="edit-rating" name="rating" type="number" min={1} max={5} value={String(editingSpecimen.rating ?? '')} />
				</div>
				<div class="append-field">
					<label for="edit-quantity" class="field-label">Quantity</label>
					<Input id="edit-quantity" name="quantity" type="number" min={0} value={String(editingSpecimen.quantity)} />
				</div>
				<div class="append-field">
					<label for="edit-active" class="field-label">Active</label>
					<input type="hidden" name="isActive" value={editingSpecimen.isActive ? 'true' : 'false'} />
					<label class="toggle-label">
						<input
							type="checkbox"
							checked={editingSpecimen.isActive}
							onchange={(e) => {
								if (editingSpecimen) {
									editingSpecimen = { ...editingSpecimen, isActive: e.currentTarget.checked };
								}
							}}
						/>
						{editingSpecimen.isActive ? 'Active' : 'Inactive'}
					</label>
				</div>
			</div>
			<div class="dialog-actions">
				<Button type="button" variant="ghost" size="sm" onclick={() => { editDialogOpen = false; editingSpecimen = null; }}>Cancel</Button>
				<Button type="submit" variant="primary" size="sm">Save</Button>
			</div>
		</form>
	</Dialog>
{/if}

<!-- Edit Specimen Dialog (Versioned) -->
{#if editingVersioned}
	<Dialog bind:open={versionedDialogOpen} title="Edit + Create Version" description="This will update the specimen AND create a history snapshot.">
		<form
			method="POST"
			action="?/updateWithHistory"
			class="dialog-form"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'success') {
						versionedDialogOpen = false;
						editingVersioned = null;
						toast.success(result.data?.message || 'Version created.');
					} else if (result.type === 'failure') {
						toast.error(result.data?.message || 'Failed to update.');
					}
					return update();
				};
			}}
		>
			<input type="hidden" name="id" value={editingVersioned.id} />
			<div class="dialog-fields">
				<div class="append-field">
					<label for="ver-label" class="field-label">Label</label>
					<Input id="ver-label" name="label" value={editingVersioned.label} />
				</div>
				<div class="append-field">
					<label for="ver-rating" class="field-label">Rating (1-5)</label>
					<Input id="ver-rating" name="rating" type="number" min={1} max={5} value={String(editingVersioned.rating ?? '')} />
				</div>
				<div class="append-field">
					<label for="ver-quantity" class="field-label">Quantity</label>
					<Input id="ver-quantity" name="quantity" type="number" min={0} value={String(editingVersioned.quantity)} />
				</div>
				<div class="append-field">
					<label for="ver-active" class="field-label">Active</label>
					<input type="hidden" name="isActive" value={editingVersioned.isActive ? 'true' : 'false'} />
					<label class="toggle-label">
						<input
							type="checkbox"
							checked={editingVersioned.isActive}
							onchange={(e) => {
								if (editingVersioned) {
									editingVersioned = { ...editingVersioned, isActive: e.currentTarget.checked };
								}
							}}
						/>
						{editingVersioned.isActive ? 'Active' : 'Inactive'}
					</label>
				</div>
			</div>
			<div class="dialog-actions">
				<Button type="button" variant="ghost" size="sm" onclick={() => { versionedDialogOpen = false; editingVersioned = null; }}>Cancel</Button>
				<Button type="submit" variant="primary" size="sm">
					<span class="i-lucide-history h-3.5 w-3.5 mr-1" />
					Save + Version
				</Button>
			</div>
		</form>
	</Dialog>
{/if}

<!-- Reset Confirm Dialog -->
<ConfirmDialog
	bind:open={resetDialogOpen}
	title="Reset Showcase Data"
	description="This will truncate all showcase tables and re-insert the original seed data. This cannot be undone."
	confirmLabel="Reset"
	destructive
	onconfirm={() => {
		resetDialogOpen = false;
		// Submit the hidden reseed form
		const form = document.getElementById('reseed-form') as HTMLFormElement;
		form?.requestSubmit();
	}}
	oncancel={() => resetDialogOpen = false}
/>

<form
	id="reseed-form"
	method="POST"
	action="?/reseed"
	class="hidden"
	use:enhance={() => handleActionResult({ successMsg: 'Showcase data reset.' })}
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
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

	.error-alert {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-4);
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.ts {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.sub-heading {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: var(--spacing-5) 0 var(--spacing-3);
	}

	.sub-heading:first-of-type {
		margin-top: 0;
	}

	/* ─── Create form ─── */
	.create-form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-4);
		align-items: flex-end;
	}

	.create-form :global(input) {
		flex: 1;
		min-width: 120px;
	}

	.form-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	/* ─── Row actions ─── */
	.row-actions {
		display: flex;
		gap: var(--spacing-1);
	}

	/* ─── Pattern notes ─── */
	.pattern-note {
		margin-top: var(--spacing-5);
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.pattern-note h3 {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0 0 var(--spacing-2);
	}

	.pattern-note pre {
		margin: 0;
		overflow-x: auto;
	}

	.pattern-note pre code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		white-space: pre;
	}

	/* ─── Soft delete ─── */
	.soft-delete-groups {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-6);
	}

	.group-heading {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0 0 var(--spacing-3);
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.soft-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-sm);
		margin-bottom: var(--spacing-1);
	}

	.soft-item.active {
		background: color-mix(in srgb, var(--color-success) 5%, transparent);
	}

	.soft-item.deleted {
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
	}

	.strikethrough {
		text-decoration: line-through;
		color: var(--color-muted);
	}

	/* ─── Append-only form ─── */
	.append-form-section {
		margin-top: var(--spacing-5);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.append-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.append-form-fields {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: var(--spacing-3);
	}

	.append-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.field-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
	}

	.append-note {
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-style: italic;
	}

	/* ─── Temporal ─── */
	.temporal-query {
		margin-top: var(--spacing-5);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.temporal-query-form {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-end;
	}

	.temporal-results {
		margin-top: var(--spacing-4);
	}

	.temporal-add {
		margin-top: var(--spacing-5);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	.temporal-add-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.temporal-add-fields {
		display: grid;
		grid-template-columns: 2fr 1fr 1fr;
		gap: var(--spacing-3);
	}

	/* ─── Dialog form ─── */
	.dialog-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.dialog-fields {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-2);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	/* ─── Reset ─── */
	.reset-section {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-6);
		margin-bottom: var(--spacing-4);
	}

	.hidden {
		display: none;
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}

		.soft-delete-groups {
			grid-template-columns: 1fr;
		}

		.append-form-fields,
		.temporal-add-fields {
			grid-template-columns: 1fr;
		}

		.section-header {
			flex-direction: column;
		}
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}
</style>
