<script lang="ts">
	import { Calendar as CalendarPrimitive } from 'bits-ui';
	import { cn } from '$lib/utils/cn';
	import {
		calendarRootVariants,
		calendarHeaderVariants,
		calendarHeadingVariants,
		calendarNavButtonVariants,
		calendarGridVariants,
		calendarHeadCellVariants,
		calendarCellVariants,
		calendarDayVariants
	} from './calendar';
	import type { DateValue } from '@internationalized/date';

	interface Props {
		value?: DateValue;
		placeholder?: DateValue;
		weekdayFormat?: 'narrow' | 'short' | 'long';
		fixedWeeks?: boolean;
		class?: string;
	}

	let {
		value = $bindable(),
		placeholder,
		weekdayFormat = 'short',
		fixedWeeks = false,
		class: className
	}: Props = $props();
</script>

<CalendarPrimitive.Root
	bind:value
	{placeholder}
	{weekdayFormat}
	{fixedWeeks}
	class={cn(calendarRootVariants(), className)}
>
	{#snippet children({ months, weekdays })}
		{#each months as month}
			<CalendarPrimitive.Header class={calendarHeaderVariants()}>
				<CalendarPrimitive.PrevButton class={calendarNavButtonVariants()}>
					<span class="i-lucide-chevron-left h-4 w-4" aria-hidden="true" />
					<span class="sr-only">Previous month</span>
				</CalendarPrimitive.PrevButton>

				<CalendarPrimitive.Heading class={calendarHeadingVariants()} />

				<CalendarPrimitive.NextButton class={calendarNavButtonVariants()}>
					<span class="i-lucide-chevron-right h-4 w-4" aria-hidden="true" />
					<span class="sr-only">Next month</span>
				</CalendarPrimitive.NextButton>
			</CalendarPrimitive.Header>

			<CalendarPrimitive.Grid class={calendarGridVariants()}>
				<CalendarPrimitive.GridHead>
					<CalendarPrimitive.GridRow class="flex">
						{#each weekdays as weekday}
							<CalendarPrimitive.HeadCell class={calendarHeadCellVariants()}>
								{weekday.slice(0, 2)}
							</CalendarPrimitive.HeadCell>
						{/each}
					</CalendarPrimitive.GridRow>
				</CalendarPrimitive.GridHead>

				<CalendarPrimitive.GridBody>
					{#each month.weeks as weekDates}
						<CalendarPrimitive.GridRow class="flex">
							{#each weekDates as date}
								<CalendarPrimitive.Cell
									{date}
									month={month.value}
									class={calendarCellVariants()}
								>
									<CalendarPrimitive.Day
										class={calendarDayVariants()}
									>
										{date.day}
									</CalendarPrimitive.Day>
								</CalendarPrimitive.Cell>
							{/each}
						</CalendarPrimitive.GridRow>
					{/each}
				</CalendarPrimitive.GridBody>
			</CalendarPrimitive.Grid>
		{/each}
	{/snippet}
</CalendarPrimitive.Root>

<style>
	:global([data-selected] [data-bits-day]) {
		background: hsl(var(--color-primary));
		color: white;
	}
	:global([data-selected] [data-bits-day]:hover) {
		background: hsl(var(--color-primary-hover));
		color: white;
	}
	:global([data-today] [data-bits-day]) {
		background: hsl(var(--color-subtle));
		font-weight: 600;
	}
	:global([data-disabled] [data-bits-day]) {
		opacity: 0.5;
		pointer-events: none;
	}
	:global([data-unavailable] [data-bits-day]) {
		text-decoration: line-through;
		opacity: 0.5;
	}
	:global([data-outside-month] [data-bits-day]) {
		color: hsl(var(--color-muted));
		opacity: 0.5;
	}
</style>
