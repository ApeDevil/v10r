<script lang="ts">
	import {
		Button,
		Input,
		Badge,
		Avatar,
		Select,
		Checkbox,
		Card,
		FormField,
		Toggle,
		ToggleGroup
	} from '$lib/components';

	let inputValue = $state('');
	let selectValue = $state('');
	let checkboxValue = $state(false);
	let togglePressed = $state(false);
	let boldPressed = $state(false);
	let italicPressed = $state(false);
	let underlinePressed = $state(false);
	let alignValue = $state('left');
	let selectedFormats = $state<string[]>([]);

	const selectOptions = [
		{ value: 'option1', label: 'Option 1' },
		{ value: 'option2', label: 'Option 2' },
		{ value: 'option3', label: 'Option 3', disabled: true }
	];
</script>

<div class="container mx-auto p-8 space-y-8">
	<h1 class="text-fluid-4xl font-bold">Component Test</h1>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Buttons</h2>
		<div class="flex flex-wrap gap-3">
			<Button variant="default">Default</Button>
			<Button variant="secondary">Secondary</Button>
			<Button variant="outline">Outline</Button>
			<Button variant="ghost">Ghost</Button>
			<Button variant="destructive">Destructive</Button>
		</div>
		<div class="flex flex-wrap gap-3">
			<Button size="sm">Small</Button>
			<Button size="md">Medium</Button>
			<Button size="lg">Large</Button>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Input</h2>
		<Input bind:value={inputValue} placeholder="Enter text..." />
		<Input bind:value={inputValue} placeholder="With error" error={true} />
		<Input placeholder="Disabled" disabled />
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Badges</h2>
		<div class="flex flex-wrap gap-2">
			<Badge variant="default">Default</Badge>
			<Badge variant="secondary">Secondary</Badge>
			<Badge variant="success">Success</Badge>
			<Badge variant="warning">Warning</Badge>
			<Badge variant="error">Error</Badge>
			<Badge variant="outline">Outline</Badge>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Avatars</h2>
		<div class="flex items-center gap-4">
			<Avatar size="sm" fallback="AB" />
			<Avatar size="md" fallback="John Doe" />
			<Avatar size="lg" fallback="Jane Smith" />
			<Avatar
				size="md"
				src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
				fallback="Felix"
			/>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Select</h2>
		<Select bind:value={selectValue} options={selectOptions} placeholder="Choose an option" />
		<p class="text-sm text-muted">Selected: {selectValue || 'none'}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Checkbox</h2>
		<Checkbox bind:checked={checkboxValue} label="Accept terms and conditions" />
		<Checkbox checked={true} disabled label="Disabled checkbox" />
		<p class="text-sm text-muted">Checked: {checkboxValue}</p>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Card</h2>
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-lg font-semibold">Card Title</h3>
			{/snippet}

			<p class="text-muted">
				This is the card content. Cards can have headers, footers, and body content.
			</p>

			{#snippet footer()}
				<div class="flex gap-2">
					<Button size="sm" variant="outline">Cancel</Button>
					<Button size="sm">Save</Button>
				</div>
			{/snippet}
		</Card>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">FormField</h2>
		<FormField
			label="Email address"
			description="We'll never share your email with anyone else."
			required
		>
			<Input type="email" placeholder="you@example.com" />
		</FormField>

		<FormField label="Password" error="Password must be at least 8 characters" required>
			<Input type="password" placeholder="Enter password" error={true} />
		</FormField>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Toggle</h2>
		<div class="space-y-3">
			<div class="flex items-center gap-3">
				<Toggle bind:pressed={togglePressed}>
					Default
				</Toggle>
				<p class="text-sm text-muted">Pressed: {togglePressed}</p>
			</div>

			<div class="flex items-center gap-3">
				<Toggle bind:pressed={boldPressed} variant="outline">
					<strong>B</strong>
				</Toggle>
				<Toggle bind:pressed={italicPressed} variant="outline">
					<em>I</em>
				</Toggle>
				<Toggle bind:pressed={underlinePressed} variant="outline">
					<u>U</u>
				</Toggle>
			</div>

			<div class="flex items-center gap-3">
				<Toggle size="sm" variant="outline">Small</Toggle>
				<Toggle size="md" variant="outline">Medium</Toggle>
				<Toggle size="lg" variant="outline">Large</Toggle>
			</div>
		</div>
	</section>

	<section class="space-y-4">
		<h2 class="text-fluid-2xl font-semibold">Toggle Group</h2>
		<div class="space-y-3">
			<div>
				<p class="text-sm text-muted mb-2">Text alignment (single):</p>
				<ToggleGroup
					type="single"
					bind:value={alignValue}
					items={[
						{ value: 'left', label: 'Left' },
						{ value: 'center', label: 'Center' },
						{ value: 'right', label: 'Right' },
						{ value: 'justify', label: 'Justify' }
					]}
				/>
				<p class="text-sm text-muted mt-2">Selected: {alignValue || 'none'}</p>
			</div>

			<div>
				<p class="text-sm text-muted mb-2">Text formatting (multiple):</p>
				<ToggleGroup
					type="multiple"
					bind:value={selectedFormats}
					items={[
						{ value: 'bold', label: 'B' },
						{ value: 'italic', label: 'I' },
						{ value: 'underline', label: 'U' },
						{ value: 'strikethrough', label: 'S' }
					]}
					variant="outline"
				/>
				<p class="text-sm text-muted mt-2">Selected: {selectedFormats.join(', ') || 'none'}</p>
			</div>

			<div>
				<p class="text-sm text-muted mb-2">Vertical orientation:</p>
				<ToggleGroup
					type="single"
					orientation="vertical"
					items={[
						{ value: 'top', label: 'Top' },
						{ value: 'middle', label: 'Middle' },
						{ value: 'bottom', label: 'Bottom' }
					]}
				/>
			</div>

			<div>
				<p class="text-sm text-muted mb-2">Sizes:</p>
				<div class="flex flex-wrap gap-4">
					<ToggleGroup
						type="single"
						size="sm"
						items={[
							{ value: 'a', label: 'A' },
							{ value: 'b', label: 'B' },
							{ value: 'c', label: 'C' }
						]}
					/>
					<ToggleGroup
						type="single"
						size="md"
						items={[
							{ value: 'a', label: 'A' },
							{ value: 'b', label: 'B' },
							{ value: 'c', label: 'C' }
						]}
					/>
					<ToggleGroup
						type="single"
						size="lg"
						items={[
							{ value: 'a', label: 'A' },
							{ value: 'b', label: 'B' },
							{ value: 'c', label: 'C' }
						]}
					/>
				</div>
			</div>
		</div>
	</section>
</div>
