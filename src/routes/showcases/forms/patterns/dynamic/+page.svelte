<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { dynamicSchema } from '$lib/schemas/forms-showcase/patterns';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Input, Badge, Spinner } from '$lib/components/primitives';
	import { Stack, Cluster } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, message: formMessage } = superForm(data.form, {
		validators: valibotClient(dynamicSchema),
		dataType: 'json',
	});

	function addTag() {
		$form.tags = [...$form.tags, { name: '' }];
	}

	function removeTag(index: number) {
		$form.tags = $form.tags.filter((_, i) => i !== index);
	}
</script>

<svelte:head>
	<title>Dynamic - Patterns - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<div>
					<h2 class="text-fluid-lg font-semibold">Dynamic Array Fields</h2>
					<p class="text-fluid-sm text-muted">Add/remove tags dynamically with per-item validation.</p>
				</div>
				<Badge variant="outline">{$form.tags.length} tag{$form.tags.length !== 1 ? 's' : ''}</Badge>
			</Cluster>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Title" error={$errors.title?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="title"
						bind:value={$form.title}
						placeholder="Article title"
						error={!!$errors.title}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="tags-section">
				<Cluster justify="between">
					<span class="text-fluid-sm font-medium text-fg">Tags *</span>
					{#if $errors.tags?._errors}
						<span class="text-fluid-xs text-error">{$errors.tags._errors[0]}</span>
					{/if}
				</Cluster>

				<Stack gap="3">
					{#each $form.tags as tag, i (i)}
						<Cluster gap="3">
							<div class="tag-input-wrap">
								<Input
									bind:value={$form.tags[i].name}
									placeholder="Tag name"
									error={!!$errors.tags?.[i]?.name}
								/>
								{#if $errors.tags?.[i]?.name}
									<span class="text-fluid-xs text-error">{$errors.tags[i].name[0]}</span>
								{/if}
							</div>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onclick={() => removeTag(i)}
								disabled={$form.tags.length <= 1}
								class="remove-btn"
								aria-label="Remove tag {i + 1}"
							>
								<span class="i-lucide-x h-4 w-4"></span>
							</Button>
						</Cluster>
					{/each}
				</Stack>

				<Button type="button" variant="outline" size="sm" onclick={addTag} disabled={$form.tags.length >= 10}>
					<span class="i-lucide-plus h-4 w-4 mr-1"></span>
					Add Tag
				</Button>
			</div>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Save
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="warning" title="dataType: 'json'">
		{#snippet children()}
			<p>Dynamic arrays require <code>dataType: 'json'</code> which sends data as JSON instead of FormData. This breaks progressive enhancement (the form won't work without JavaScript).</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.tags-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.tag-input-wrap {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	:global(.remove-btn) {
		min-height: 2.75rem;
		min-width: 2.75rem;
	}
</style>
