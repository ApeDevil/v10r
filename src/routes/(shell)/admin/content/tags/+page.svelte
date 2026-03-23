<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
	import { Cluster, Stack } from '$lib/components/layout';
	import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
	import { getToast } from '$lib/state/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const toast = getToast();

	let submitting = $state('');
	let editingTagId = $state('');
	let editName = $state('');
	let editSlug = $state('');

	let showDeleteDialog = $state(false);
	let deleteTagId = $state('');
	let deleteTagName = $state('');
	let deletePostCount = $state(0);

	function startEditing(tag: { id: string; name: string; slug: string }) {
		editingTagId = tag.id;
		editName = tag.name;
		editSlug = tag.slug;
	}

	function cancelEditing() {
		editingTagId = '';
		editName = '';
		editSlug = '';
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
</script>

<svelte:head>
	<title>Tags - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Tag Management</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<!-- Create Form -->
		<form
			method="POST"
			action="?/create"
			class="create-form"
			use:enhance={() => {
				submitting = 'create';
				return async ({ result, update }) => {
					if (result.type === 'success' && result.data) toast.success(result.data.message as string);
					else if (result.type === 'failure') toast.error((result.data?.message as string) || 'Failed');
					submitting = '';
					return update({ reset: true });
				};
			}}
		>
			<Input name="name" placeholder="Tag name" required />
			<Input name="slug" placeholder="tag-slug" required />
			<Button type="submit" variant="outline" size="sm" disabled={submitting === 'create'}>
				{#if submitting === 'create'}<Spinner size="xs" class="mr-1" />{/if}
				Create Tag
			</Button>
		</form>

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
							<th>Name</th>
							<th>Slug</th>
							<th>Posts</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.tags as t}
							<tr>
								{#if editingTagId === t.id}
									<td colspan="4">
										<form
											method="POST"
											action="?/rename"
											class="edit-form"
											use:enhance={() => {
												submitting = t.id + ':rename';
												return async ({ result, update }) => {
													if (result.type === 'success' && result.data) {
														toast.success(result.data.message as string);
														cancelEditing();
													} else if (result.type === 'failure') {
														toast.error((result.data?.message as string) || 'Failed');
													}
													submitting = '';
													return update();
												};
											}}
										>
											<input type="hidden" name="tagId" value={t.id} />
											<Input name="name" value={editName} placeholder="Name" required />
											<Input name="slug" value={editSlug} placeholder="slug" required />
											<Cluster gap="1">
												<Button type="submit" variant="outline" size="sm" disabled={submitting === t.id + ':rename'}>
													{#if submitting === t.id + ':rename'}<Spinner size="xs" class="mr-1" />{/if}
													Save
												</Button>
												<Button variant="ghost" size="sm" onclick={cancelEditing}>Cancel</Button>
											</Cluster>
										</form>
									</td>
								{:else}
									<td>{t.name}</td>
									<td><code class="slug-code">{t.slug}</code></td>
									<td><Badge variant="secondary">{t.postCount}</Badge></td>
									<td>
										<Cluster gap="1">
											<Button variant="outline" size="sm" onclick={() => startEditing(t)}>Rename</Button>
											<Button variant="ghost" size="sm" onclick={() => openDeleteDialog(t)}>Delete</Button>
										</Cluster>
									</td>
								{/if}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</Stack>

<ConfirmDialog
	open={showDeleteDialog}
	title="Delete Tag"
	description='Delete tag "{deleteTagName}" and unlink it from {deletePostCount} post(s).'
	confirmLabel="Delete"
	destructive
	onconfirm={submitDeleteForm}
	oncancel={() => { showDeleteDialog = false; }}
/>

<style>
	.create-form {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
		margin-bottom: var(--spacing-4);
	}

	.edit-form {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
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
</style>
