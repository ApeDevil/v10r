<script lang="ts">
import { onMount } from 'svelte';
import {
	AttributeEditor,
	acceptsAttributeRecord,
	createRecordSession,
	RecordSaveStatus,
	type RecordSession,
} from '#lib/components/composites/attributes/index.ts';
import { Card } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Badge, Button, Input, Select, ToggleGroup, Typography } from '#lib/components/primitives/index.ts';
import {
	type AttributeDefinition,
	type AttributeDictionary,
	type BindingSync,
	bindAttribute,
	checkRecordBindings,
	createAttributeEngine,
	DEFINITION_STATUSES,
	type DefinitionStatus,
	type DictionaryChange,
	type DictionaryRefusalCode,
	definitionLabel,
	dictionaryAt,
	diffDictionaryRevisions,
	latestRevision,
	promoteAttribute,
	reviseDictionary,
	syncRecordToDictionary,
	valueHistory,
} from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	CATALOG_DRAFT_NAMESPACE,
	CONSUMERS,
	catalogKeys,
	createCatalogDictionaryEngine,
	createProductStore,
	loadDictionary,
	loadPins,
	loadVersions,
	PRODUCTS,
	saveDictionary,
	savePins,
	seedProducts,
} from '#lib/showcases/dynamic-attributes/product-catalog.ts';
import { SHOWCASE_DRAFT_USER, showcaseKinds } from '#lib/showcases/dynamic-attributes/showcase-records.ts';
import { createDocumentDrafts, removeUserDocumentDrafts } from '#lib/state/document-drafts.ts';
import { MEASURE_UNITS } from '#lib/utils/measure.ts';
import ConsumerCard from './ConsumerCard.svelte';
import { showcaseControls } from './index.ts';

/**
 * One product source, many consumers: an attribute dictionary with its revision history, three
 * product records bound to it, and three consumers that project those records their own way.
 * Everything is in this browser; each product is a full record session like the writers above.
 */
const LOCALES = ['en', 'de'] as const;

interface Product {
	id: string;
	name: string;
	session: RecordSession;
	snapshot: RecordSession['autosave']['snapshot'];
}

let dictionary = $state.raw<AttributeDictionary | null>(null);
let pins = $state<Record<string, number>>({});
let products = $state.raw<Product[]>([]);
let selected = $state(PRODUCTS[0].id);
let failed = $state<'storage' | 'dictionary' | null>(null);
/** Bumped after each accepted save, so value history re-reads the stored versions. */
let saves = $state(0);

const engine = createAttributeEngine(showcaseKinds);
const dictionaryEngine = createCatalogDictionaryEngine();

onMount(() => {
	let loaded: AttributeDictionary | null;
	try {
		seedProducts(localStorage);
		loaded = loadDictionary(localStorage);
	} catch {
		failed = 'storage';
		return;
	}
	if (!loaded) {
		failed = 'dictionary';
		return;
	}
	dictionary = loaded;
	pins = loadPins(localStorage, latestRevision(loaded).revision);
	const opened = PRODUCTS.map((product): Product => {
		const session = createRecordSession({
			engine,
			store: createProductStore(() => localStorage, product.id),
			drafts: createDocumentDrafts(() => localStorage, {
				namespace: CATALOG_DRAFT_NAMESPACE,
				userId: SHOWCASE_DRAFT_USER,
				fileId: product.id,
				writerId: crypto.randomUUID(),
				accepts: acceptsAttributeRecord(engine),
			}),
		});
		return { ...product, session, snapshot: session.autosave.snapshot };
	});
	products = opened;
	const stops = opened.map((product, i) => {
		void product.session.autosave.refresh();
		let version = -1;
		return product.session.autosave.subscribe(() => {
			const snapshot = product.session.autosave.snapshot;
			products = products.map((p, j) => (j === i ? { ...p, snapshot } : p));
			const stored = product.session.autosave.draft.version;
			if (stored !== version) {
				version = stored;
				saves++;
			}
		});
	});
	return () => {
		for (const stop of stops) stop();
	};
});

