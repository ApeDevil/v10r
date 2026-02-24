<script lang="ts">
	import type { PageProps } from './$types';
	import { superForm } from 'sveltekit-superforms';
	import { valibotClient } from 'sveltekit-superforms/adapters';
	import { dependentSchema } from '$lib/schemas/forms-showcase/patterns';
	import { Card, Alert, FormField } from '$lib/components/composites';
	import { Button, Select, Spinner } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	let { data }: PageProps = $props();

	const { form, errors, enhance, submitting, delayed, message: formMessage } = superForm(data.form, {
		validators: valibotClient(dependentSchema),
		delayMs: 150,
	});

	const locationData = data.locationData;

	type Country = (typeof locationData)[keyof typeof locationData];
	type States = Country['states'];

	const countryOptions = $derived(
		Object.entries(locationData).map(([value, c]) => ({ value, label: c.label }))
	);

	const stateOptions = $derived.by(() => {
		const key = $form.country as keyof typeof locationData;
		if (!key || !locationData[key]) return [];
		const states = locationData[key].states as States;
		return Object.entries(states).map(([value, s]) => ({ value, label: (s as { label: string }).label }));
	});

	const cityOptions = $derived.by(() => {
		const countryKey = $form.country as keyof typeof locationData;
		if (!countryKey || !$form.state) return [];
		const country = locationData[countryKey];
		if (!country) return [];
		const states = country.states as Record<string, { label: string; cities: string[] }>;
		const state = states[$form.state];
		if (!state) return [];
		return state.cities.map((city: string) => ({ value: city, label: city }));
	});

	// Reset child fields when parent changes
	$effect(() => {
		$form.country;
		$form.state = '';
		$form.city = '';
	});

	$effect(() => {
		$form.state;
		$form.city = '';
	});
</script>

<svelte:head>
	<title>Dependent - Forms - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Cascading Selects</h2>
			<p class="text-fluid-sm text-muted">Country → State → City. Each level filters the next.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title="Success">
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label="Country" error={$errors.country?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="country" value={$form.country} />
					<Select options={countryOptions} bind:value={$form.country} placeholder="Select country..." />
				{/snippet}
			</FormField>

			<FormField label="State / Region" error={$errors.state?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="state" value={$form.state} />
					<Select
						options={stateOptions}
						bind:value={$form.state}
						placeholder="Select state..."
						disabled={!$form.country}
					/>
				{/snippet}
			</FormField>

			<FormField label="City" error={$errors.city?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="city" value={$form.city} />
					<Select
						options={cityOptions}
						bind:value={$form.city}
						placeholder="Select city..."
						disabled={!$form.state}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					Submit
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Cascading Pattern">
		{#snippet children()}
			<p>Options for State and City are filtered using <code>$derived</code>. When a parent changes, <code>$effect</code> resets child values to empty string. The cascade stops naturally because resetting to the same value (<code>''</code>) doesn't re-trigger.</p>
		{/snippet}
	</Alert>
</Stack>

<style>
	.form-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}
</style>
