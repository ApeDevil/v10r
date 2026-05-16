<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, ConfirmDialog, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { confirmSchema } from '$lib/schemas/showcase/advanced';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance,
	submitting,
	delayed,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(confirmSchema),
});

let showConfirm = $state(false);
let formRef = $state<HTMLFormElement | null>(null);

function handleDeleteClick() {
	showConfirm = true;
}

function handleConfirm() {
	showConfirm = false;
}

function handleCancel() {
	showConfirm = false;
}
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_confirm_heading()}</h2>
			<p class="text-fluid-sm text-muted">Type DELETE to confirm. Uses a confirmation dialog before submission.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_confirm_deleted()}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<div class="items-list">
			<h3 class="text-fluid-sm font-medium text-fg mb-3">{m.showcase_forms_confirm_items_title()}</h3>
			<Stack gap="2">
				{#each data.items as item (item.id)}
					<Cluster justify="between" class="item-row">
						<span class="text-fluid-sm">{item.name}</span>
						<Badge variant="outline">{item.type}</Badge>
					</Cluster>
				{/each}
			</Stack>
		</div>

		<form method="POST" action="?/delete" use:enhance bind:this={formRef} class="form-grid">
			<FormField label={m.showcase_forms_field_confirmation()} error={$errors.confirmation?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="confirmation"
						bind:value={$form.confirmation}
						placeholder="DELETE"
						error={!!$errors.confirmation}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="button" variant="destructive" onclick={handleDeleteClick} disabled={$submitting || $form.confirmation !== 'DELETE'}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_confirm_delete_btn()}
				</Button>
			</div>
		</form>
	</Card>

	<ConfirmDialog
		bind:open={showConfirm}
		title={m.showcase_forms_confirm_dialog_title()}
		description={m.showcase_forms_confirm_dialog_description()}
		confirmLabel={m.showcase_forms_confirm_dialog_btn()}
		destructive
		onconfirm={() => {
			handleConfirm();
			formRef?.requestSubmit();
		}}
		oncancel={handleCancel}
	/>

	<Alert variant="info" title="Confirm Pattern">
		{#snippet children()}
			<p>The confirmation dialog is separate from the form. The user types DELETE in the input (validated by schema), then clicks the button which opens a dialog. Only after confirming the dialog does the form actually submit.</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.items-list {
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-4);
	}

	:global(.item-row) {
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
	}
</style>
