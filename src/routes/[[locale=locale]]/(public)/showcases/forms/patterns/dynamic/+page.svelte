<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField, TagInput } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { dynamicSchema } from '$lib/schemas/showcase/patterns';
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
	validators: valibotClient(dynamicSchema),
	dataType: 'json',
});
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<div>
					<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_dynamic_heading()}</h2>
					<p class="text-fluid-sm text-muted">Add/remove tags dynamically with per-item validation.</p>
				</div>
				<Badge variant="outline">{$form.tags.length} tag{$form.tags.length !== 1 ? 's' : ''}</Badge>
			</Cluster>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_success()}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label={m.showcase_forms_field_title()} error={$errors.title?.[0]} required>
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

			<FormField label={m.showcase_forms_field_tags()} error={$errors.tags?._errors?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<TagInput
						id={fieldId}
						bind:value={$form.tags}
						placeholder="Type a tag and press Enter..."
						max={10}
						maxLength={30}
						error={!!$errors.tags?._errors}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_save()}
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
