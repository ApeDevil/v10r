<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Select, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { dependentSchema } from '$lib/schemas/showcase/patterns';
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
	validators: valibotClient(dependentSchema),
});

// svelte-ignore state_referenced_locally
const locationData = data.locationData;

type Country = (typeof locationData)[keyof typeof locationData];
type States = Country['states'];

const countryOptions = $derived(Object.entries(locationData).map(([value, c]) => ({ value, label: c.label })));

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

function onCountryChange() {
	$form.state = '';
	$form.city = '';
}

function onStateChange() {
	$form.city = '';
}
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_forms_dependent_heading()}</h2>
			<p class="text-fluid-sm text-muted">Country → State → City. Each level filters the next.</p>
		{/snippet}

		{#if $formMessage}
			<Alert variant="success" title={m.showcase_forms_success()}>
				{#snippet children()}
					<p>{$formMessage}</p>
				{/snippet}
			</Alert>
		{/if}

		<form method="POST" use:enhance class="form-grid">
			<FormField label={m.showcase_forms_field_country()} error={$errors.country?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="country" value={$form.country} />
					<Select options={countryOptions} bind:value={$form.country} placeholder="Select country..." onchange={onCountryChange} error={!!$errors.country} />
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_state_region()} error={$errors.state?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="state" value={$form.state} />
					<Select
						options={stateOptions}
						bind:value={$form.state}
						placeholder="Select state..."
						disabled={!$form.country}
						onchange={onStateChange}
						error={!!$errors.state}
					/>
				{/snippet}
			</FormField>

			<FormField label={m.showcase_forms_field_city()} error={$errors.city?.[0]} required>
				{#snippet children(_)}
					<input type="hidden" name="city" value={$form.city} />
					<Select
						options={cityOptions}
						bind:value={$form.city}
						placeholder="Select city..."
						disabled={!$form.state}
						error={!!$errors.city}
					/>
				{/snippet}
			</FormField>

			<div class="form-actions">
				<Button type="submit" disabled={$submitting}>
					{#if $delayed}<Spinner size="sm" class="mr-2" />{/if}
					{m.showcase_forms_submit()}
				</Button>
			</div>
		</form>
	</Card>

	<Alert variant="info" title="Cascading Pattern">
		{#snippet children()}
			<p>Options for State and City are filtered using <code>$derived</code>. When a parent changes, the <code>onchange</code> callback resets child values to empty string. This avoids <code>$effect</code> anti-patterns and works safely with pre-populated forms.</p>
		{/snippet}
	</Alert>
</Stack>
