<script lang="ts">
import { enhance } from '$app/forms';
import { Card, FormField } from '$lib/components/composites';
import { NotificationCard } from '$lib/components/composites/notifications';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';

let { data, form } = $props();

const quickTypes = [
	{ type: 'mention', label: 'Mention', icon: 'i-lucide-at-sign' },
	{ type: 'comment', label: 'Comment', icon: 'i-lucide-message-square' },
	{ type: 'system', label: 'System', icon: 'i-lucide-info' },
	{ type: 'success', label: 'Success', icon: 'i-lucide-check-circle' },
	{ type: 'security', label: 'Security', icon: 'i-lucide-shield-alert' },
	{ type: 'follow', label: 'Follow', icon: 'i-lucide-user-plus' },
];

let sendingType = $state<string | null>(null);
let sentType = $state<string | null>(null);
let sendingCustom = $state(false);
let sentCustom = $state(false);

// Custom form state for live preview
let customType = $state('mention');
let customTitle = $state('');
let customBody = $state('');

function flashSent(type: string) {
	sentType = type;
	setTimeout(() => {
		sentType = null;
	}, 2000);
}

function flashCustomSent() {
	sentCustom = true;
	setTimeout(() => {
		sentCustom = false;
	}, 2000);
}
</script>

<svelte:head>
	<title>Send - Notifications - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<!-- Quick Fire -->
	<Card>
		{#snippet header()}
			<div>
				<h2 class="text-fluid-lg font-semibold">Quick Fire</h2>
				<p class="text-fluid-sm text-muted mt-1">Send preset notifications to test each type.</p>
			</div>
		{/snippet}

		<div class="quick-grid">
			{#each quickTypes as qt}
				<form
					method="POST"
					action="?/quickSend"
					use:enhance={() => {
						sendingType = qt.type;
						return async ({ update }) => {
							await update();
							sendingType = null;
							flashSent(qt.type);
						};
					}}
				>
					<input type="hidden" name="type" value={qt.type} />
					<button type="submit" class="quick-card" disabled={sendingType === qt.type}>
						<span class="quick-icon">
							{#if sendingType === qt.type}
								<Spinner size="xs" />
							{:else if sentType === qt.type}
								<span class="i-lucide-check text-success"></span>
							{:else}
								<span class={qt.icon}></span>
							{/if}
						</span>
						<span class="text-fluid-sm font-medium">{qt.label}</span>
					</button>
				</form>
			{/each}
		</div>
	</Card>

	<!-- Custom Send -->
	<Card>
		{#snippet header()}
			<div>
				<h2 class="text-fluid-lg font-semibold">Custom Send</h2>
				<p class="text-fluid-sm text-muted mt-1">Compose a notification with custom content.</p>
			</div>
		{/snippet}

		<div class="custom-layout">
			<form
				method="POST"
				action="?/customSend"
				use:enhance={() => {
					sendingCustom = true;
					return async ({ update }) => {
						await update();
						sendingCustom = false;
						flashCustomSent();
						customTitle = '';
						customBody = '';
					};
				}}
			>
				<Stack gap="4">
					<FormField label="Type" id="custom-type">
						{#snippet children({ fieldId, describedBy })}
							<select
								id={fieldId}
								name="type"
								bind:value={customType}
								aria-describedby={describedBy}
								class="form-select"
							>
								{#each data.notificationTypes as t}
									<option value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
								{/each}
							</select>
						{/snippet}
					</FormField>

					<FormField label="Title" id="custom-title" required>
						{#snippet children({ fieldId, describedBy })}
							<Input
								id={fieldId}
								name="title"
								type="text"
								required
								placeholder="Notification title..."
								bind:value={customTitle}
								aria-describedby={describedBy}
							/>
						{/snippet}
					</FormField>

					<FormField label="Body" id="custom-body" description="Optional">
						{#snippet children({ fieldId, describedBy })}
							<textarea
								id={fieldId}
								name="body"
								rows="3"
								placeholder="Optional description..."
								bind:value={customBody}
								aria-describedby={describedBy}
								class="form-textarea"
							></textarea>
						{/snippet}
					</FormField>

					{#if form?.error}
						<p class="text-fluid-sm text-error">{form.error}</p>
					{/if}

					<div>
						<Button type="submit" disabled={sendingCustom || !customTitle.trim()}>
							{#if sendingCustom}
								<Spinner size="xs" class="mr-2" />
								Sending...
							{:else if sentCustom}
								<span class="i-lucide-check h-4 w-4 mr-1"></span>
								Sent
							{:else}
								<span class="i-lucide-send h-4 w-4 mr-1"></span>
								Send
							{/if}
						</Button>
					</div>
				</Stack>
			</form>

			<!-- Live Preview -->
			<div class="preview-section">
				<p class="text-fluid-sm font-medium text-muted">Preview</p>
				<div class="preview-card">
					<NotificationCard
						id="preview"
						type={customType}
						title={customTitle || 'Notification title...'}
						body={customBody || null}
						isRead={false}
						createdAt={new Date().toISOString()}
					/>
				</div>
			</div>
		</div>
	</Card>
</Stack>

<style>
	/* Quick Fire Grid */
	.quick-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--spacing-3);
	}

	.quick-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		cursor: pointer;
		width: 100%;
	}

	.quick-card:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.quick-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.quick-card:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.quick-icon {
		font-size: var(--text-fluid-lg);
		color: var(--color-muted);
	}

	/* Custom Form Layout */
	.custom-layout {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.custom-layout {
			grid-template-columns: 1fr;
		}
	}

	/* Native select/textarea styled to match Input component */
	.form-select,
	.form-textarea {
		width: 100%;
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-base);
		color: var(--color-fg);
		background-color: var(--color-input);
		border: none;
		border-bottom: 1px solid var(--color-input-border);
		border-radius: var(--radius-md) var(--radius-md) 0 0;
		transition: border-bottom-color 150ms ease, border-bottom-width 150ms ease;
	}

	.form-select:focus,
	.form-textarea:focus {
		outline: none;
		border-bottom: 2px solid var(--color-primary);
	}

	.form-textarea {
		resize: vertical;
	}

	/* Preview */
	.preview-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.preview-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
</style>
