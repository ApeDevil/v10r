<script lang="ts">
import { onMount } from 'svelte';
import {
	AttributeEditor,
	acceptsAttributeRecord,
	createRecordSession,
	RecordSaveStatus,
	type RecordSession,
} from '#lib/components/attributes/index.ts';
import { Card, NavSection, ShowcaseLayout } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Button, Switch, Textarea, Typography } from '#lib/components/primitives/index.ts';
import { showcaseControls } from '#lib/components/showcases/dynamic-attributes/index.ts';
import {
	type AttributeRecord,
	type AttributeRecordParse,
	parseAttributeRecordText,
	serializeAttributeRecord,
	utf8Length,
} from '#lib/dynamic-attributes/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	createShowcaseEngine,
	createShowcaseStore,
	SAMPLE_PAYLOADS,
	SEED_RECORD,
	SHOWCASE_DRAFT_NAMESPACE,
	SHOWCASE_DRAFT_USER,
	SHOWCASE_RECORD_KEY,
	showcaseKinds,
} from '#lib/showcases/dynamic-attributes/showcase-records.ts';
import { createDocumentDrafts, removeUserDocumentDrafts } from '#lib/state/document-drafts.ts';
import { getShowcaseCard } from '../showcases';

const card = getShowcaseCard('/showcases/dynamic-attributes');

/**
 * Two editors of one record, in one page: each is a full record session (undo, debounced
 * autosave, device draft, conflict detection) over the same browser store. They stand in for two
 * tabs, two people or a person and an assistant — the store's version check is what turns their
 * overlapping saves into a conflict instead of a lost update.
 */
interface Writer {
	session: RecordSession;
	snapshot: RecordSession['autosave']['snapshot'];
}

/** Raw: a session is an object with its own reactivity, never something to deep-proxy. */
let writers = $state.raw<{ a: Writer; b: Writer }>();
let offline = $state(false);
let failed = $state(false);

function openWriter(name: string): Writer {
	const engine = createShowcaseEngine();
	const session = createRecordSession({
		engine,
		store: createShowcaseStore(
			() => localStorage,
			() => offline,
		),
		drafts: createDocumentDrafts(() => localStorage, {
			namespace: SHOWCASE_DRAFT_NAMESPACE,
			userId: SHOWCASE_DRAFT_USER,
			fileId: name,
			writerId: crypto.randomUUID(),
			accepts: acceptsAttributeRecord(engine),
		}),
	});
	return { session, snapshot: session.autosave.snapshot };
}

onMount(() => {
	try {
		// First visit: a nearly empty record, one label waiting for a value.
		if (localStorage.getItem(SHOWCASE_RECORD_KEY) === null) {
			localStorage.setItem(SHOWCASE_RECORD_KEY, `{"record":${serializeAttributeRecord(SEED_RECORD)},"version":0}`);
		}
	} catch {
		failed = true;
		return;
	}
	const opened = { a: openWriter('writer-a'), b: openWriter('writer-b') };
	writers = opened;
	const unsubscribe = (['a', 'b'] as const).map((key) => {
		const { session } = opened[key];
		void session.autosave.refresh();
		return session.autosave.subscribe(() => {
			if (writers) writers = { ...writers, [key]: { session, snapshot: session.autosave.snapshot } };
			readStored();
		});
	});
	return () => {
		for (const stop of unsubscribe) stop();
	};
});

function reset() {
	try {
		localStorage.removeItem(SHOWCASE_RECORD_KEY);
		removeUserDocumentDrafts(localStorage, SHOWCASE_DRAFT_NAMESPACE, SHOWCASE_DRAFT_USER);
	} finally {
		location.reload();
	}
}

const a = $derived(writers?.a);

/** What the store holds right now — not either editor's copy, which may be ahead or behind. */
let stored = $state<{ json: string; bytes: number; version: number; count: number } | null>(null);