function reset() {
	try {
		for (const key of catalogKeys()) localStorage.removeItem(key);
		removeUserDocumentDrafts(localStorage, CATALOG_DRAFT_NAMESPACE, SHOWCASE_DRAFT_USER);
	} finally {
		location.reload();
	}
}

// ── Dictionary ──────────────────────────────────────────────────────────────────────────

const latest = $derived(dictionary ? latestRevision(dictionary) : null);
/** The revision being looked at; null means the latest, which is also the one edits go to. */
let viewing = $state<number | null>(null);
const shown = $derived(dictionary && viewing !== null ? (dictionaryAt(dictionary, viewing) ?? latest) : latest);
const editable = $derived(shown !== null && shown === latest);
const revisionOptions = $derived(
	(dictionary?.revisions ?? [])
		.map((r) => ({ value: String(r.revision), label: `r${r.revision} · ${r.note}` }))
		.reverse(),
);
const changes = $derived(
	dictionary && shown && shown.revision > 1
		? diffDictionaryRevisions(dictionary, shown.revision - 1, shown.revision)
		: [],
);
let dictionaryRefusal = $state<DictionaryRefusalCode | null>(null);
let newLabel = $state('');
let newKind = $state('text');

function revise(change: DictionaryChange): boolean {
	if (!dictionary) return false;
	const result = reviseDictionary(dictionary, change, '', dictionaryEngine);
	if (!result.ok) {
		// Leaving a label as it was is not worth a message.
		dictionaryRefusal = result.refusal === 'unchanged' ? null : result.refusal;
		return false;
	}
	dictionaryRefusal = null;
	dictionary = result.dictionary;
	viewing = null;
	saveDictionary(localStorage, result.dictionary);
	return true;
}

function addDefinition() {
	if (revise({ op: 'add', kind: newKind, label: newLabel })) newLabel = '';
}

const kindOptions = $derived(
	showcaseKinds.ids.map((id) => ({ value: id, label: showcaseControls[id]?.label() ?? id })),
);
const unitOptions = [
	{ value: '', label: m.showcase_dynamic_attributes_unit_none() },
	...MEASURE_UNITS.map((u) => ({ value: u, label: u })),
];
const statusLabel: Record<DefinitionStatus, () => string> = {
	active: m.showcase_dynamic_attributes_status_active,
	deprecated: m.showcase_dynamic_attributes_status_deprecated,
	retired: m.showcase_dynamic_attributes_status_retired,
};
const statusOptions = DEFINITION_STATUSES.map((s) => ({ value: s, label: statusLabel[s]() }));

function refusalText(code: DictionaryRefusalCode): string {
	switch (code) {
		case 'invalid_label':
			return m.showcase_dynamic_attributes_dictionary_refusal_label();
		case 'retired':
			return m.showcase_dynamic_attributes_dictionary_refusal_retired();
		default:
			return m.showcase_dynamic_attributes_dictionary_refusal_generic();
	}
}

function partsText(parts: string[]): string {
	return parts
		.map((part) =>
			part === 'added'
				? m.showcase_dynamic_attributes_change_added()
				: part === 'labels'
					? m.showcase_dynamic_attributes_change_labels()
					: part === 'unit'
						? m.showcase_dynamic_attributes_change_unit()
						: part === 'status'
							? m.showcase_dynamic_attributes_change_status()
							: part === 'kind'
								? m.showcase_dynamic_attributes_change_kind()
								: m.showcase_dynamic_attributes_change_config(),
		)
		.join(', ');
}

function label(definition: AttributeDefinition): string {
	return dictionary ? definitionLabel(definition, 'en', dictionary.sourceLocale) : '';
}

// ── Products ────────────────────────────────────────────────────────────────────────────

