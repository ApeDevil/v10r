<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import { FormField, Input, DatePicker } from '$lib/components';

	let inputValue = $state('');
</script>

<section id="comp-forms" class="section">
	<h2 class="section-title">Forms</h2>
	<p class="section-description">Components for building and structuring forms.</p>

	<div class="demos">
		<!-- FormField -->
		<DemoCard title="Form Field" description="Input with label and error">
			<div class="form-field-demo">
				<FormField
					label="Username"
					description="Enter your username"
					required
				>
					{#snippet children()}
						<Input bind:value={inputValue} placeholder="Enter username" />
					{/snippet}
				</FormField>

				<FormField
					label="Email"
					error="Invalid email address"
					required
				>
					{#snippet children()}
						<Input placeholder="Enter email" error />
					{/snippet}
				</FormField>
			</div>
		</DemoCard>

		<!-- DatePicker -->
		<DemoCard title="Date Picker" description="Calendar-based date selection">
			<div class="form-field-demo">
				<DatePicker label="Birthdate" />
				<DatePicker label="Disabled" disabled />
			</div>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.form-field-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		max-width: 25rem;
		width: 100%;
	}
</style>