function readStored() {
	try {
		const text = localStorage.getItem(SHOWCASE_RECORD_KEY);
		if (text === null) return;
		const { record, version } = JSON.parse(text) as { record: AttributeRecord; version: number };
		stored = {
			json: JSON.stringify(record, null, 2),
			bytes: utf8Length(serializeAttributeRecord(record)),
			version,
			count: record.attributes.length,
		};
	} catch {
		stored = null;
	}
}

let payload = $state(SAMPLE_PAYLOADS.valid);
let checked = $state.raw<AttributeRecordParse | null>(null);

function check() {
	checked = parseAttributeRecordText(payload, { kinds: showcaseKinds });
}

function adopt() {
	if (!a || !checked?.ok) return;
	a.session.editor.replace(checked.record);
	a.session.autosave.change(checked.record);
}

const samples = [
	{ key: 'valid', label: m.showcase_dynamic_attributes_sample_valid },
	{ key: 'pollution', label: m.showcase_dynamic_attributes_sample_pollution },
	{ key: 'wrongType', label: m.showcase_dynamic_attributes_sample_wrong_type },
	{ key: 'script', label: m.showcase_dynamic_attributes_sample_script },
] as const;

const steps = [
	m.showcase_dynamic_attributes_try_add,
	m.showcase_dynamic_attributes_try_types,
	m.showcase_dynamic_attributes_try_rename,
	m.showcase_dynamic_attributes_try_reorder,
	m.showcase_dynamic_attributes_try_restore,
	m.showcase_dynamic_attributes_try_conflict,
];

const sections = $derived([
	{ id: 'da-record', label: m.showcase_dynamic_attributes_section_record() },
	{ id: 'da-conflict', label: m.showcase_dynamic_attributes_section_conflict() },
	{ id: 'da-json', label: m.showcase_dynamic_attributes_section_json() },
	{ id: 'da-import', label: m.showcase_dynamic_attributes_section_import() },
]);
</script>