const product = $derived(products.find((p) => p.id === selected));
const editor = $derived(product?.session.editor);
const findings = $derived(dictionary && editor ? checkRecordBindings(editor.record, dictionary) : []);
const stale = $derived(findings.filter((f) => f.code === 'stale_binding').length);
let synced = $state.raw<BindingSync[] | null>(null);
let bindChoice = $state('');
let promoteChoice = $state('');
let historyKey = $state('');

const unbound = $derived(
	latest && editor
		? latest.definitions.filter(
				(d) => d.status !== 'retired' && !editor.record.attributes.some((a) => a.binding?.definition === d.id),
			)
		: [],
);
const locals = $derived(editor ? editor.record.attributes.filter((a) => !a.binding) : []);

function sync() {
	if (!dictionary || !editor) return;
	const current = dictionary;
	let outcome: BindingSync[] = [];
	editor.run((record) => {
		const result = syncRecordToDictionary(record, current, engine);
		outcome = result.changes;
		return { ok: true, record: result.record, attributeId: '' };
	});
	synced = outcome;
}

function bind() {
	if (!dictionary || !editor || !bindChoice) return;
	const current = dictionary;
	if (editor.run((record) => bindAttribute(record, current, bindChoice, engine)) !== null) bindChoice = '';
}

function promote() {
	if (!dictionary || !editor || !promoteChoice) return;
	const result = promoteAttribute(editor.record, dictionary, promoteChoice, dictionaryEngine);
	if (!result.ok) {
		dictionaryRefusal = result.refusal;
		return;
	}
	dictionary = result.dictionary;
	saveDictionary(localStorage, result.dictionary);
	editor.run(() => ({ ok: true, record: result.record, attributeId: promoteChoice }));
	promoteChoice = '';
}

function selectProduct(id: string) {
	selected = id;
	synced = null;
	historyKey = '';
}

const historyOptions = $derived(
	editor
		? editor.record.attributes.map((a) => ({
				value: a.binding?.definition ?? a.id,
				label: a.label || m.attributes_unlabelled(),
			}))
		: [],
);
const history = $derived.by(() => {
	void saves;
	if (!product || !historyKey) return [];
	try {
		return valueHistory(loadVersions(localStorage, product.id), historyKey, showcaseKinds).reverse();
	} catch {
		return [];
	}
});

function syncText(change: BindingSync): string {
	const attribute = editor?.record.attributes.find((a) => a.id === change.attributeId);
	const name = attribute?.label ?? change.attributeId;
	switch (change.outcome) {
		case 'converted':
			return m.showcase_dynamic_attributes_sync_converted({ label: name, from: change.from, to: change.to });
		case 'kept_previous':
			return m.showcase_dynamic_attributes_sync_kept({ label: name });
		case 'retired':
			return m.showcase_dynamic_attributes_sync_retired({ label: name });
		default:
			return m.showcase_dynamic_attributes_sync_updated({ label: name, from: change.from, to: change.to });
	}
}

// ── Consumers ───────────────────────────────────────────────────────────────────────────

const consumers = $derived(
	CONSUMERS.map((c) => ({ ...c, dictionaryRevision: pins[c.consumer] ?? c.dictionaryRevision })),
);
const allRecords = $derived(products.map((p) => ({ name: p.name, record: p.session.editor.record })));

