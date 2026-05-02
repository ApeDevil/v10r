<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Progress, Spinner } from '$lib/components/primitives';
import { realtimeSchema } from '$lib/schemas/showcase/validation';
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
	validators: valibotClient(realtimeSchema),
	validationMethod: 'oninput',
});

const usernameLength = $derived($form.username.length);
const usernameMaxLength = 20;

// Password strength
const passwordStrength = $derived.by(() => {
	const pw = $form.password;
	if (!pw) return { score: 0, label: '', variant: 'default' as const };
	let score = 0;
	if (pw.length >= 8) score++;
	if (/[A-Z]/.test(pw)) score++;
	if (/[0-9]/.test(pw)) score++;
	if (/[^A-Za-z0-9]/.test(pw)) score++;
	const levels = [
		{ score: 0, label: '', variant: 'default' as const },
		{ score: 1, label: 'Weak', variant: 'error' as const },
		{ score: 2, label: 'Fair', variant: 'warning' as const },
		{ score: 3, label: 'Good', variant: 'success' as const },
		{ score: 4, label: 'Strong', variant: 'success' as const },
	];
	return levels[score];
});
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Realtime Validation</h2>
			<p class="text-fluid-sm text-muted">Live feedback on every keystroke. Password strength indicator and character counter.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Username" error={$errors.username?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="username"
						bind:value={$form.username}
						placeholder="lowercase_username"
						maxlength={usernameMaxLength}
						error={!!$errors.username}
						aria-describedby={describedBy}
					/>
					<Cluster justify="end" gap="2">
						<span class="char-count">{usernameLength}/{usernameMaxLength}</span>
					</Cluster>
				{/snippet}
			</FormField>

			<FormField label="Password" error={$errors.password?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="password"
						type="password"
						bind:value={$form.password}
						placeholder="Min 8 chars, uppercase, number, special"
						error={!!$errors.password}
						aria-describedby={describedBy}
					/>
					{#if $form.password}
						<div class="strength-bar">
							<Progress value={passwordStrength.score} max={4} variant={passwordStrength.variant} size="sm" />
							{#if passwordStrength.label}
								<Badge variant={passwordStrength.variant === 'default' ? 'outline' : passwordStrength.variant}>
									{passwordStrength.label}
								</Badge>
							{/if}
						</div>
					{/if}
				{/snippet}
			</FormField>

			<FormField label="Confirm Password" error={$errors.confirmPassword?.[0]} required>
				{#snippet children({ fieldId, describedBy })}
					<Input
						id={fieldId}
						name="confirmPassword"
						type="password"
						bind:value={$form.confirmPassword}
						placeholder="Re-enter your password"
						error={!!$errors.confirmPassword}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Create Account
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="When to use oninput">
		{#snippet children()}
			<p><code>validationMethod: 'oninput'</code> is appropriate for live-feedback scenarios like password strength and character counters. For standard text fields, use the default <code>'auto'</code> (validates on blur) to avoid frustrating users with premature errors.</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.char-count {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}

	.strength-bar {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-2);
	}
</style>
