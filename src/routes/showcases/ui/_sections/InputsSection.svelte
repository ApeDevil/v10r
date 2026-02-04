<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import VariantGrid from './shared/VariantGrid.svelte';
	import { Input, Select, Checkbox } from '$lib/components';

	let textValue = $state('');
	let emailValue = $state('');
	let disabledValue = $state('Disabled');
	let selectValue = $state('');
	let checkbox1 = $state(false);
	let checkbox2 = $state(true);
	let checkbox3 = $state(false);
</script>

<section id="inputs" class="section">
	<h2 class="section-title">Inputs</h2>
	<p class="section-description">Form input elements for user data entry.</p>

	<div class="demos">
		<!-- Text Input -->
		<DemoCard title="Text Input" description="Basic text input">
			<VariantGrid layout="grid">
				<Input bind:value={textValue} placeholder="Enter text" />
				<Input bind:value={emailValue} type="email" placeholder="Enter email" />
				<Input bind:value={disabledValue} disabled />
			</VariantGrid>
		</DemoCard>

		<!-- Input States -->
		<DemoCard title="Input States" description="Error and validation states">
			<VariantGrid layout="grid">
				<Input placeholder="Normal state" />
				<Input placeholder="Error state" error />
			</VariantGrid>
		</DemoCard>

		<!-- Select -->
		<DemoCard title="Select" description="Dropdown selection">
			<VariantGrid layout="grid">
				<Select
					bind:value={selectValue}
					placeholder="Choose an option"
					options={[
						{ value: 'option1', label: 'Option 1' },
						{ value: 'option2', label: 'Option 2' },
						{ value: 'option3', label: 'Option 3' }
					]}
				/>
			</VariantGrid>
		</DemoCard>

		<!-- Checkbox -->
		<DemoCard title="Checkbox" description="Boolean selection">
			<VariantGrid layout="row">
				<Checkbox bind:checked={checkbox1} label="Unchecked" />
				<Checkbox bind:checked={checkbox2} label="Checked" />
				<Checkbox bind:checked={checkbox3} label="Disabled" disabled />
			</VariantGrid>
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
</style>