function repin(consumer: string, revision: number) {
	pins = { ...pins, [consumer]: revision };
	try {
		savePins(localStorage, pins);
	} catch {
		// The pin still holds for this visit.
	}
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
</script>

{#if failed}
	<Card id="da-dictionary">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_dynamic_attributes_section_dictionary()}</Typography>
		{/snippet}
		<div class="card-body">
			<p class="text-muted text-fluid-sm">
				{failed === 'storage'
					? m.showcase_dynamic_attributes_storage_unavailable()
					: m.showcase_dynamic_attributes_dictionary_refused()}
			</p>
			<Button size="sm" variant="outline" onclick={reset}>{m.showcase_dynamic_attributes_reset()}</Button>
		</div>
	</Card>
{:else}
	<Card id="da-dictionary">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_dynamic_attributes_section_dictionary()}</Typography>
			<p class="text-muted text-fluid-sm intro">{m.showcase_dynamic_attributes_dictionary_intro()}</p>
			<div class="controls-row">
				<Select
					class="revision-select"
					aria-label={m.showcase_dynamic_attributes_revision_aria()}
					options={revisionOptions}
					value={shown ? String(shown.revision) : ''}
					onchange={(next) => (viewing = Number(next) === latest?.revision ? null : Number(next))}
				/>
				<Button size="sm" variant="outline" onclick={reset}>
					<span class="i-lucide-rotate-ccw" aria-hidden="true"></span>
					{m.showcase_dynamic_attributes_catalog_reset()}
				</Button>
			</div>
		{/snippet}
		<div class="card-body">
			{#if dictionary && shown}
				<Stack gap="3">
					{#if !editable}
						<p class="notice text-fluid-sm" role="note">
							{m.showcase_dynamic_attributes_revision_old({ revision: shown.revision, latest: latest?.revision ?? 0 })}
						</p>
					{/if}
					{#if changes.length > 0}
						<p class="text-fluid-xs text-muted">
							{m.showcase_dynamic_attributes_revision_changes({ revision: shown.revision })}
							{changes.map((c) => `${label(c.after)} (${partsText(c.parts)})`).join(' · ')}
						</p>
					{/if}
					<div class="definitions" role="table" aria-label={m.showcase_dynamic_attributes_section_dictionary()}>
						<div class="definition head text-fluid-xs text-muted" role="row">
							<span role="columnheader">{m.showcase_dynamic_attributes_column_definition()}</span>
							{#each LOCALES as locale (locale)}
								<span role="columnheader">{m.showcase_dynamic_attributes_column_label({ locale: locale.toUpperCase() })}</span>
							{/each}
							<span role="columnheader">{m.showcase_dynamic_attributes_column_kind()}</span>
							<span role="columnheader">{m.showcase_dynamic_attributes_column_unit()}</span>
							<span role="columnheader">{m.showcase_dynamic_attributes_column_status()}</span>
						</div>
						{#each shown.definitions as definition (definition.id)}
							{@const retired = definition.status === 'retired'}
							<div class="definition" class:retired role="row">
								<span role="cell"><code class="text-fluid-xs">{definition.id}</code></span>
								{#each LOCALES as locale (locale)}
									<span role="cell">
										{#if editable && !retired}
											<Input
												class="cell-input"
												aria-label={m.showcase_dynamic_attributes_label_aria({ label: label(definition), locale: locale.toUpperCase() })}
												value={definition.labels[locale] ?? ''}
												placeholder={locale === dictionary.sourceLocale ? '' : definitionLabel(definition, locale, dictionary.sourceLocale)}
												onchange={(event: Event) =>
													revise({
														op: 'relabel',
														definition: definition.id,
														locale,
														label: (event.currentTarget as HTMLInputElement).value,
													})}
											/>
										{:else}
											{definition.labels[locale] ?? ''}
										{/if}
									</span>
								{/each}
								<span role="cell" class="text-fluid-sm">{showcaseControls[definition.kind]?.label() ?? definition.kind}</span>
								<span role="cell">
									{#if editable && !retired && definition.kind === 'number'}
										<Select
											class="cell-select"
											aria-label={m.showcase_dynamic_attributes_unit_aria({ label: label(definition) })}
											options={unitOptions}
											value={definition.unit ?? ''}
											onchange={(next) =>
												revise({ op: 'set_unit', definition: definition.id, unit: next === '' ? null : (next as AttributeDefinition['unit'] & string) })}
										/>
									{:else}
										<span class="text-fluid-sm">{definition.unit ?? '—'}</span>
									{/if}
								</span>
								<span role="cell">
									{#if editable && !retired}
										<Select
											class="cell-select"
											aria-label={m.showcase_dynamic_attributes_status_aria({ label: label(definition) })}
											options={statusOptions}
											value={definition.status}
											onchange={(next) => revise({ op: 'set_status', definition: definition.id, status: next as DefinitionStatus })}
										/>
									{:else}
										<Badge variant={retired ? 'muted' : definition.status === 'deprecated' ? 'warning' : 'secondary'}>
											{statusLabel[definition.status]()}
										</Badge>
									{/if}
								</span>
							</div>
						{/each}
					</div>
					{#if editable}
						<div class="controls-row">
							<Input
								class="add-label"
								aria-label={m.showcase_dynamic_attributes_add_definition_label()}
								placeholder={m.showcase_dynamic_attributes_add_definition_label()}
								bind:value={newLabel}
								onkeydown={(event: KeyboardEvent) => {
									if (event.key === 'Enter') addDefinition();
								}}
							/>
							<Select class="add-kind" aria-label={m.attributes_add_kind()} options={kindOptions} bind:value={newKind} />
							<Button size="sm" variant="outline" disabled={!newLabel.trim()} onclick={addDefinition}>
								<span class="i-lucide-plus h-4 w-4" aria-hidden="true"></span>
								{m.showcase_dynamic_attributes_add_definition()}
							</Button>
						</div>
					{/if}
					<p class="refusal text-fluid-sm" role="status">{dictionaryRefusal ? refusalText(dictionaryRefusal) : ''}</p>
				</Stack>
			{/if}
		</div>
	</Card>

	<Card id="da-products">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_dynamic_attributes_section_products()}</Typography>
			<p class="text-muted text-fluid-sm intro">{m.showcase_dynamic_attributes_products_intro()}</p>
			<ToggleGroup
				size="sm"
				bind:value={() => selected, (next) => next && selectProduct(next)}
				items={PRODUCTS.map((p) => ({ value: p.id, label: p.name }))}
			/>
		{/snippet}
		<div class="card-body">
			{#if !product || !product.snapshot.loaded || !editor}
				<p class="text-muted text-fluid-sm">
					{product?.snapshot.error ? m.showcase_dynamic_attributes_load_failed() : m.showcase_dynamic_attributes_loading()}
				</p>
			{:else}
				<Stack gap="3">
					<div class="controls-row spread">
						<RecordSaveStatus session={product.session} snapshot={product.snapshot} downloadName={product.id} />
						{#if stale > 0 && latest}
							<Button size="sm" variant="primary" onclick={sync}>
								<span class="i-lucide-refresh-cw h-4 w-4" aria-hidden="true"></span>
								{m.showcase_dynamic_attributes_sync({ count: stale, revision: latest.revision })}
							</Button>
						{/if}
					</div>
					{#if synced}
						<ul class="sync text-fluid-xs" role="status">
							{#each synced as change (change.attributeId)}
								<li>{syncText(change)}</li>
							{:else}
								<li>{m.showcase_dynamic_attributes_sync_nothing()}</li>
							{/each}
						</ul>
					{/if}
					<AttributeEditor {editor} engine={product.session.engine} controls={showcaseControls} label={product.name} />
					<div class="controls-row">
						<Select
							class="wide-select"
							aria-label={m.showcase_dynamic_attributes_bind_aria()}
							placeholder={m.showcase_dynamic_attributes_bind_placeholder()}
							options={unbound.map((d) => ({ value: d.id, label: label(d) }))}
							bind:value={bindChoice}
						/>
						<Button size="sm" variant="outline" disabled={!bindChoice} onclick={bind}>
							<span class="i-lucide-book-marked h-4 w-4" aria-hidden="true"></span>
							{m.showcase_dynamic_attributes_bind()}
						</Button>
						<Select
							class="wide-select"
							aria-label={m.showcase_dynamic_attributes_promote_aria()}
							placeholder={m.showcase_dynamic_attributes_promote_placeholder()}
							options={locals.map((a) => ({ value: a.id, label: a.label || m.attributes_unlabelled() }))}
							bind:value={promoteChoice}
						/>
						<Button size="sm" variant="outline" disabled={!promoteChoice} onclick={promote}>
							<span class="i-lucide-share-2 h-4 w-4" aria-hidden="true"></span>
							{m.showcase_dynamic_attributes_promote()}
						</Button>
					</div>

					<section class="history" aria-label={m.showcase_dynamic_attributes_history_heading()}>
						<Typography variant="h3">{m.showcase_dynamic_attributes_history_heading()}</Typography>
						<p class="text-muted text-fluid-xs">{m.showcase_dynamic_attributes_history_intro()}</p>
						<Select
							class="wide-select"
							aria-label={m.showcase_dynamic_attributes_history_aria()}
							placeholder={m.showcase_dynamic_attributes_history_placeholder()}
							options={historyOptions}
							bind:value={historyKey}
						/>
						{#if historyKey}
							<ol class="history-list text-fluid-sm">
								{#each history as entry (entry.version)}
									<li>
										<span class="text-muted text-fluid-xs">
											{m.showcase_dynamic_attributes_history_version({ version: entry.version, time: formatTime(entry.savedAt) })}
										</span>
										{#if entry.absent}
											<em>{m.showcase_dynamic_attributes_history_absent()}</em>
										{:else}
											<span>{entry.text || '—'}</span>
											{#if entry.revision}
												<Badge variant="secondary">r{entry.revision}</Badge>
											{/if}
										{/if}
									</li>
								{:else}
									<li class="text-muted">{m.showcase_dynamic_attributes_history_empty()}</li>
								{/each}
							</ol>
						{/if}
					</section>
				</Stack>
			{/if}
		</div>
	</Card>

	<Card id="da-consumers">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_dynamic_attributes_section_consumers()}</Typography>
			<p class="text-muted text-fluid-sm intro">{m.showcase_dynamic_attributes_consumers_intro()}</p>
		{/snippet}
		<div class="card-body">
			{#if dictionary && editor}
				<div class="consumers">
					{#each consumers as projection (projection.consumer)}
						<ConsumerCard
							{projection}
							{dictionary}
							record={editor.record}
							records={allRecords}
							onrepin={(revision) => repin(projection.consumer, revision)}
						/>
					{/each}
				</div>
			{:else}
				<p class="text-muted text-fluid-sm">{m.showcase_dynamic_attributes_loading()}</p>
			{/if}
		</div>
	</Card>
{/if}

<style>
	.card-body {
		padding: var(--spacing-4);
	}

	.intro {
		max-width: 70ch;
	}

	.controls-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.controls-row.spread {
		justify-content: space-between;
	}

	.controls-row :global(.revision-select) {
		width: min(34rem, 100%);
	}

	.controls-row :global(.wide-select) {
		width: min(16rem, 100%);
	}

	.controls-row :global(.add-label) {
		width: min(16rem, 100%);
	}

	.controls-row :global(.add-kind) {
		width: 10rem;
	}

	.notice {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-warning-light);
		color: var(--color-warning-fg);
	}

	.definitions {
		display: grid;
		overflow-x: auto;
	}

	.definition {
		display: grid;
		grid-template-columns: 9rem minmax(8rem, 1fr) minmax(8rem, 1fr) 6.5rem 7rem 9rem;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 46rem;
		padding: var(--spacing-1) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.definition.head {
		font-weight: 600;
	}

	.definition.retired {
		color: var(--color-muted);
		text-decoration: line-through;
	}

	.definition :global(.cell-input) {
		height: 2.5rem;
	}

	.refusal {
		margin: 0;
		min-height: 1.25em;
		color: var(--color-error);
	}

	.sync {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3) var(--spacing-2) var(--spacing-6);
		border-radius: var(--radius-md);
		background: var(--surface-1);
	}

	.history {
		display: grid;
		gap: var(--spacing-2);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.history p {
		margin: 0;
	}

	.history-list {
		margin: 0;
		padding-left: var(--spacing-5);
		display: grid;
		gap: var(--spacing-1);
	}

	.history-list li {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-2);
	}

	.consumers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
		gap: var(--spacing-4);
	}
</style>
