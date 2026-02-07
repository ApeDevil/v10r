<script lang="ts">
	import { DatePicker as DatePickerPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		datePickerRootVariants,
		datePickerTriggerVariants,
		datePickerContentVariants,
		datePickerCalendarVariants,
		datePickerLabelVariants
	} from './date-picker';
	import type { DateValue } from '@internationalized/date';

	interface Props {
		value?: DateValue;
		placeholder?: DateValue;
		label?: string;
		disabled?: boolean;
		error?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		placeholder,
		label,
		disabled = false,
		error = false,
		class: className
	}: Props = $props();

	// Format the selected date for display
	function formatDate(date: DateValue | undefined): string {
		if (!date) return '';

		// Convert DateValue to a readable format
		// The DateValue interface has year, month, day properties
		const year = date.year;
		const month = String(date.month).padStart(2, '0');
		const day = String(date.day).padStart(2, '0');

		return `${month}/${day}/${year}`;
	}

	// Derived value for the trigger text
	let displayValue = $derived(formatDate(value));
</script>

<!--
	NOTE: This component requires @internationalized/date to be installed:
	bun add @internationalized/date
-->
<div class={cn(datePickerRootVariants(), className)}>
	{#if label}
		<label class={datePickerLabelVariants()}>
			{label}
		</label>
	{/if}

	<DatePickerPrimitive.Root bind:value {placeholder} {disabled}>
		<DatePickerPrimitive.Trigger
			class={datePickerTriggerVariants({ error })}
			aria-invalid={error ? 'true' : undefined}
		>
			<span class={displayValue ? 'text-fg' : 'text-muted'}>
				{displayValue || 'Pick a date'}
			</span>
			<span class="i-lucide-calendar h-4 w-4 text-muted" aria-hidden="true" />
		</DatePickerPrimitive.Trigger>

		<DatePickerPrimitive.Content
			sideOffset={4}
			class={datePickerContentVariants()}
		>
			<DatePickerPrimitive.Calendar
				class={datePickerCalendarVariants()}
				let:months
				let:weekdays
			>
				{#each months as month}
					<div class="space-y-4">
						<DatePickerPrimitive.Header class="flex items-center justify-between">
							<DatePickerPrimitive.PrevButton
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-fg-alpha hover:text-fg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
							>
								<span class="i-lucide-chevron-left h-4 w-4" aria-hidden="true" />
								<span class="sr-only">Previous month</span>
							</DatePickerPrimitive.PrevButton>

							<DatePickerPrimitive.Heading
								class="text-fluid-base font-semibold text-fg"
							/>

							<DatePickerPrimitive.NextButton
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-fg-alpha hover:text-fg transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50"
							>
								<span class="i-lucide-chevron-right h-4 w-4" aria-hidden="true" />
								<span class="sr-only">Next month</span>
							</DatePickerPrimitive.NextButton>
						</DatePickerPrimitive.Header>

						<DatePickerPrimitive.Grid class="w-full border-collapse text-fluid-sm">
							<DatePickerPrimitive.GridHead>
								<DatePickerPrimitive.GridRow class="flex">
									{#each weekdays as weekday}
										<DatePickerPrimitive.HeadCell
											class="w-9 h-9 text-muted font-medium text-center pb-2"
										>
											{weekday.slice(0, 2)}
										</DatePickerPrimitive.HeadCell>
									{/each}
								</DatePickerPrimitive.GridRow>
							</DatePickerPrimitive.GridHead>

							<DatePickerPrimitive.GridBody>
								{#each month.weeks as weekDates}
									<DatePickerPrimitive.GridRow class="flex mt-1">
										{#each weekDates as date}
											<DatePickerPrimitive.Cell
												{date}
												class="relative h-9 w-9 p-0 text-center text-fluid-sm focus-within:relative focus-within:z-20"
											>
												<DatePickerPrimitive.Day
													{date}
													month={month.value}
													class="inline-flex h-9 w-9 items-center justify-center rounded-md font-normal transition-colors duration-fast hover:bg-fg-alpha hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 data-[selected]:bg-primary data-[selected]:text-white data-[selected]:hover:bg-primary-hover data-[selected]:hover:text-white data-[today]:bg-subtle data-[today]:font-semibold data-[outside-month]:text-muted data-[outside-month]:opacity-50 data-[disabled]:text-muted data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed data-[unavailable]:text-muted data-[unavailable]:line-through data-[unavailable]:opacity-50"
												>
													{date.day}
												</DatePickerPrimitive.Day>
											</DatePickerPrimitive.Cell>
										{/each}
									</DatePickerPrimitive.GridRow>
								{/each}
							</DatePickerPrimitive.GridBody>
						</DatePickerPrimitive.Grid>
					</div>
				{/each}
			</DatePickerPrimitive.Calendar>
		</DatePickerPrimitive.Content>
	</DatePickerPrimitive.Root>
</div>
