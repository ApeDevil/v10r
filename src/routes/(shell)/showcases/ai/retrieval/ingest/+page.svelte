<script lang="ts">
import { apiFetch, CSRF_HEADER } from '$lib/api';
import { Alert, Card, FormField } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button, Input, Textarea, Typography } from '$lib/components/primitives';
import { INGEST_STEPS, type IngestEvent, type IngestStepId, type IngestStepState } from '$lib/types/ingest-pipeline';

let { data } = $props();

type Tab = 'submit' | 'how' | 'replay';
let activeTab = $state<Tab>('submit');

// ── Submit tab state ──────────────────────────────────────────────
let title = $state('');
let content = $state('');
let loading = $state(false);
let result: { documentId: string; chunkCount: number; entityCount: number; durationMs: number } | null = $state(null);
let error: string | null = $state(null);
let deleteError: string | null = $state(null);

let documents: Array<{
	id: string;
	title: string;
	status: string;
	totalChunks: number;
	totalTokens: number;
	createdAt: string;
}> = $state([]);

async function loadDocuments() {
	try {
		const res = await fetch('/api/retrieval/documents');
		if (res.ok) {
			const { data: docData } = await res.json();
			documents = docData.items ?? [];
		}
	} catch {
		/* ignore */
	}
}

async function ingestDocument() {
	if (!title.trim() || !content.trim() || loading) return;

	loading = true;
	error = null;
	result = null;

	try {
		const res = await apiFetch('/api/retrieval/ingest', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ title: title.trim(), content: content.trim() }),
		});

		if (!res.ok) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}

		const { data: ingestResult } = await res.json();
		result = ingestResult;
		title = '';
		content = '';
		await loadDocuments();
	} catch (err) {
		error = err instanceof Error ? err.message : 'Ingestion failed';
	} finally {
		loading = false;
	}
}

async function deleteDocument(id: string) {
	deleteError = null;
	try {
		const res = await apiFetch(`/api/retrieval/documents/${id}`, { method: 'DELETE' });
		if (!res.ok) {
			throw new Error(`Failed to delete document (HTTP ${res.status})`);
		}
		await loadDocuments();
	} catch (err) {
		deleteError = err instanceof Error ? err.message : 'Delete failed';
	}
}

$effect(() => {
	loadDocuments();
});

// ── Replay tab state ──────────────────────────────────────────────
let replayTitle = $state('');
let replayContent = $state('');
let replayLoading = $state(false);
let replayError = $state<string | null>(null);
let replayResult = $state<{ documentId: string; chunkCount: number; entityCount: number; durationMs: number } | null>(
	null,
);

function createInitialSteps(): IngestStepState[] {
	return INGEST_STEPS.map((s) => ({
		id: s.id,
		label: s.label,
		description: s.description,
		status: 'pending',
	}));
}

let replaySteps = $state<IngestStepState[]>(createInitialSteps());

function updateStep(id: IngestStepId, patch: Partial<IngestStepState>) {
	replaySteps = replaySteps.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

async function runReplay() {
	if (!replayTitle.trim() || !replayContent.trim() || replayLoading) return;

	replayLoading = true;
	replayError = null;
	replayResult = null;
	replaySteps = createInitialSteps();

	try {
		const res = await fetch('/api/retrieval/ingest/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...CSRF_HEADER },
			body: JSON.stringify({ title: replayTitle.trim(), content: replayContent.trim() }),
		});

		if (!res.ok || !res.body) {
			const errJson = await res.json().catch(() => ({}));
			throw new Error(errJson.error?.message ?? `HTTP ${res.status}`);
		}

		const reader = res.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			let nl = buffer.indexOf('\n');
			while (nl !== -1) {
				const line = buffer.slice(0, nl).trim();
				buffer = buffer.slice(nl + 1);
				if (line) {
					try {
						const ev = JSON.parse(line) as IngestEvent;
						if (ev.type === 'ingest:step') {
							updateStep(ev.step, {
								status: ev.status,
								durationMs: ev.durationMs,
								error: ev.error,
							});
						} else if (ev.type === 'ingest:done') {
							replayResult = {
								documentId: ev.documentId,
								chunkCount: ev.chunkCount,
								entityCount: ev.entityCount,
								durationMs: ev.durationMs,
							};
							updateStep('done', { status: 'done' });
						}
					} catch {
						/* ignore malformed line */
					}
				}
				nl = buffer.indexOf('\n');
			}
		}
	} catch (err) {
		replayError = err instanceof Error ? err.message : 'Replay failed';
	} finally {
		replayLoading = false;
		await loadDocuments();
	}
}