{#snippet writerBody(writer: Writer | undefined, name: string)}
	{#if failed}
		<p class="text-muted text-fluid-sm">{m.showcase_dynamic_attributes_storage_unavailable()}</p>
	{:else if !writer || !writer.snapshot.loaded}
		<p class="text-muted text-fluid-sm">
			{writer?.snapshot.error ? m.showcase_dynamic_attributes_load_failed() : m.showcase_dynamic_attributes_loading()}
		</p>
		{#if writer?.snapshot.error}
			<Button size="sm" variant="outline" onclick={reset}>{m.showcase_dynamic_attributes_reset()}</Button>
		{/if}
	{:else}
		<Stack gap="3">
			<div class="writer-bar">
				<RecordSaveStatus session={writer.session} snapshot={writer.snapshot} downloadName={name} />
				<Button
					size="sm"
					variant="ghost"
					disabled={writer.snapshot.unsaved || writer.snapshot.saving}
					onclick={() => writer.session.autosave.refresh()}
				>
					<span class="i-lucide-refresh-cw" aria-hidden="true"></span>
					{m.showcase_dynamic_attributes_reload()}
				</Button>
			</div>
			<AttributeEditor editor={writer.session.editor} engine={writer.session.engine} controls={showcaseControls} label={name} />
		</Stack>
	{/if}
{/snippet}

<ShowcaseLayout {card}>
	<Stack gap="6">
		<p class="lede">{m.showcase_dynamic_attributes_lede()}</p>

		<NavSection {sections} />

		<Card id="da-record">
			{#snippet header()}
				<Typography variant="h2">{m.showcase_dynamic_attributes_section_record()}</Typography>
				<ol class="steps text-fluid-sm">
					{#each steps as step, i (i)}
						<li>{step()}</li>
					{/each}
				</ol>
				<div class="controls-row">
					<Switch
						id="da-offline"
						checked={offline}
						label={m.showcase_dynamic_attributes_offline()}
						onCheckedChange={(next) => (offline = next)}
					/>
					<Button size="sm" variant="outline" onclick={reset}>
						<span class="i-lucide-rotate-ccw" aria-hidden="true"></span>
						{m.showcase_dynamic_attributes_reset()}
					</Button>
				</div>
			{/snippet}
			<div class="card-body">
				{@render writerBody(writers?.a, m.showcase_dynamic_attributes_writer_a())}
			</div>
		</Card>

		<Card id="da-conflict">
			{#snippet header()}
				<Typography variant="h2">{m.showcase_dynamic_attributes_section_conflict()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_dynamic_attributes_conflict_intro()}</p>
			{/snippet}
			<div class="card-body">
				{@render writerBody(writers?.b, m.showcase_dynamic_attributes_writer_b())}
			</div>
		</Card>

		<Card id="da-json">
			{#snippet header()}
				<Typography variant="h2">{m.showcase_dynamic_attributes_section_json()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_dynamic_attributes_json_intro()}</p>
			{/snippet}
			<div class="card-body">
				{#if stored}
					<p class="text-muted text-fluid-xs">
						{m.showcase_dynamic_attributes_json_meta({ version: stored.version, count: stored.count, bytes: stored.bytes })}
					</p>
					<pre class="json" aria-label={m.showcase_dynamic_attributes_section_json()}>{stored.json}</pre>
				{/if}
			</div>
		</Card>

		<Card id="da-import">
			{#snippet header()}
				<Typography variant="h2">{m.showcase_dynamic_attributes_section_import()}</Typography>
				<p class="text-muted text-fluid-sm">{m.showcase_dynamic_attributes_import_intro()}</p>
			{/snippet}
			<div class="card-body">
				<Stack gap="3">
					<div class="controls-row">
						{#each samples as sample (sample.key)}
							<Button
								size="sm"
								variant="outline"
								onclick={() => {
									payload = SAMPLE_PAYLOADS[sample.key];
									checked = null;
								}}
							>
								{sample.label()}
							</Button>
						{/each}
					</div>
					<Textarea
						id="da-import-payload"
						aria-label={m.showcase_dynamic_attributes_import_label()}
						rows={10}
						class="font-mono text-fluid-xs"
						bind:value={() => payload, (next) => {
							payload = next;
							checked = null;
						}}
					/>
					<div class="controls-row">
						<Button size="sm" variant="primary" onclick={check}>{m.showcase_dynamic_attributes_import_check()}</Button>
						{#if checked?.ok}
							<Button size="sm" variant="outline" disabled={!a?.snapshot.loaded} onclick={adopt}>
								{m.showcase_dynamic_attributes_import_apply()}
							</Button>
						{/if}
					</div>
					<div role="status" class="text-fluid-sm">
						{#if checked?.ok}
							<p>{m.showcase_dynamic_attributes_import_valid({ count: checked.record.attributes.length })}</p>
						{:else if checked}
							<p>{m.showcase_dynamic_attributes_import_invalid()}</p>
							<ul class="problems">
								{#each checked.problems as problem, i (i)}
									<li><code>{problem.code}</code> <code>{problem.path || '/'}</code> {problem.message}</li>
								{/each}
							</ul>
						{/if}
					</div>
				</Stack>
			</div>
		</Card>
	</Stack>
</ShowcaseLayout>

<style>
	.lede {
		max-width: 70ch;
	}

	.card-body {
		padding: var(--spacing-4);
	}

	.steps {
		margin: 0;
		padding-left: var(--spacing-5);
		display: grid;
		gap: var(--spacing-1);
		color: var(--color-muted);
	}

	.controls-row,
	.writer-bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.writer-bar {
		justify-content: space-between;
	}

	.json {
		margin: 0;
		max-height: 28rem;
		overflow: auto;
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--surface-0);
		font-size: var(--text-fluid-xs);
		white-space: pre;
	}

	.problems {
		margin: var(--spacing-2) 0 0;
		padding-left: var(--spacing-5);
		display: grid;
		gap: var(--spacing-1);
	}
</style>
