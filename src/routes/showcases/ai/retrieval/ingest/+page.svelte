<script lang="ts">
	import { PageHeader, BackLink, Card, Alert, FormField } from '$lib/components/composites';
	import { Typography, Button } from '$lib/components/primitives';
	import { PageContainer, Stack } from '$lib/components/layout';

	let { data } = $props();

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
				const data = await res.json();
				documents = data.documents ?? [];
			}
		} catch { /* ignore */ }
	}

	async function ingestDocument() {
		if (!title.trim() || !content.trim() || loading) return;

		loading = true;
		error = null;
		result = null;

		try {
			const res = await fetch('/api/retrieval/ingest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title: title.trim(), content: content.trim() }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}

			result = await res.json();
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
			const res = await fetch(`/api/retrieval/documents/${id}`, { method: 'DELETE' });
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

<PageContainer class="py-7">
	<PageHeader
		title="Document Ingestion"
		description="Upload documents to the RAG pipeline. Documents are chunked, contextualized, embedded, and indexed for retrieval."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
			{ label: 'Ingest' }
		]}
	/>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider to enable document ingestion (requires OpenAI for embeddings).</p>
			</Alert>
		{:else}
			<Card>
				{#snippet header()}
					<Typography variant="h5" as="h2">Ingest Document</Typography>
				{/snippet}

				<Stack gap="4">
					<FormField label="Title" id="doc-title">
						<input
							id="doc-title"
							type="text"
							bind:value={title}
							placeholder="Document title..."
							class="ingest-input"
							disabled={loading}
						/>
					</FormField>

					<FormField label="Content" id="doc-content">
						<textarea
							id="doc-content"
							bind:value={content}
							placeholder="Paste document content (markdown supported)..."
							class="ingest-textarea"
							rows="12"
							disabled={loading}
						></textarea>
					</FormField>

					<div class="flex flex-wrap gap-3">
						<Button variant="primary" onclick={ingestDocument} disabled={loading || !title.trim() || !content.trim()}>
							{#if loading}
								<span class="i-lucide-loader-2 h-4 w-4 animate-spin"></span>
								Processing...
							{:else}
								<span class="i-lucide-upload h-4 w-4"></span>
								Ingest Document
							{/if}
						</Button>

						<Button
							variant="secondary"
							onclick={() => { title = 'SvelteKit Routing'; content = SAMPLE_DOC; }}
							disabled={loading}
						>
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
										{doc.totalChunks} chunks · {doc.totalTokens.toLocaleString()} tokens
										· {doc.status}
									</span>
								</div>
								<button
									class="doc-delete"
									onclick={() => deleteDocument(doc.id)}
									aria-label="Delete {doc.title}"
								>
									<span class="i-lucide-trash-2 h-4 w-4"></span>
								</button>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		{/if}
	</Stack>

	<BackLink href="/showcases/ai/retrieval" label="Retrieval" />
</PageContainer>

<style>
	.ingest-input,
	.ingest-textarea {
		width: 100%;
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background-color: var(--color-surface-1);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		font-family: inherit;
		outline: none;
		transition: border-color 150ms;
	}

	.ingest-input:focus,
	.ingest-textarea:focus {
		border-color: var(--color-primary);
	}

	.ingest-textarea {
		resize: vertical;
		min-height: 120px;
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

	.doc-delete {
		padding: var(--spacing-2);
		border: none;
		background: none;
		color: var(--color-muted);
		cursor: pointer;
		border-radius: var(--radius-sm);
		transition: color 150ms;
	}

	.doc-delete:hover {
		color: var(--color-error-fg);
	}
</style>