function loadSample(target: 'submit' | 'replay') {
	const sampleTitle = 'SvelteKit Routing';
	const sampleContent = SAMPLE_DOC;
	if (target === 'submit') {
		title = sampleTitle;
		content = sampleContent;
	} else {
		replayTitle = sampleTitle;
		replayContent = sampleContent;
	}
}

const SAMPLE_DOC = `# SvelteKit Routing

SvelteKit uses filesystem-based routing. Routes are defined by the directory structure under src/routes.

## Page Routes

A +page.svelte file creates a page route. The file path determines the URL. For example, src/routes/about/+page.svelte becomes /about.

## Layout Routes

A +layout.svelte file wraps all pages in the same directory and subdirectories. Layouts receive a children snippet that renders the page content.

## Server Routes

A +server.ts file creates an API endpoint. It exports request handler functions (GET, POST, PUT, DELETE) that return Response objects.

## Load Functions

A +page.server.ts file exports a load function that runs on the server. It provides data to the page component via the data prop. Load functions can access the database, check authentication, and fetch external APIs.

## Form Actions

A +page.server.ts file can also export actions for progressive form handling. Actions run on the server when a form is submitted and can return validation errors.`;
</script>

<svelte:head>
	<title>Ingest - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	{#if !data.configured}
		<Alert variant="info" title="AI Not Configured">
			<p>Configure an AI provider to enable document ingestion (requires OpenAI for embeddings).</p>
		</Alert>
	{:else}
		<div class="tab-bar" role="tablist" aria-label="Ingest mode">
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'submit'}
				class="tab"
				class:active={activeTab === 'submit'}
				onclick={() => (activeTab = 'submit')}
			>
				<span class="i-lucide-upload h-3 w-3"></span>
				Submit
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'how'}
				class="tab"
				class:active={activeTab === 'how'}
				onclick={() => (activeTab = 'how')}
			>
				<span class="i-lucide-book-open h-3 w-3"></span>
				How it works
			</button>
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === 'replay'}
				class="tab"
				class:active={activeTab === 'replay'}
				onclick={() => (activeTab = 'replay')}
			>
				<span class="i-lucide-play-circle h-3 w-3"></span>
				Replay (live)
			</button>
		</div>

		{#if activeTab === 'submit'}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Ingest Document</Typography>
				{/snippet}

				<Stack gap="4">
					<FormField label="Title" id="doc-title">
						{#snippet children(_)}
							<Input id="doc-title" bind:value={title} placeholder="Document title..." disabled={loading} />
						{/snippet}
					</FormField>

					<FormField label="Content" id="doc-content">
						{#snippet children(_)}
							<Textarea
								id="doc-content"
								bind:value={content}
								placeholder="Paste document content (markdown supported)..."
								rows={12}
								disabled={loading}
							/>
						{/snippet}
					</FormField>

					<div class="flex flex-wrap gap-3">
						<Button
							variant="primary"
							onclick={ingestDocument}
							disabled={loading || !title.trim() || !content.trim()}
						>
							{#if loading}
								<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
								Processing...
							{:else}
								<span class="i-lucide-upload h-4 w-4"></span>
								Ingest Document
							{/if}
						</Button>

						<Button variant="secondary" onclick={() => loadSample('submit')} disabled={loading}>
							<span class="i-lucide-file-text h-4 w-4"></span>
							Load Sample
						</Button>
					</div>
				</Stack>
			</Card>

			{#if result}
				<Alert variant="success" title="Document Ingested">
					<div class="result-grid">
						<span class="text-muted">Document ID</span>
						<code class="text-fluid-xs">{result.documentId}</code>
						<span class="text-muted">Chunks</span>
						<span>{result.chunkCount}</span>
						<span class="text-muted">Entities</span>
						<span>{result.entityCount}</span>
						<span class="text-muted">Duration</span>
						<span>{result.durationMs}ms</span>
					</div>
				</Alert>
			{/if}

			{#if error}
				<Alert variant="error" title="Ingestion Failed">
					<p>{error}</p>
				</Alert>
			{/if}

			{#if deleteError}
				<Alert variant="error" title="Delete Failed">
					<p>{deleteError}</p>
				</Alert>
			{/if}

			{#if documents.length > 0}
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">Ingested Documents ({documents.length})</Typography>
					{/snippet}

					<div class="doc-list">
						{#each documents as doc (doc.id)}
							<div class="doc-row">
								<div class="doc-info">
									<span class="font-medium text-fg">{doc.title}</span>
									<span class="text-fluid-xs text-muted">
										{doc.totalChunks} chunks · {doc.totalTokens.toLocaleString()} tokens · {doc.status}
									</span>
								</div>
								<Button
									variant="ghost"
									size="icon"
									onclick={() => deleteDocument(doc.id)}
									aria-label="Delete {doc.title}"
								>
									<span class="i-lucide-trash-2 h-4 w-4"></span>
								</Button>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		{:else if activeTab === 'how'}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">The Ingestion Pipeline</Typography>
					<Typography variant="muted" as="p">
						Seven steps turn a raw document into something searchable by vectors, BM25, and entity graph.
					</Typography>
				{/snippet}

				<div class="how-steps">
					{#each INGEST_STEPS as step, idx (step.id)}
						<div class="how-step">
							<div class="step-idx">{idx + 1}</div>
							<div class="step-body">
								<h4 class="step-title">{step.label}</h4>
								<p class="step-desc">{step.description}</p>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{:else}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Replay — live pipeline</Typography>
					<Typography variant="muted" as="p">
						Paste a document and watch the 7 steps execute against the real pipeline in real time.
					</Typography>
				{/snippet}

				<Stack gap="4">
					<FormField label="Title" id="replay-title">
						{#snippet children(_)}
							<Input
								id="replay-title"
								bind:value={replayTitle}
								placeholder="Document title..."
								disabled={replayLoading}
							/>
						{/snippet}
					</FormField>

					<FormField label="Content" id="replay-content">
						{#snippet children(_)}
							<Textarea
								id="replay-content"
								bind:value={replayContent}
								placeholder="Paste content..."
								rows={8}
								disabled={replayLoading}
							/>
						{/snippet}
					</FormField>

					<div class="flex flex-wrap gap-3">
						<Button
							variant="primary"
							onclick={runReplay}
							disabled={replayLoading || !replayTitle.trim() || !replayContent.trim()}
						>
							{#if replayLoading}
								<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
								Streaming...
							{:else}
								<span class="i-lucide-play h-4 w-4"></span>
								Run replay
							{/if}
						</Button>

						<Button variant="secondary" onclick={() => loadSample('replay')} disabled={replayLoading}>
							<span class="i-lucide-file-text h-4 w-4"></span>
							Load Sample
						</Button>
					</div>
				</Stack>

				<div class="replay-pipeline">
					{#each replaySteps as step (step.id)}
						<div class="replay-step" data-status={step.status}>
							<div class="replay-dot" aria-hidden="true"></div>
							<div class="replay-body">
								<div class="replay-head">
									<span class="replay-label">{step.label}</span>
									{#if step.durationMs}
										<span class="replay-duration">{step.durationMs}ms</span>
									{/if}
								</div>
								<p class="replay-desc">{step.description}</p>
								{#if step.error}
									<p class="replay-error">{step.error}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>

				{#if replayResult}
					<Alert variant="success" title="Replay complete">
						<div class="result-grid">
							<span class="text-muted">Document ID</span>
							<code class="text-fluid-xs">{replayResult.documentId}</code>
							<span class="text-muted">Chunks</span>
							<span>{replayResult.chunkCount}</span>
							<span class="text-muted">Entities</span>
							<span>{replayResult.entityCount}</span>
							<span class="text-muted">Total duration</span>
							<span>{replayResult.durationMs}ms</span>
						</div>
					</Alert>
				{/if}

				{#if replayError}
					<Alert variant="error" title="Replay failed">
						<p>{replayError}</p>
					</Alert>
				{/if}
			</Card>
		{/if}
	{/if}
</Stack>

<style>
	.tab-bar {
		display: flex;
		gap: var(--spacing-1);
		padding: var(--spacing-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
		width: fit-content;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-2) var(--spacing-4);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
	}

	.tab:hover:not(.active) {
		background: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.tab.active {
		background: var(--color-primary);
		color: var(--color-primary-fg, white);
	}

	.result-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-2) var(--spacing-4);
		font-size: var(--text-fluid-sm);
	}

	.doc-list {
		display: flex;
		flex-direction: column;
	}

	.doc-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.doc-row:last-child {
		border-bottom: none;
	}

	.doc-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	/* ─── How-it-works tab ─────────────────────────────── */

	.how-steps {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.how-step {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
	}

	.step-idx {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--color-primary);
		color: var(--color-primary-fg, white);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 12px;
	}

	.step-body {
		flex: 1;
		min-width: 0;
	}

	.step-title {
		margin: 0 0 var(--spacing-1);
		font-size: 14px;
		font-weight: 600;
		color: var(--color-fg);
	}

	.step-desc {
		margin: 0;
		font-size: 12px;
		color: var(--color-muted);
		line-height: 1.5;
	}

	/* ─── Replay tab ───────────────────────────────────── */

	.replay-pipeline {
		display: flex;
		flex-direction: column;
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.replay-step {
		display: flex;
		gap: var(--spacing-3);
		padding: var(--spacing-2) 0;
		position: relative;
	}

	.replay-step::before {
		content: '';
		position: absolute;
		left: 5px;
		top: 20px;
		bottom: -4px;
		width: 2px;
		background: var(--color-border);
	}

	.replay-step:last-child::before {
		display: none;
	}

	.replay-dot {
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		margin-top: 6px;
		border-radius: 50%;
		background: var(--color-border);
		border: 2px solid var(--color-surface-1);
		z-index: 1;
	}

	.replay-step[data-status='active'] .replay-dot {
		background: var(--color-primary);
		animation: pulse-dot 1s ease-in-out infinite;
	}

	.replay-step[data-status='done'] .replay-dot {
		background: var(--color-accent, var(--color-primary));
	}

	.replay-step[data-status='error'] .replay-dot {
		background: var(--color-error-fg);
	}

	.replay-step[data-status='skipped'] .replay-dot {
		background: transparent;
		border-color: var(--color-muted);
	}

	@keyframes pulse-dot {
		0%,
		100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.3);
			opacity: 0.7;
		}
	}

	.replay-body {
		flex: 1;
		min-width: 0;
	}

	.replay-head {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-2);
	}

	.replay-label {
		font-weight: 500;
		color: var(--color-fg);
		font-size: 13px;
	}

	.replay-duration {
		font-size: 10px;
		color: var(--color-muted);
		font-family: ui-monospace, monospace;
	}

	.replay-desc {
		margin: 2px 0 0;
		font-size: 11px;
		color: var(--color-muted);
	}

	.replay-error {
		margin: var(--spacing-1) 0 0;
		padding: var(--spacing-1) var(--spacing-2);
		font-size: 11px;
		color: var(--color-error-fg);
		background: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border-radius: var(--radius-sm);
	}
</style>
