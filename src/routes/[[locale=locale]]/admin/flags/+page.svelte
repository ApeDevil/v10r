<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Button, Input, Spinner, Switch, Textarea } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data }: PageProps = $props();
const toast = getToast();

let showCreateDialog = $state(false);
let deleteKey = $state('');
let showDeleteDialog = $state(false);
let submitting = $state('');
let newKey = $state('');
let newDescription = $state('');
let newEnabled = $state(false);
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_flags_title()}</h2>
				<Cluster gap="2">
					<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						{m.admin_action_refresh()}
					</Button>
					<Button size="sm" onclick={() => { showCreateDialog = true; newKey = ''; newDescription = ''; newEnabled = false; }}>
						<span class="i-lucide-plus h-4 w-4 mr-1"></span>
						{m.admin_flags_add()}
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		{#if data.flags.length === 0}
			<EmptyState
				icon="i-lucide-toggle-right"
				title={m.admin_flags_empty_title()}
				description={m.admin_flags_empty_description()}
			>
				<Button variant="outline" onclick={() => { showCreateDialog = true; newKey = ''; newDescription = ''; newEnabled = false; }}>
					{m.admin_flags_empty_cta()}
				</Button>
			</EmptyState>
		{:else}
			<div class="flag-grid">
				{#each data.flags as flag}
					<div class="flag-card">
						<div class="flag-header">
							<code class="flag-key">{flag.key}</code>
							<form
								method="POST"
								action="?/toggle"
								use:enhance={() => {
									submitting = flag.key;
									return async ({ result, update }) => {
										if (result.type === 'success' && result.data) toast.success(result.data.message as string);
										else if (result.type === 'failure') toast.error((result.data?.message as string) || m.admin_action_failed_generic());
										submitting = '';
										return update();
									};
								}}
							>
								<input type="hidden" name="key" value={flag.key} />
								<input type="hidden" name="enabled" value={String(!(flag.value === true || flag.value === 'true'))} />
								<button type="submit" class="switch-submit" disabled={submitting === flag.key}>
									<Switch
										checked={flag.value === true || flag.value === 'true'}
										disabled={submitting === flag.key}
									/>
								</button>


							</form>
						</div>

						{#if flag.description}
							<p class="flag-description">{flag.description}</p>
						{/if}

						<div class="flag-footer">
							<span class="flag-updated" title={flag.updatedAt.toISOString()}>
								{m.admin_flags_updated({ when: formatRelative(flag.updatedAt, page.data.locale) })}
							</span>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => { deleteKey = flag.key; showDeleteDialog = true; }}
							>
								<span class="i-lucide-trash-2 h-3 w-3"></span>
							</Button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</Stack>

<!-- Create Flag Dialog -->
{#if showCreateDialog}
	<div class="dialog-overlay" role="presentation" onclick={() => { showCreateDialog = false; }}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div class="dialog-content" role="dialog" aria-label={m.admin_flags_dialog_create_title()} tabindex="-1" onclick={(e) => e.stopPropagation()}>
			<h3 class="dialog-title">{m.admin_flags_dialog_create_title()}</h3>
			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					submitting = 'create';
					return async ({ result, update }) => {
						if (result.type === 'success' && result.data) {
							toast.success(result.data.message as string);
							showCreateDialog = false;
						} else if (result.type === 'failure') {
							toast.error((result.data?.message as string) || m.admin_flags_dialog_create_failed());
						}
						submitting = '';
						return update();
					};
				}}
			>
				<Stack gap="4">
					<label class="field">
						<span class="field-label">{m.admin_flags_field_key()}</span>
						<Input name="key" bind:value={newKey} placeholder="feature.dark_mode" required />
					</label>
					<label class="field">
						<span class="field-label">{m.admin_flags_field_description()}</span>
						<Textarea name="description" bind:value={newDescription} placeholder={m.admin_flags_field_description_placeholder()} rows={2} />
					</label>
					<Cluster gap="2" align="center">
						<input type="hidden" name="enabled" value={newEnabled ? 'on' : ''} />
						<Switch bind:checked={newEnabled} />
						<span class="field-label">{m.admin_flags_field_enabled_default()}</span>
					</Cluster>
					<Cluster gap="2" justify="end">
						<Button variant="outline" onclick={() => { showCreateDialog = false; }}>{m.admin_action_cancel()}</Button>
						<Button type="submit" disabled={submitting === 'create'}>
							{#if submitting === 'create'}<Spinner size="xs" class="mr-1" />{/if}
							{m.admin_flags_create_submit()}
						</Button>
					</Cluster>
				</Stack>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation -->
<ConfirmDialog
	open={showDeleteDialog}
	title={m.admin_flags_dialog_delete_title()}
	description={m.admin_flags_dialog_delete_description({ key: deleteKey })}
	confirmLabel={m.admin_action_delete()}
	destructive
	onconfirm={() => {
		showDeleteDialog = false;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/delete';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'key';
		input.value = deleteKey;
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	}}
	oncancel={() => { showDeleteDialog = false; }}
/>

<style>
	.flag-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: var(--spacing-4);
	}

	.flag-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.flag-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.switch-submit {
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}

	.flag-key {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.flag-description {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	.flag-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: var(--spacing-1);
	}

	.flag-updated {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.dialog-overlay {
		position: fixed;
		inset: 0;
		background: color-mix(in srgb, var(--color-bg) 80%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
	}

	.dialog-content {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-6);
		width: 100%;
		max-width: 480px;
		box-shadow: 0 8px 32px color-mix(in srgb, var(--color-fg) 15%, transparent);
	}

	.dialog-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin-bottom: var(--spacing-4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.field-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}
</style>
