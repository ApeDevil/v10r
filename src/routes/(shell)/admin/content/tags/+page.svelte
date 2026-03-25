<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { BlogTag } from '$lib/components/blog';
	import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
	import { Cluster, Stack } from '$lib/components/layout';
	import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
	import { getToast } from '$lib/state/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const toast = getToast();

	let submitting = $state('');

	// Tag editing modal
	let showTagModal = $state(false);
	let editTagId = $state('');
	let editTagName = $state('');
	let editTagSlug = $state('');
	let editTagIcon = $state<string | null>(null);
	let editTagColor = $state<number | null>(null);
	let editTagGlyph = $state('');
	let tagIconFilter = $state('');

	let showDeleteDialog = $state(false);
	let deleteTagId = $state('');
	let deleteTagName = $state('');
	let deletePostCount = $state(0);

	// Domain editing modal
	let showDomainModal = $state(false);
	let editDomainId = $state('');
	let editDomainName = $state('');
	let editDomainSlug = $state('');
	let editDomainIcon = $state<string | null>(null);
	let editDomainColor = $state<number | null>(null);
	let editDomainDescription = $state('');
	let iconFilter = $state('');

	let showDeleteDomainDialog = $state(false);
	let deleteDomainId = $state('');
	let deleteDomainName = $state('');
	let deleteDomainPostCount = $state(0);

	const ICON_OPTIONS = [
		{ name: 'code', class: 'i-lucide-code' },
		{ name: 'terminal', class: 'i-lucide-terminal' },
		{ name: 'palette', class: 'i-lucide-palette' },
		{ name: 'brain', class: 'i-lucide-brain' },
		{ name: 'box', class: 'i-lucide-box' },
		{ name: 'users', class: 'i-lucide-users' },
		{ name: 'globe', class: 'i-lucide-globe' },
		{ name: 'layers', class: 'i-lucide-layers' },
		{ name: 'zap', class: 'i-lucide-zap' },
		{ name: 'database', class: 'i-lucide-database' },
		{ name: 'book', class: 'i-lucide-book-open' },
		{ name: 'microscope', class: 'i-lucide-microscope' },
		{ name: 'cloud', class: 'i-lucide-cloud' },
		{ name: 'rocket', class: 'i-lucide-rocket' },
		{ name: 'shield', class: 'i-lucide-shield' },
		{ name: 'briefcase', class: 'i-lucide-briefcase' },
		{ name: 'heart', class: 'i-lucide-heart' },
		{ name: 'camera', class: 'i-lucide-camera' },
		{ name: 'music', class: 'i-lucide-music' },
		{ name: 'pen-tool', class: 'i-lucide-pen-tool' },
		{ name: 'cpu', class: 'i-lucide-cpu' },
		{ name: 'wifi', class: 'i-lucide-wifi' },
		{ name: 'key', class: 'i-lucide-key' },
		{ name: 'flag', class: 'i-lucide-flag' },
		{ name: 'compass', class: 'i-lucide-compass' },
		{ name: 'lightbulb', class: 'i-lucide-lightbulb' },
		{ name: 'sparkles', class: 'i-lucide-sparkles' },
		{ name: 'flame', class: 'i-lucide-flame' },
		{ name: 'gem', class: 'i-lucide-gem' },
		{ name: 'trophy', class: 'i-lucide-trophy' },
		{ name: 'container', class: 'i-lucide-container' },
		{ name: 'server', class: 'i-lucide-server' },
		{ name: 'puzzle', class: 'i-lucide-puzzle' },
		{ name: 'wrench', class: 'i-lucide-wrench' },
		{ name: 'megaphone', class: 'i-lucide-megaphone' },
		{ name: 'beaker', class: 'i-lucide-flask-conical' },
	];

	const COLOR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

	const filteredIcons = $derived(
		iconFilter
			? ICON_OPTIONS.filter((i) => i.name.includes(iconFilter.toLowerCase()))
			: ICON_OPTIONS,
	);

	const previewTag = $derived({
		slug: editDomainSlug || 'preview',
		name: editDomainName || 'Domain',
		icon: editDomainIcon,
		color: editDomainColor,
	});

	const filteredTagIcons = $derived(
		tagIconFilter
			? ICON_OPTIONS.filter((i) => i.name.includes(tagIconFilter.toLowerCase()))
			: ICON_OPTIONS,
	);

	const previewCategoryTag = $derived({
		slug: editTagSlug || 'preview',
		name: editTagName || 'Category',
		icon: editTagIcon,
		color: editTagColor,
		glyph: editTagGlyph || null,
	});

	function openTagModal(t?: { id: string; name: string; slug: string; icon: string | null; color: number | null; glyph: string | null }) {
		if (t) {
			editTagId = t.id;
			editTagName = t.name;
			editTagSlug = t.slug;
			editTagIcon = t.icon;
			editTagColor = t.color;
			editTagGlyph = t.glyph ?? '';
		} else {
			editTagId = '';
			editTagName = '';
			editTagSlug = '';
			editTagIcon = null;
			editTagColor = null;
			editTagGlyph = '';
		}
		tagIconFilter = '';
		showTagModal = true;
	}

	function closeTagModal() {
		showTagModal = false;
		editTagId = '';
	}

	function openDeleteDialog(tag: { id: string; name: string; postCount: number }) {
		deleteTagId = tag.id;
		deleteTagName = tag.name;
		deletePostCount = tag.postCount;
		showDeleteDialog = true;
	}

	function submitDeleteForm() {
		showDeleteDialog = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'tagId';
		input.value = deleteTagId;
		form.appendChild(input);
		form.action = '?/delete';
		document.body.appendChild(form);
		form.submit();
	}

	function openDomainModal(d?: { id: string; name: string; slug: string; icon: string | null; color: number | null; description: string | null }) {
		if (d) {
			editDomainId = d.id;
			editDomainName = d.name;
			editDomainSlug = d.slug;
			editDomainIcon = d.icon;
			editDomainColor = d.color;
			editDomainDescription = d.description ?? '';
		} else {
			editDomainId = '';
			editDomainName = '';
			editDomainSlug = '';
			editDomainIcon = null;
			editDomainColor = null;
			editDomainDescription = '';
		}
		iconFilter = '';
		showDomainModal = true;
	}

	function closeDomainModal() {
		showDomainModal = false;
		editDomainId = '';
	}

	function openDeleteDomainDialog(d: { id: string; name: string; postCount: number }) {
		deleteDomainId = d.id;
		deleteDomainName = d.name;
		deleteDomainPostCount = d.postCount;
		showDeleteDomainDialog = true;
	}

	function submitDeleteDomainForm() {
		showDeleteDomainDialog = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'domainId';
		input.value = deleteDomainId;
		form.appendChild(input);
		form.action = '?/deleteDomain';
		document.body.appendChild(form);
		form.submit();
	}
