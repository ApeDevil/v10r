<script lang="ts">
import {
	Badge,
	Body,
	Button,
	Cell,
	Header,
	HeaderCell,
	Row,
	Select,
	Table,
	ToggleGroup,
} from '#lib/components/primitives/index.ts';
import {
	type AttributeDictionary,
	type AttributeProjection,
	type AttributeRecord,
	checkProjectionImpact,
	dictionaryAt,
	latestRevision,
	type Projection,
	type ProjectionImpact,
	projectRecord,
} from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { showcaseKinds } from '#lib/showcases/dynamic-attributes/showcase-records.ts';

/**
 * One consumer of the product source: its projection applied to the selected product (and, for
 * a flat feed, to every product), the pin it reads the dictionary at, and what moving that pin
 * would change. Rendering honours the projection's hints; the data view shows exactly what the
 * consumer would receive.
 */
interface Props {
	projection: AttributeProjection;
	dictionary: AttributeDictionary;
	/** The product being edited. */
	record: AttributeRecord;
	/** Every product, for outputs that carry many rows. */
	records: { name: string; record: AttributeRecord }[];
	onrepin: (revision: number) => void;
}

let { projection, dictionary, record, records, onrepin }: Props = $props();

let view = $state('rendered');
const latest = $derived(latestRevision(dictionary).revision);
const pinned = $derived(projection.dictionaryRevision);
const projected: Projection = $derived(projectRecord(record, dictionary, projection, showcaseKinds));
const rows = $derived(
	projection.output === 'row' ? records.map((r) => projectRecord(r.record, dictionary, projection, showcaseKinds)) : [],
);
const impact: ProjectionImpact[] = $derived(checkProjectionImpact(dictionary, projection));
const pinOptions = $derived(
	dictionary.revisions.map((r) => ({
		value: String(r.revision),
		label:
			r.revision === latest
				? m.showcase_dynamic_attributes_revision_latest({ revision: r.revision })
				: `r${r.revision}`,
	})),
);
const grouped = $derived.by(() => {
	const groups = new Map<string, Projection['fields']>();
	for (const field of projected.fields) {
		const key = field.render.group ?? '';
		groups.set(key, [...(groups.get(key) ?? []), field]);
	}
	return [...groups.entries()];
});
const dataText = $derived(
	projection.output === 'object'
		? JSON.stringify(projected.document, null, 2)
		: projection.output === 'row'
			? csv([projection.fields.map((f) => f.as), ...rows.map((r) => r.fields.map((f) => f.text))])
			: projected.text,
);

