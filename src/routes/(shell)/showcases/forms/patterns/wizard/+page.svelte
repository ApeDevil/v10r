<script lang="ts">
import { tick } from 'svelte';
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Checkbox, Input, Progress, Select, Spinner } from '$lib/components/primitives';
import { wizardSchema } from '$lib/schemas/showcase/patterns';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance,
	submitting,
	delayed,
	validateForm,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(wizardSchema),
});

let step = $state(1);
const totalSteps = 3;

const planOptions = [
	{ value: 'free', label: 'Free' },
	{ value: 'pro', label: 'Pro ($9/mo)' },
	{ value: 'enterprise', label: 'Enterprise ($49/mo)' },
];

const stateOptions = [
	{ value: 'CA', label: 'California' },
	{ value: 'NY', label: 'New York' },
	{ value: 'TX', label: 'Texas' },
	{ value: 'FL', label: 'Florida' },
	{ value: 'IL', label: 'Illinois' },
];

// Step-specific field keys for validation checking
const stepFields: Record<number, string[]> = {
	1: ['firstName', 'lastName', 'email'],
	2: ['street', 'city', 'state', 'zip'],
	3: ['plan', 'terms'],
};

async function nextStep() {
	const result = await validateForm({ update: true });
	const currentFields = stepFields[step];
	const hasErrors = currentFields.some((field) => result.errors[field as keyof typeof result.errors]);

	if (!hasErrors) {
		step++;
		await tick();
		// Focus first input of new step
		const firstInput = document.querySelector<HTMLInputElement>(`.step-${step} input, .step-${step} select`);
		firstInput?.focus();
	}
}

function prevStep() {
	step--;
}
</script>

<svelte:head>
	<title>Wizard - Patterns - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<div>
					<h2 class="text-fluid-lg font-semibold">Multi-Step Wizard</h2>
					<p class="text-fluid-sm text-muted">Per-step validation, progress indicator, combined final submit.</p>
				</div>
				<Badge variant="outline">Step {step}/{totalSteps}</Badge>
			</Cluster>
		{/snippet}

		<Progress value={step} max={totalSteps} size="sm" class="mb-4" />

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			{#if step === 1}
				<div class="step-1">
					<h3 class="step-title">Personal Info</h3>
					<div class="step-fields">
						<FormField label="First Name" error={$errors.firstName?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="firstName"
									bind:value={$form.firstName}
									placeholder="Jane"
									error={!!$errors.firstName}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>

						<FormField label="Last Name" error={$errors.lastName?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="lastName"
									bind:value={$form.lastName}
									placeholder="Doe"
									error={!!$errors.lastName}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>

						<FormField label="Email" error={$errors.email?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="email"
									type="email"
									bind:value={$form.email}
									placeholder="jane@example.com"
									error={!!$errors.email}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>
					</div>
				</div>
			{:else if step === 2}
				<div class="step-2">
					<h3 class="step-title">Address</h3>
					<div class="step-fields">
						<FormField label="Street" error={$errors.street?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="street"
									bind:value={$form.street}
									placeholder="123 Main St"
									error={!!$errors.street}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>

						<FormField label="City" error={$errors.city?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="city"
									bind:value={$form.city}
									placeholder="San Francisco"
									error={!!$errors.city}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>

						<FormField label="State" error={$errors.state?.[0]} required>
							{#snippet children(_)}
								<input type="hidden" name="state" value={$form.state} />
								<Select options={stateOptions} bind:value={$form.state} error={!!$errors.state} />
							{/snippet}
						</FormField>

						<FormField label="ZIP Code" error={$errors.zip?.[0]} required>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="zip"
									inputmode="numeric"
									bind:value={$form.zip}
									placeholder="94102"
									error={!!$errors.zip}
									aria-describedby={describedBy}
								/>
							{/snippet}
						</FormField>
					</div>
				</div>
			{:else}
				<div class="step-3">
					<h3 class="step-title">Plan & Terms</h3>
					<div class="step-fields">
						<FormField label="Plan" error={$errors.plan?.[0]} required>
							{#snippet children(_)}
								<input type="hidden" name="plan" value={$form.plan} />
								<Select options={planOptions} bind:value={$form.plan} error={!!$errors.plan} />
							{/snippet}
						</FormField>

						<FormField label="Terms & Conditions" error={$errors.terms?.[0]} required>
							{#snippet children(_)}
								<input type="hidden" name="terms" value={$form.terms ? 'on' : ''} />
								<Checkbox
									bind:checked={$form.terms}
									label="I accept the terms and conditions"
								/>
							{/snippet}
						</FormField>
					</div>
				</div>
			{/if}

			<!-- Hidden fields for non-visible steps (for form submission) -->
			{#if step !== 1}
				<input type="hidden" name="firstName" value={$form.firstName} />
				<input type="hidden" name="lastName" value={$form.lastName} />
				<input type="hidden" name="email" value={$form.email} />
			{/if}
			{#if step !== 2}
				<input type="hidden" name="street" value={$form.street} />
				<input type="hidden" name="city" value={$form.city} />
				<input type="hidden" name="state" value={$form.state} />
				<input type="hidden" name="zip" value={$form.zip} />
			{/if}
			{#if step !== 3}
				<input type="hidden" name="plan" value={$form.plan} />
				<input type="hidden" name="terms" value={$form.terms ? 'on' : ''} />
			{/if}

			<Cluster justify="between" class="pt-2">
				{#if step > 1}
					<Button type="button" variant="outline" onclick={prevStep}>Back</Button>
				{:else}
					<div></div>
				{/if}

				{#if step < totalSteps}
					<Button type="button" onclick={nextStep}>Next</Button>
				{:else}
					<Button type="submit" disabled={$submitting}>
						{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
						Complete
					</Button>
				{/if}
			</Cluster>
		</form>
	</Card>

	<Alert variant="info" title="Wizard Pattern">
		{#snippet children()}
			<p>Each step validates only its own fields via <code>validateForm()</code>. Hidden inputs preserve values from other steps for the final submit. The browser back button navigates away (known limitation of client-side step tracking).</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.step-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
		margin-bottom: var(--spacing-4);
	}

	.step-fields {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}
</style>