</script>

<svelte:head>
	<title>Tags & Domains - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Domain Management -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Domain Management</h2>
				<Cluster gap="2">
					<Button variant="outline" size="sm" onclick={() => openDomainModal()}>
						<span class="i-lucide-plus h-4 w-4 mr-1"></span>
						New Domain
					</Button>
					<Button variant="ghost" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						Refresh
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		{#if data.domains.length === 0}
			<EmptyState
				icon="i-lucide-folder"
				title="No domains yet"
				description="Create a domain to organize blog posts by subject area."
			/>
		{:else}
			<div class="table-wrap">
				<table class="tag-table">
					<thead>
						<tr>
							<th>Icon</th>
							<th>Name</th>
							<th>Slug</th>
							<th>Color</th>
							<th>Posts</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.domains as d}
							<tr>
								<td>
									{#if d.icon}
										<span class="{d.icon} h-4 w-4 inline-block"></span>
									{:else}
										<span class="letter-icon">{d.name.charAt(0).toUpperCase()}</span>
									{/if}
								</td>
								<td>{d.name}</td>
								<td><code class="slug-code">{d.slug}</code></td>
								<td>
									{#if d.color}
										<span class="color-dot" style="background: var(--chart-{d.color})"></span>
									{:else}
										<span class="text-muted">—</span>
									{/if}
								</td>
								<td><Badge variant="secondary">{d.postCount}</Badge></td>
								<td>
									<Cluster gap="1">
										<Button variant="outline" size="sm" onclick={() => openDomainModal(d)}>Edit</Button>
										<Button variant="ghost" size="sm" onclick={() => openDeleteDomainDialog(d)}>Delete</Button>
									</Cluster>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>

	<!-- Category Management -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Category Management</h2>
				<Cluster gap="2">
					<Button variant="outline" size="sm" onclick={() => openTagModal()}>
						<span class="i-lucide-plus h-4 w-4 mr-1"></span>
						New Category
					</Button>
					<Button variant="ghost" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						Refresh
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		{#if data.tags.length === 0}
			<EmptyState
				icon="i-lucide-tag"
				title="No tags yet"
				description="Create a tag to organize your blog posts."
			/>
		{:else}
			<div class="table-wrap">
				<table class="tag-table">
					<thead>
						<tr>
							<th>Visual</th>
							<th>Name</th>
							<th>Slug</th>
							<th>Posts</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.tags as t}
							<tr>
								<td>
									{#if t.icon}
										<span class="{t.icon} h-4 w-4 inline-block"></span>
									{:else if t.glyph}
										<span class="glyph-icon">{t.glyph}</span>
									{:else}
										<span class="letter-icon">{t.name.charAt(0).toUpperCase()}</span>
									{/if}
								</td>
								<td>{t.name}</td>
								<td><code class="slug-code">{t.slug}</code></td>
								<td><Badge variant="secondary">{t.postCount}</Badge></td>
								<td>
									<Cluster gap="1">
										<Button variant="outline" size="sm" onclick={() => openTagModal(t)}>Edit</Button>
										<Button variant="ghost" size="sm" onclick={() => openDeleteDialog(t)}>Delete</Button>
									</Cluster>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</Stack>

<!-- Domain Edit/Create Modal -->
{#if showDomainModal}
	<div class="modal-overlay" role="presentation" onclick={closeDomainModal}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="domain-modal-title">
			<h2 id="domain-modal-title" class="text-fluid-lg font-semibold mb-4">
				{editDomainId ? 'Edit Domain' : 'Create Domain'}
			</h2>

			<form
				method="POST"
				action={editDomainId ? '?/updateDomain' : '?/createDomain'}
				use:enhance={() => {
					submitting = 'domainModal';
					return async ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							toast.success(result.data.message as string);
							closeDomainModal();
						} else if (result.type === 'failure') {
							toast.error((result.data?.message as string) || 'Failed');
						}
						submitting = '';
						return update({ reset: false });
					};
				}}
			>
				{#if editDomainId}
					<input type="hidden" name="domainId" value={editDomainId} />
				{/if}

				<Stack gap="4">
					<!-- Name & Slug -->
					<div class="form-row">
						<label class="form-label" for="domain-name">Name</label>
						<Input id="domain-name" name="name" bind:value={editDomainName} placeholder="Domain name" required />
					</div>
					<div class="form-row">
						<label class="form-label" for="domain-slug">Slug</label>
						<Input id="domain-slug" name="slug" bind:value={editDomainSlug} placeholder="domain-slug" required />
					</div>

					<!-- Live Preview -->
					<div class="preview-row">
						<BlogTag tag={previewTag} tier="domain" size="md" />
					</div>

					<!-- Icon Picker -->
					<div class="form-row">
						<label class="form-label">Icon</label>
						<input type="hidden" name="icon" value={editDomainIcon ?? ''} />
						<Input placeholder="Filter icons..." bind:value={iconFilter} />
						<div class="icon-grid">
							<button
								type="button"
								class="icon-btn"
								class:selected={editDomainIcon === null}
								onclick={() => { editDomainIcon = null; }}
								aria-label="No icon"
								aria-pressed={editDomainIcon === null}
							>
								<span class="i-lucide-x h-4 w-4 op-40"></span>
							</button>
							{#each filteredIcons as icon}
								<button
									type="button"
									class="icon-btn"
									class:selected={editDomainIcon === icon.class}
									onclick={() => { editDomainIcon = icon.class; }}
									aria-label={icon.name}
									aria-pressed={editDomainIcon === icon.class}
								>
									<span class="{icon.class} h-4 w-4 inline-block"></span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Color Picker -->
					<div class="form-row">
						<label class="form-label">Color</label>
						<input type="hidden" name="color" value={editDomainColor ?? ''} />
						<div class="color-row">
							<button
								type="button"
								class="color-swatch none"
								class:selected={editDomainColor === null}
								onclick={() => { editDomainColor = null; }}
								aria-label="No color"
								aria-pressed={editDomainColor === null}
							>
								<span class="i-lucide-x h-3 w-3 op-40"></span>
							</button>
							{#each COLOR_OPTIONS as c}
								<button
									type="button"
									class="color-swatch"
									class:selected={editDomainColor === c}
									style="--swatch-color: var(--chart-{c})"
									onclick={() => { editDomainColor = c; }}
									aria-label="Color {c}"
									aria-pressed={editDomainColor === c}
								></button>
							{/each}
						</div>
					</div>

					<!-- Description -->
					<div class="form-row">
						<label class="form-label" for="domain-desc">Description</label>
						<input type="hidden" name="description" value={editDomainDescription} />
						<textarea
							id="domain-desc"
							class="desc-textarea"
							bind:value={editDomainDescription}
							placeholder="Brief description for this domain..."
							rows="2"
						></textarea>
					</div>

					<!-- Actions -->
					<Cluster justify="end" gap="2">
						<Button variant="ghost" size="sm" onclick={closeDomainModal}>Cancel</Button>
						<Button type="submit" size="sm" disabled={submitting === 'domainModal'}>
							{#if submitting === 'domainModal'}<Spinner size="xs" class="mr-1" />{/if}
							{editDomainId ? 'Save Changes' : 'Create Domain'}
						</Button>
					</Cluster>
				</Stack>
			</form>
		</div>
	</div>
{/if}

<!-- Category Edit/Create Modal -->
{#if showTagModal}
	<div class="modal-overlay" role="presentation" onclick={closeTagModal}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal" onclick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="tag-modal-title">
			<h2 id="tag-modal-title" class="text-fluid-lg font-semibold mb-4">
				{editTagId ? 'Edit Category' : 'Create Category'}
			</h2>

			<form
				method="POST"
				action={editTagId ? '?/updateTag' : '?/create'}
				use:enhance={() => {
					submitting = 'tagModal';
					return async ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							toast.success(result.data.message as string);
							closeTagModal();
						} else if (result.type === 'failure') {
							toast.error((result.data?.message as string) || 'Failed');
						}
						submitting = '';
						return update({ reset: false });
					};
				}}
			>
				{#if editTagId}
					<input type="hidden" name="tagId" value={editTagId} />
				{/if}

				<Stack gap="4">
					<!-- Name & Slug -->
					<div class="form-row">
						<label class="form-label" for="tag-name">Name</label>
						<Input id="tag-name" name="name" bind:value={editTagName} placeholder="Category name" required />
					</div>
					<div class="form-row">
						<label class="form-label" for="tag-slug">Slug</label>
						<Input id="tag-slug" name="slug" bind:value={editTagSlug} placeholder="category-slug" required />
					</div>

					<!-- Live Preview -->
					<div class="preview-row">
						<BlogTag tag={previewCategoryTag} tier="category" size="md" />
					</div>

					<!-- Glyph -->
					<div class="form-row">
						<label class="form-label" for="tag-glyph">Glyph (single character)</label>
						<Input id="tag-glyph" name="glyph" bind:value={editTagGlyph} placeholder="e.g. → ∞ § # @" maxlength={2} />
					</div>

					<!-- Icon Picker -->
					<div class="form-row">
						<label class="form-label">Icon (overrides glyph)</label>
						<input type="hidden" name="icon" value={editTagIcon ?? ''} />
						<Input placeholder="Filter icons..." bind:value={tagIconFilter} />
						<div class="icon-grid">
							<button
								type="button"
								class="icon-btn"
								class:selected={editTagIcon === null}
								onclick={() => { editTagIcon = null; }}
								aria-label="No icon"
								aria-pressed={editTagIcon === null}
							>
								<span class="i-lucide-x h-4 w-4 op-40"></span>
							</button>
							{#each filteredTagIcons as icon}
								<button
									type="button"
									class="icon-btn"
									class:selected={editTagIcon === icon.class}
									onclick={() => { editTagIcon = icon.class; }}
									aria-label={icon.name}
									aria-pressed={editTagIcon === icon.class}
								>
									<span class="{icon.class} h-4 w-4 inline-block"></span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Color Picker -->
					<div class="form-row">
						<label class="form-label">Color</label>
						<input type="hidden" name="color" value={editTagColor ?? ''} />
						<div class="color-row">
							<button
								type="button"
								class="color-swatch none"
								class:selected={editTagColor === null}
								onclick={() => { editTagColor = null; }}
								aria-label="No color"
								aria-pressed={editTagColor === null}
							>
								<span class="i-lucide-x h-3 w-3 op-40"></span>
							</button>
							{#each COLOR_OPTIONS as c}
								<button
									type="button"
									class="color-swatch"
									class:selected={editTagColor === c}
									style="--swatch-color: var(--chart-{c})"
									onclick={() => { editTagColor = c; }}
									aria-label="Color {c}"
									aria-pressed={editTagColor === c}
								></button>
							{/each}
						</div>
					</div>

					<!-- Actions -->
					<Cluster justify="end" gap="2">
						<Button variant="ghost" size="sm" onclick={closeTagModal}>Cancel</Button>
						<Button type="submit" size="sm" disabled={submitting === 'tagModal'}>
							{#if submitting === 'tagModal'}<Spinner size="xs" class="mr-1" />{/if}
							{editTagId ? 'Save Changes' : 'Create Category'}
						</Button>
					</Cluster>
				</Stack>
			</form>
		</div>
	</div>
{/if}

<ConfirmDialog
	open={showDeleteDialog}
	title="Delete Tag"
	description='Delete tag "{deleteTagName}" and unlink it from {deletePostCount} post(s).'
	confirmLabel="Delete"
	destructive
	onconfirm={submitDeleteForm}
	oncancel={() => { showDeleteDialog = false; }}
/>

<ConfirmDialog
	open={showDeleteDomainDialog}
	title="Delete Domain"
	description='Delete domain "{deleteDomainName}" and unset it from {deleteDomainPostCount} post(s).'
	confirmLabel="Delete"
	destructive
	onconfirm={submitDeleteDomainForm}
	oncancel={() => { showDeleteDomainDialog = false; }}
/>

<style>
	.glyph-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.table-wrap {
		overflow-x: auto;
	}

	.tag-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.tag-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.tag-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.tag-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.slug-code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.letter-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.color-dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	/* Modal */
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgb(0 0 0 / 0.5);
		backdrop-filter: blur(4px);
	}

	.modal {
		background: var(--color-page);
		border: 1px solid var(--color-border);
		border-radius: var(--spacing-3);
		padding: var(--spacing-6);
		width: min(480px, 90vw);
		max-height: 85vh;
		overflow-y: auto;
	}

	.form-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.form-label {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.preview-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--spacing-2);
	}

	.icon-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--spacing-1);
		max-height: 160px;
		overflow-y: auto;
		margin-top: var(--spacing-1);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid transparent;
		border-radius: var(--spacing-1);
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
	}

	.icon-btn:hover {
		background: var(--color-subtle);
	}

	.icon-btn.selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	.color-row {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		background: var(--swatch-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-swatch.none {
		background: var(--color-subtle);
		border-color: var(--color-border);
	}

	.color-swatch.selected {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.desc-textarea {
		width: 100%;
		padding: var(--spacing-2);
		background: var(--color-input-bg, var(--color-subtle));
		border: 1px solid var(--color-input-border, var(--color-border));
		border-radius: var(--spacing-1);
		color: var(--color-fg);
		font-family: inherit;
		font-size: var(--text-fluid-sm);
		resize: vertical;
	}

	.desc-textarea:focus {
		outline: none;
		ring: 2px;
		ring-color: var(--color-primary);
	}
</style>