function csv(lines: string[][]): string {
	const cell = (text: string) => (/[",\n|]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
	return lines.map((line) => line.map(cell).join(',')).join('\n');
}

const severityVariant = { info: 'secondary', warning: 'warning', breaking: 'error' } as const;

function impactText(item: ProjectionImpact): string {
	const field = item.field || item.after || item.definition;
	switch (item.code) {
		case 'label_changed':
			return m.showcase_dynamic_attributes_impact_label({ field, before: item.before ?? '', after: item.after ?? '' });
		case 'unit_changed':
			return item.severity === 'warning'
				? m.showcase_dynamic_attributes_impact_unit_unhandled({
						field,
						before: item.before ?? '',
						after: item.after ?? '',
					})
				: m.showcase_dynamic_attributes_impact_unit({ field, before: item.before ?? '', after: item.after ?? '' });
		case 'kind_changed':
			return m.showcase_dynamic_attributes_impact_kind({ field, before: item.before ?? '', after: item.after ?? '' });
		case 'options_changed':
			return m.showcase_dynamic_attributes_impact_options({ field });
		case 'unmapped_option':
			return m.showcase_dynamic_attributes_impact_unmapped({ field, option: item.after ?? '' });
		case 'deprecated':
			return m.showcase_dynamic_attributes_impact_deprecated({ field });
		case 'retired':
			return m.showcase_dynamic_attributes_impact_retired({ field });
		case 'new_definition':
			return m.showcase_dynamic_attributes_impact_new({ label: item.after ?? '' });
	}
}

function findingText(code: Projection['findings'][number]['code'], field: string): string {
	switch (code) {
		case 'no_value':
			return m.showcase_dynamic_attributes_finding_no_value({ field });
		case 'not_converted':
			return m.showcase_dynamic_attributes_finding_not_converted({ field });
		case 'step_skipped':
			return m.showcase_dynamic_attributes_finding_step_skipped({ field });
		default:
			return m.showcase_dynamic_attributes_finding_definition({ field });
	}
}

const outputLabel = $derived(
	projection.output === 'object'
		? m.showcase_dynamic_attributes_output_object()
		: projection.output === 'row'
			? m.showcase_dynamic_attributes_output_row()
			: m.showcase_dynamic_attributes_output_text(),
);
const note = $derived(dictionaryAt(dictionary, pinned)?.note ?? '');
</script>

<article class="consumer" aria-labelledby="consumer-{projection.consumer}">
	<header class="consumer-head">
		<h3 id="consumer-{projection.consumer}" class="consumer-name">{projection.name}</h3>
		<div class="meta text-fluid-xs text-muted">
			<span>{outputLabel}</span>
			<span aria-hidden="true">·</span>
			<span>{projection.locale.toUpperCase()}</span>
		</div>
	</header>

	<div class="pin">
		<Select
			class="pin-select"
			aria-label={m.showcase_dynamic_attributes_pin_aria({ consumer: projection.name })}
			options={pinOptions}
			value={String(pinned)}
			onchange={(next) => onrepin(Number(next))}
		/>
		{#if pinned < latest}
			<Badge variant="warning">{m.showcase_dynamic_attributes_pin_behind({ count: latest - pinned })}</Badge>
		{:else}
			<Badge variant="success">{m.showcase_dynamic_attributes_pin_current()}</Badge>
		{/if}
	</div>
	<p class="text-fluid-xs text-muted pin-note">{note}</p>

	<ToggleGroup
		size="sm"
		bind:value={view}
		items={[
			{ value: 'rendered', label: m.showcase_dynamic_attributes_view_rendered() },
			{ value: 'data', label: m.showcase_dynamic_attributes_view_data() },
		]}
	/>

	{#if view === 'rendered'}
		<div class="rendered">
			{#if projection.output === 'row'}
				<Table aria-label={projection.name}>
					<Header>
						<Row>
							<HeaderCell>{m.showcase_dynamic_attributes_column()}</HeaderCell>
							<HeaderCell>{m.showcase_dynamic_attributes_value()}</HeaderCell>
						</Row>
					</Header>
					<Body>
						{#each projected.fields as field (field.as)}
							<Row>
								<Cell><code>{field.as}</code></Cell>
								<Cell>{field.text}</Cell>
							</Row>
						{/each}
					</Body>
				</Table>
			{:else}
				{#each grouped as [group, fields] (group)}
					{#if group}
						<p class="group text-fluid-xs">{group}</p>
					{/if}
					<dl>
						{#each fields as field (field.as)}
							{#if field.render.display === 'heading'}
								<dt class="sr-only">{field.label}</dt>
								<dd class="heading">{field.text}</dd>
							{:else}
								<dt class="text-fluid-xs text-muted">{field.label}</dt>
								<dd class:strong={field.render.emphasis === 'strong'} class:muted={field.render.emphasis === 'muted'}>
									{#if field.text === ''}
										<span class="text-muted">—</span>
									{:else if field.render.display === 'badge'}
										<Badge>{field.text}</Badge>
									{:else if field.render.display === 'list' && Array.isArray(field.value)}
										<ul>
											{#each field.value as item, i (i)}
												<li>{String(item)}</li>
											{/each}
										</ul>
									{:else if typeof field.value === 'boolean'}
										{field.value ? m.attributes_boolean_yes() : m.attributes_boolean_no()}
									{:else if field.unit}
										{field.text} {field.unit}
									{:else}
										{field.text}
									{/if}
								</dd>
							{/if}
						{/each}
					</dl>
				{/each}
			{/if}
		</div>
	{:else}
		<pre class="data" aria-label={m.showcase_dynamic_attributes_view_data()}>{dataText}</pre>
	{/if}

	{#if projected.findings.length > 0}
		<ul class="findings text-fluid-xs text-muted">
			{#each projected.findings as finding, i (i)}
				<li>{findingText(finding.code, finding.field)}</li>
			{/each}
		</ul>
	{/if}

	{#if impact.length > 0}
		<section class="impact" aria-label={m.showcase_dynamic_attributes_impact_heading({ revision: latest })}>
			<p class="text-fluid-sm impact-title">{m.showcase_dynamic_attributes_impact_heading({ revision: latest })}</p>
			<ul>
				{#each impact as item, i (i)}
					<li class="text-fluid-xs">
						<Badge variant={severityVariant[item.severity]}>{item.severity}</Badge>
						<span>{impactText(item)}</span>
					</li>
				{/each}
			</ul>
			<Button size="sm" variant="outline" onclick={() => onrepin(latest)}>
				{m.showcase_dynamic_attributes_pin_move({ revision: latest })}
			</Button>
		</section>
	{/if}

	<details class="source">
		<summary class="text-fluid-xs">{m.showcase_dynamic_attributes_projection_json()}</summary>
		<pre class="data">{JSON.stringify(projection, null, 2)}</pre>
	</details>
</article>

<style>
	.consumer {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	.consumer-name {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}

	.consumer-head {
		display: grid;
		gap: var(--spacing-1);
	}

	.meta,
	.pin {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.pin :global(.pin-select) {
		width: 9rem;
	}

	.pin-note {
		margin: 0;
	}

	.rendered {
		min-height: 6rem;
	}

	dl {
		display: grid;
		grid-template-columns: minmax(6rem, auto) 1fr;
		gap: var(--spacing-1) var(--spacing-3);
		margin: 0 0 var(--spacing-3);
		overflow-wrap: anywhere;
	}

	dt {
		padding-top: 0.15em;
	}

	dd {
		margin: 0;
	}

	dd.heading {
		grid-column: 1 / -1;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}

	dd.strong {
		font-weight: 600;
	}

	dd.muted {
		color: var(--color-muted);
	}

	dd ul {
		margin: 0;
		padding-left: var(--spacing-4);
	}

	.group {
		margin: var(--spacing-2) 0 var(--spacing-1);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}

	.data {
		margin: 0;
		max-height: 18rem;
		overflow: auto;
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--surface-0);
		font-size: var(--text-fluid-xs);
		white-space: pre;
	}

	.findings,
	.impact ul {
		margin: 0;
		padding-left: var(--spacing-4);
		display: grid;
		gap: var(--spacing-1);
	}

	.impact {
		display: grid;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--surface-1);
	}

	.impact ul {
		list-style: none;
		padding: 0;
	}

	.impact li {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-2);
	}

	.impact-title {
		margin: 0;
		font-weight: 600;
	}

	.source summary {
		cursor: pointer;
		color: var(--color-muted);
	}
</style>
