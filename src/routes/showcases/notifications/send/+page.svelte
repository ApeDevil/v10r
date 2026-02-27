<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card } from '$lib/components/composites';
	import { NotificationCard } from '$lib/components/composites/notifications';
	import { Badge, Button, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

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
		setTimeout(() => { sentType = null; }, 2000);
	}

	function flashCustomSent() {
		sentCustom = true;
		setTimeout(() => { sentCustom = false; }, 2000);
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
						<span class="quick-label">{qt.label}</span>
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
				class="custom-form"
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
				<div class="form-field">
					<label for="custom-type">Type</label>
					<select id="custom-type" name="type" bind:value={customType}>
						{#each data.notificationTypes as t}
							<option value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
						{/each}
					</select>
				</div>

				<div class="form-field">
					<label for="custom-title">Title</label>
					<input
						id="custom-title"
						name="title"
						type="text"
						required
						placeholder="Notification title..."
						bind:value={customTitle}
					/>
				</div>

				<div class="form-field">
					<label for="custom-body">Body <span class="text-muted">(optional)</span></label>
					<textarea
						id="custom-body"
						name="body"
						rows="3"
						placeholder="Optional description..."
						bind:value={customBody}
					></textarea>
				</div>

				{#if form?.error}
					<p class="form-error">{form.error}</p>
				{/if}

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
			</form>

			<!-- Live Preview -->
			<div class="preview-section">
				<p class="preview-label">Preview</p>
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

	.quick-card:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.quick-icon {
		font-size: 1.25rem;
		color: var(--color-muted);
	}

	.quick-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	/* Custom Form */
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

	.custom-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.form-field label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
	}

	.form-field input,
	.form-field select,
	.form-field textarea {
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.form-field input:focus,
	.form-field select:focus,
	.form-field textarea:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.form-field textarea {
		resize: vertical;
	}

	.form-error {
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
		margin: 0;
	}

	/* Preview */
	.preview-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.preview-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		margin: 0;
	}

	.preview-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
</style>
