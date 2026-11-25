<script lang="ts">
/**
 * One component of a generative surface, rendered with the v10r component it maps to — the
 * catalog (`#lib/generative-ui/catalog.ts`) on one side, `#lib/components/` on the other.
 * Recursive: containers render their child nodes with this component.
 *
 * Text only. Every string the model wrote reaches the page through `{…}` interpolation, never
 * raw-HTML tags, so markup in a label is shown as characters.
 */
import type { ComponentNode } from '@a2ui/web_core';
import { Alert } from '#lib/components/composites/alert/index.ts';
import { Card } from '#lib/components/composites/card/index.ts';
import { FormField } from '#lib/components/composites/form-field/index.ts';
import {
	Accordion,
	Badge,
	Body,
	Button,
	Cell,
	Checkbox,
	Divider,
	Header,
	HeaderCell,
	Input,
	Progress,
	Row,
	Select,
	Skeleton,
	Slider,
	Switch,
	Table,
	Textarea,
	Typography,
} from '#lib/components/primitives/index.ts';
import GenerativeSurfaceNode from './GenerativeSurfaceNode.svelte';
import type { GenerativeSurfaceLabels } from './labels.ts';
import {
	actionOf,
	booleanOf,
	chartSeriesOf,
	childOf,
	childrenOf,
	flowNodesOf,
	numberOf,
	optionsOf,
	setterOf,
	stringListOf,
	tableRowsOf,
	textOf,
} from './node-props.ts';
import { readSignal } from './signal-reader.svelte.ts';

interface Props {
	node: ComponentNode;
	labels: GenerativeSurfaceLabels;
}

let { node, labels }: Props = $props();

const uid = $props.id();
const reader = $derived(readSignal(node.props));
const p = $derived(reader.current as Record<string, unknown>);

// @unocss-include
const GAPS: Record<string, string> = { tight: 'gap-2', normal: 'gap-3', loose: 'gap-5' };
const JUSTIFY: Record<string, string> = {
	start: 'justify-start',
	center: 'justify-center',
	end: 'justify-end',
	spaceBetween: 'justify-between',
};
const BADGE_TONES = {
	neutral: 'secondary',
	info: 'default',
	success: 'success',
	warning: 'warning',
	error: 'error',
} as const;
const BUTTON_VARIANTS = { primary: 'primary', default: 'outline', borderless: 'ghost' } as const;
const NOTICE_TONES = new Set(['info', 'success', 'warning', 'error'] as const);
type NoticeTone = typeof NOTICE_TONES extends Set<infer T> ? T : never;
const noticeTone = (tone: string): NoticeTone => (NOTICE_TONES.has(tone as NoticeTone) ? (tone as NoticeTone) : 'info');
const HEADINGS = {
	2: { as: 'h2', variant: 'h4' },
	3: { as: 'h3', variant: 'h5' },
	4: { as: 'h4', variant: 'h6' },
} as const;

const heading = $derived(HEADINGS[numberOf(p.level, 3) as 2 | 3 | 4] ?? HEADINGS[3]);
const selected = $derived(stringListOf(p.value));
const setList = $derived(setterOf<string[]>(p.value));
</script>

