<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import VariantGrid from './shared/VariantGrid.svelte';
	import { Input, Select, Checkbox, Combobox, Slider, Switch, Toggle, ToggleGroup, Calendar } from '$lib/components';

	let textValue = $state('');
	let emailValue = $state('');
	let disabledValue = $state('Disabled');
	let selectValue = $state('');
	let checkbox1 = $state(false);
	let checkbox2 = $state(true);
	let checkbox3 = $state(false);
	let comboboxValue = $state<string | undefined>(undefined);
	let sliderValue = $state([50]);
	let sliderSmValue = $state([25]);
	let sliderLgValue = $state([75]);
	let rangeValue = $state([20, 80]);
	let switchChecked = $state(false);
	let toggleBold = $state(false);
	let toggleItalic = $state(false);
	let toggleGroupValue = $state('center');
</script>

<section id="prim-inputs" class="section">
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

		<!-- Switch -->
		<DemoCard title="Switch" description="Toggle between on and off states">
			<VariantGrid layout="row">
				<Switch bind:checked={switchChecked} label="Notifications" />
				<Switch checked={true} label="Enabled" disabled />
				<Switch size="sm" label="Small" />
			</VariantGrid>
		</DemoCard>

		<!-- Toggle -->
		<DemoCard title="Toggle" description="Pressable toggle button">
			<VariantGrid layout="row">
				<Toggle bind:pressed={toggleBold}>
					<span class="i-lucide-bold h-4 w-4" aria-hidden="true" />
				</Toggle>
				<Toggle bind:pressed={toggleItalic} variant="outline">
					<span class="i-lucide-italic h-4 w-4" aria-hidden="true" />
				</Toggle>
				<Toggle disabled>
					<span class="i-lucide-underline h-4 w-4" aria-hidden="true" />
				</Toggle>
			</VariantGrid>
		</DemoCard>

		<!-- Toggle Group -->
		<DemoCard title="Toggle Group" description="Group of exclusive toggle options">
			<ToggleGroup
				bind:value={toggleGroupValue}
				items={[
					{ value: 'left', label: 'Left' },
					{ value: 'center', label: 'Center' },
					{ value: 'right', label: 'Right' }
				]}
			/>
		</DemoCard>

		<!-- Combobox -->
		<DemoCard title="Combobox" description="Searchable dropdown selection">
			<VariantGrid layout="grid">
				<Combobox
					bind:selected={comboboxValue}
					placeholder="Search a framework..."
					options={[
						{ value: 'svelte', label: 'Svelte' },
						{ value: 'react', label: 'React' },
						{ value: 'vue', label: 'Vue' },
						{ value: 'angular', label: 'Angular' },
						{ value: 'solid', label: 'SolidJS' }
					]}
				/>
			</VariantGrid>
		</DemoCard>

		<!-- Slider -->
		<DemoCard title="Slider" description="Numeric value selection with drag interaction">
			<VariantGrid layout="grid">
				<div style="width: 100%;">
					<p class="slider-label">Default (md): {sliderValue[0]}</p>
					<Slider bind:value={sliderValue} min={0} max={100} step={1} />
				</div>
			</VariantGrid>
		</DemoCard>

		<!-- Slider Sizes -->
		<DemoCard title="Slider Sizes" description="Small, medium, and large variants">
			<VariantGrid layout="grid">
				<div style="width: 100%;">
					<p class="slider-label">Small: {sliderSmValue[0]}</p>
					<Slider bind:value={sliderSmValue} size="sm" min={0} max={100} />
				</div>
				<div style="width: 100%;">
					<p class="slider-label">Medium (default): {sliderValue[0]}</p>
					<Slider bind:value={sliderValue} size="md" min={0} max={100} />
				</div>
				<div style="width: 100%;">
					<p class="slider-label">Large: {sliderLgValue[0]}</p>
					<Slider bind:value={sliderLgValue} size="lg" min={0} max={100} />
				</div>
			</VariantGrid>
		</DemoCard>

		<!-- Slider Range -->
		<DemoCard title="Slider Range" description="Two thumbs for range selection">
			<VariantGrid layout="grid">
				<div style="width: 100%;">
					<p class="slider-label">Range: {rangeValue[0]} - {rangeValue[1]}</p>
					<Slider bind:value={rangeValue} min={0} max={100} step={1} />
				</div>
			</VariantGrid>
		</DemoCard>

		<!-- Calendar -->
		<DemoCard title="Calendar" description="Date selection calendar">
			<Calendar />
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

	.slider-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-3) 0;
		font-weight: 500;
	}
</style>
