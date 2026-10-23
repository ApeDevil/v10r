<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { page } from '$app/state';
import { Alert, Card, DraftRecoveryNotice, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner, Textarea } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { draftMessageSchema } from '$lib/schemas/showcase/advanced';
import { createFormDraft } from '$lib/state/form-draft.svelte';
import { guardUnsavedChanges } from '$lib/state/leave-guard.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// svelte-ignore state_referenced_locally
const sf = superForm(data.form, {
	validators: valibotClient(draftMessageSchema),
	resetForm: true,
	onUpdated: ({ form: submitted }) => {
		if (submitted.valid) draft.clear();
	},
});
const { form, errors, enhance, submitting, delayed, tainted, message: formMessage } = sf;

// The password field is never stored: credential-like names are dropped before any write.
const draft = createFormDraft(sf, {
	formId: 'showcase-draft-message',
	owner: page.data.session?.user.id ?? null,
});

// Leaving loses nothing while the draft is kept, so only a refused write earns a prompt.
guardUnsavedChanges(
	() => sf.isTainted() && draft.saveFailed,
	() => m.showcase_forms_draft_leave_confirm(),
);
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<div>
					<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_draft_heading()}</h2>
					<p class="text-fluid-sm text-muted">{m.showcase_forms_draft_intro()}</p>
				</div>
				{#if $tainted && !draft.offer}
					<Badge variant={draft.saveFailed ? 'warning' : 'secondary'}>
						{draft.saveFailed ? m.showcase_forms_draft_save_failed() : m.showcase_forms_draft_saved_status()}
					</Badge>
				{/if}
			</Cluster>
		{/snippet}

		{#if draft.offer}
			<DraftRecoveryNotice savedAt={draft.offer.savedAt} onrestore={draft.restore} ondiscard={draft.discard} />
		{/if}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_draft_sent()} />
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label={m.showcase_forms_draft_field_subject()} error={$errors.subject?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="subject"
						bind:value={$form.subject}
						error={!!$errors.subject}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_draft_field_message()} error={$errors.message?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Textarea
						id={fieldId}
						name="message"
						bind:value={$form.message}
						rows={5}
						error={!!$errors.message}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_password()} error={$errors.password?.[0]}>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="password"
						type="password"
						autocomplete="off"
						bind:value={$form.password}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_draft_submit()}
				</Button>
			</div>
		</form>
	</Card>
</Stack>