{#if node.state === 'pending' || node.isPlaceholder}
	<div class="flex flex-col gap-1" aria-hidden="true">
		<Skeleton variant="text" />
	</div>
	<span class="sr-only">{labels.pending}</span>
{:else if node.state !== 'resolved'}
	<p class="text-fluid-sm text-muted" role="note" data-generative-fallback={node.state}>
		{labels.unsupported(node.type)}
	</p>
{:else if node.type === 'Column'}
	<div class={['flex flex-col', GAPS[textOf(p.gap)] ?? GAPS.normal]}>
		{#each childrenOf(p.children) as child (child.instanceId)}
			<GenerativeSurfaceNode node={child} {labels} />
		{/each}
	</div>
{:else if node.type === 'Row'}
	<div class={['flex flex-wrap items-center gap-3', JUSTIFY[textOf(p.justify)] ?? JUSTIFY.start]}>
		{#each childrenOf(p.children) as child (child.instanceId)}
			<GenerativeSurfaceNode node={child} {labels} />
		{/each}
	</div>
{:else if node.type === 'Card'}
	{@const title = textOf(p.title)}
	{@const child = childOf(p.child)}
	<Card>
		{#snippet header()}
			{#if title}
				<Typography as="h3" variant="h5">{title}</Typography>
			{/if}
		{/snippet}
		{#if child}
			<GenerativeSurfaceNode node={child} {labels} />
		{/if}
	</Card>
{:else if node.type === 'Expandable'}
	{@const child = childOf(p.child)}
	{#snippet section()}
		{#if child}
			<GenerativeSurfaceNode node={child} {labels} />
		{/if}
	{/snippet}
	<Accordion value={booleanOf(p.open) ? 'section' : ''} items={[{ value: 'section', title: textOf(p.title), content: section }]} />
{:else if node.type === 'Notice'}
	<!-- An empty notice is a slot the model fills later (validation feedback): nothing to show yet. -->
	{#if textOf(p.text) || textOf(p.title)}
		<Alert variant={noticeTone(textOf(p.tone))} title={textOf(p.title) || undefined} description={textOf(p.text)} />
	{/if}
{:else if node.type === 'Heading'}
	<Typography as={heading.as} variant={heading.variant}>{textOf(p.text)}</Typography>
{:else if node.type === 'Text'}
	<Typography as="p" variant={textOf(p.variant) === 'caption' ? 'muted' : 'body'}>{textOf(p.text)}</Typography>
{:else if node.type === 'Badge'}
	<Badge variant={BADGE_TONES[textOf(p.tone) as keyof typeof BADGE_TONES] ?? 'secondary'}>{textOf(p.text)}</Badge>
{:else if node.type === 'Divider'}
	<Divider />
{:else if node.type === 'TextField'}
	{@const set = setterOf<string>(p.value)}
	{@const fieldError = textOf(p.error)}
	<FormField label={textOf(p.label)} id={uid} error={fieldError || undefined}>
		{#snippet children({ fieldId, describedBy })}
			{#if textOf(p.variant) === 'longText'}
				<Textarea
					id={fieldId}
					error={!!fieldError}
					aria-describedby={describedBy}
					placeholder={textOf(p.placeholder) || undefined}
					bind:value={() => textOf(p.value), set}
				/>
			{:else}
				<Input
					id={fieldId}
					error={!!fieldError}
					aria-describedby={describedBy}
					placeholder={textOf(p.placeholder) || undefined}
					bind:value={() => textOf(p.value), (next) => set(next ?? '')}
				/>
			{/if}
		{/snippet}
	</FormField>
{:else if node.type === 'Slider'}
	{@const set = setterOf<number>(p.value)}
	{@const min = numberOf(p.min, 0)}
	{@const max = numberOf(p.max, 100)}
	{@const value = numberOf(p.value, min)}
	<div class="flex flex-col gap-2">
		<div class="flex items-baseline justify-between gap-3 text-fluid-sm">
			<span class="font-medium text-fg">{textOf(p.label)}</span>
			<output class="text-muted">{value}</output>
		</div>
		<Slider
			label={textOf(p.label)}
			{min}
			{max}
			step={numberOf(p.step, 1)}
			bind:value={() => [value], (next) => set(next[0] ?? min)}
		/>
	</div>
{:else if node.type === 'ChoicePicker'}
	{@const options = optionsOf(p.options)}
	{#if textOf(p.variant) === 'multipleSelection'}
		<fieldset class="flex flex-col gap-2">
			<legend class="mb-2 text-fluid-sm font-medium text-fg">{textOf(p.label)}</legend>
			{#each options as option (option.value)}
				<Checkbox
					label={option.label}
					bind:checked={
						() => selected.includes(option.value),
						(on) => setList(on ? [...selected, option.value] : selected.filter((v) => v !== option.value))
					}
				/>
			{/each}
		</fieldset>
	{:else}
		<FormField label={textOf(p.label)} id={uid}>
			{#snippet children({ fieldId })}
				<Select id={fieldId} {options} bind:value={() => selected[0] ?? '', (next) => setList(next ? [next] : [])} />
			{/snippet}
		</FormField>
	{/if}
{:else if node.type === 'CheckBox'}
	{@const set = setterOf<boolean>(p.value)}
	{#if textOf(p.variant) === 'switch'}
		<Switch id={uid} label={textOf(p.label)} bind:checked={() => booleanOf(p.value), set} />
	{:else}
		<Checkbox label={textOf(p.label)} bind:checked={() => booleanOf(p.value), set} />
	{/if}
{:else if node.type === 'Button'}
	{@const press = actionOf(p.action)}
	<Button
		type="button"
		variant={BUTTON_VARIANTS[textOf(p.variant) as keyof typeof BUTTON_VARIANTS] ?? 'outline'}
		disabled={!press}
		onclick={press}
	>
		{textOf(p.label)}
	</Button>
{:else if node.type === 'Table'}
	{@const columns = tableRowsOf([p.columns])[0] ?? []}
	{@const caption = textOf(p.caption)}
	<Table>
		{#if caption}
			<caption class="mt-2 text-fluid-xs text-muted">{caption}</caption>
		{/if}
		<Header>
			<Row>
				{#each columns as column, index (index)}
					<HeaderCell>{column}</HeaderCell>
				{/each}
			</Row>
		</Header>
		<Body>
			{#each tableRowsOf(p.rows) as row, rowIndex (rowIndex)}
				<Row>
					{#each columns as _, index (index)}
						<Cell>{row[index] ?? ''}</Cell>
					{/each}
				</Row>
			{/each}
		</Body>
	</Table>
{:else if node.type === 'Chart'}
	{@const chartLabels = tableRowsOf([p.labels])[0] ?? []}
	{@const series = chartSeriesOf(p.series, chartLabels.length)}
	{@const peak = Math.max(0, ...series.flatMap((s) => s.values))}
	<!-- A bar chart that is a data table: each value cell carries its bar (from zero, scaled to
	     the largest value) and prints the number, so the chart's text alternative is its own
	     data, read row by row. Bars are decoration; colour is never the only signal. -->
	<Table class="caption-top" data-generative-chart>
		<caption class="mb-2 text-left text-fluid-sm font-medium text-fg">{textOf(p.title)}</caption>
		<Header>
			<Row>
				<HeaderCell><span class="sr-only">{labels.chartCategory}</span></HeaderCell>
				{#each series as s, index (index)}
					<HeaderCell>
						<span class="inline-flex items-center gap-1">
							<span class="inline-block h-2 w-2 rounded-full" style={`background-color: var(--chart-${index + 1})`} aria-hidden="true"></span>
							{s.name}
						</span>
					</HeaderCell>
				{/each}
			</Row>
		</Header>
		<Body>
			{#each chartLabels as label, row (row)}
				<Row>
					<HeaderCell>{label}</HeaderCell>
					{#each series as s, index (index)}
						{@const value = s.values[row] ?? 0}
						<Cell>
							<span class="flex items-center gap-2">
								<span
									class="inline-block h-3 rounded-sm"
									style={`width: ${peak > 0 ? Math.max(2, (value / peak) * 100) : 0}%; min-width: 2px; max-width: 8rem; background-color: var(--chart-${index + 1})`}
									aria-hidden="true"
								></span>
								<span class="tabular-nums">{value}</span>
							</span>
						</Cell>
					{/each}
				</Row>
			{/each}
		</Body>
	</Table>
{:else if node.type === 'Progress'}
	{@const max = Math.max(numberOf(p.max, 100), Number.MIN_VALUE)}
	{@const value = Math.min(Math.max(numberOf(p.value, 0), 0), max)}
	<div class="flex flex-col gap-1">
		<div class="flex items-baseline justify-between gap-3 text-fluid-sm">
			<span class="font-medium text-fg">{textOf(p.label)}</span>
			<span class="text-muted">{Math.round((value / max) * 100)}%</span>
		</div>
		<Progress {value} {max} label={textOf(p.label)} />
	</div>
{:else if node.type === 'ArchitectureFlow'}
	{@const title = textOf(p.title)}
	<figure class="flex flex-col gap-2" data-generative-flow>
		<figcaption class="text-fluid-sm font-medium text-fg">{title}</figcaption>
		<ol class="flex flex-col gap-1" aria-label={title}>
			{#each flowNodesOf(p.nodes) as flowNode, index (index)}
				<li class="flex flex-col items-start gap-1">
					{#if index > 0}
						<span class="i-lucide-arrow-down ml-3 h-4 w-4 text-muted" aria-hidden="true"></span>
					{/if}
					<div class="flex w-full flex-col gap-1 rounded-md border border-border px-3 py-2">
						<div class="flex flex-wrap items-center gap-2">
							<span class="text-fluid-sm font-medium text-fg">{flowNode.label}</span>
							<Badge variant="secondary">{labels.flowKind(flowNode.kind)}</Badge>
						</div>
						{#if flowNode.note}
							<span class="text-fluid-xs text-muted">{flowNode.note}</span>
						{/if}
					</div>
				</li>
			{/each}
		</ol>
	</figure>
{:else}
	<p class="text-fluid-sm text-muted" role="note" data-generative-fallback="unknown-type">
		{labels.unsupported(node.type)}
	</p>
{/if}
