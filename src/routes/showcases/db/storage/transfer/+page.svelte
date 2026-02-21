<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { PageHeader, BackLink, Card, SectionNav } from '$lib/components/composites';
	import { Badge, Button, Spinner, Progress } from '$lib/components/primitives';
	import { getToast } from '$lib/stores/toast.svelte';

	let { data } = $props();
	const toast = getToast();

	const sections = [
		{ id: 'upload', label: 'Upload' },
		{ id: 'range', label: 'Range Requests' },
		{ id: 'mime', label: 'MIME Enforcement' },
	];

	// ─── Upload state machine ───────────────────────────
	type UploadState = 'idle' | 'requesting' | 'uploading' | 'confirming' | 'done' | 'error';

	let uploadState = $state<UploadState>('idle');
	let selectedFile = $state<File | null>(null);
	let uploadProgress = $state(0);
	let uploadError = $state('');
	let uploadResult = $state<{
		key: string;
		etag: string;
		size: number;
		sizeFormatted: string;
		contentType: string;
	} | null>(null);
	let dragOver = $state(false);

	// Hold presigned URL info during upload flow
	let pendingUploadUrl = '';
	let pendingUploadKey = '';

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files?.length) {
			selectedFile = input.files[0];
			uploadError = '';
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		const file = e.dataTransfer?.files?.[0];
		if (file) {
			selectedFile = file;
			uploadError = '';
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function resetUpload() {
		uploadState = 'idle';
		selectedFile = null;
		uploadProgress = 0;
		uploadError = '';
		uploadResult = null;
		pendingUploadUrl = '';
		pendingUploadKey = '';
	}

	// Step 2: Upload file directly to R2 via XHR (for progress tracking)
	function uploadToR2(url: string, file: File): Promise<void> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			xhr.open('PUT', url);
			xhr.setRequestHeader('Content-Type', file.type);

			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) {
					uploadProgress = Math.round((e.loaded / e.total) * 100);
				}
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve();
				} else {
					reject(new Error(`Upload failed: HTTP ${xhr.status}`));
				}
			};

			xhr.onerror = () => reject(new Error('Upload failed: network error'));
			xhr.send(file);
		});
	}

	// Handle the form action result for requestUploadUrl
	const actionResult = $derived(page.form);

	$effect(() => {
		if (actionResult?.uploadUrl && uploadState === 'requesting') {
			pendingUploadUrl = actionResult.uploadUrl.url;
			pendingUploadKey = actionResult.uploadUrl.key;
			startDirectUpload();
		}
		if (actionResult?.confirmed && uploadState === 'confirming') {
			uploadResult = actionResult.confirmed;
			uploadState = 'done';
		}
	});

	async function startDirectUpload() {
		if (!selectedFile || !pendingUploadUrl) return;

		uploadState = 'uploading';
		uploadProgress = 0;

		try {
			await uploadToR2(pendingUploadUrl, selectedFile);

			// Step 3: Confirm upload via form action
			uploadState = 'confirming';
			const confirmForm = document.getElementById('confirm-form') as HTMLFormElement;
			const keyInput = confirmForm?.querySelector('input[name="key"]') as HTMLInputElement;
			if (keyInput) keyInput.value = pendingUploadKey;
			confirmForm?.requestSubmit();
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
			uploadState = 'error';
		}
	}

	// ─── Range request state ────────────────────────────
	let rangeStart = $state(0);
	let rangeEnd = $state(63);
	let fetchingRange = $state(false);
	let rangeResult = $state<{
		contentRange: string;
		contentLength: number;
		hexDump: string;
	} | null>(null);

	$effect(() => {
		if (actionResult?.range) {
			rangeResult = actionResult.range;
		}
	});
</script>

<svelte:head>
	<title>Transfer - Storage - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Transfer"
		description="Upload files via presigned URLs, fetch byte ranges, and understand MIME type enforcement."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'DB', href: '/showcases/db' },
			{ label: 'Storage', href: '/showcases/db/storage' },
			{ label: 'Transfer' }
		]}
	/>

	<SectionNav {sections} ariaLabel="Transfer operations" />

	<div class="sections">
		<!-- ═══ UPLOAD ═══ -->
		<section id="upload">
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Upload</h2>
					<p class="section-desc">Upload a file directly to R2 via a presigned URL. The server generates the URL, then the browser uploads directly to R2 — the file never passes through the server.</p>
				{/snippet}

				{#if uploadState === 'idle' || uploadState === 'error'}
					<!-- Drop zone -->
					<label
						class="drop-zone"
						class:drag-over={dragOver}
						ondrop={handleDrop}
						ondragover={handleDragOver}
						ondragleave={handleDragLeave}
					>
						<input
							type="file"
							class="file-input"
							accept="image/*,application/pdf"
							onchange={handleFileSelect}
						/>
						<span class="i-lucide-upload-cloud drop-icon" />
						<span class="drop-text">Drop a file here or click to browse</span>
						<span class="drop-hint">Images and PDF only, max 2 MB</span>
					</label>

					{#if uploadError}
						<div class="upload-error" role="alert">
							<span class="i-lucide-alert-circle h-4 w-4" />
							<span>{uploadError}</span>
						</div>
					{/if}

					{#if selectedFile}
						<div class="file-preview">
							<div class="file-info">
								<span class="i-lucide-file h-5 w-5" />
								<div>
									<span class="file-name">{selectedFile.name}</span>
									<span class="file-meta">{selectedFile.type} — {(selectedFile.size / 1024).toFixed(1)} KB</span>
								</div>
							</div>
							<form
								method="POST"
								action="?/requestUploadUrl"
								use:enhance={() => {
									uploadState = 'requesting';
									return async ({ result, update }) => {
										if (result.type === 'failure') {
											uploadError = result.data?.message || 'Failed to get upload URL';
											uploadState = 'error';
										}
										await update({ reset: false });
									};
								}}
							>
								<input type="hidden" name="fileName" value={selectedFile.name} />
								<input type="hidden" name="mimeType" value={selectedFile.type} />
								<input type="hidden" name="fileSize" value={selectedFile.size} />
								<Button type="submit" variant="primary" size="sm">
									<span class="i-lucide-upload h-4 w-4 mr-1" />
									Upload
								</Button>
							</form>
						</div>
					{/if}

				{:else if uploadState === 'requesting'}
					<div class="upload-status">
						<Spinner size="sm" />
						<span>Getting presigned URL...</span>
					</div>

				{:else if uploadState === 'uploading'}
					<div class="upload-status">
						<div class="upload-progress-section">
							<span>Uploading to R2... {uploadProgress}%</span>
							<Progress value={uploadProgress} max={100} size="md" showLabel />
						</div>
					</div>

				{:else if uploadState === 'confirming'}
					<div class="upload-status">
						<Spinner size="sm" />
						<span>Confirming upload...</span>
					</div>

				{:else if uploadState === 'done' && uploadResult}
					<div class="upload-result">
						<Badge variant="success">Upload Complete</Badge>
						<div class="diag-grid">
							<div class="diag-row">
								<span class="diag-label">Key</span>
								<code class="diag-mono">{uploadResult.key}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">Size</span>
								<code class="diag-mono">{uploadResult.sizeFormatted}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">Content-Type</span>
								<code class="diag-mono">{uploadResult.contentType}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">ETag</span>
								<code class="diag-mono">{uploadResult.etag}</code>
							</div>
						</div>
						<div class="upload-done-actions">
							<Button variant="outline" size="sm" onclick={resetUpload}>
								<span class="i-lucide-upload h-4 w-4 mr-1" />
								Upload Another
							</Button>
							<a href="/showcases/db/storage/objects" class="objects-link">
								View on Objects page
							</a>
						</div>
					</div>
				{/if}
			</Card>
		</section>

		<!-- Hidden confirm form -->
		<form
			id="confirm-form"
			method="POST"
			action="?/confirmUpload"
			class="hidden"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						uploadError = result.data?.message || 'Confirmation failed';
						uploadState = 'error';
					}
					await update({ reset: false });
				};
			}}
		>
			<input type="hidden" name="key" value="" />
		</form>

		<!-- ═══ RANGE REQUESTS ═══ -->
		<section id="range">
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Range Requests</h2>
					<p class="section-desc">Fetch a byte range from <code>showcase/large/padded.bin</code> (1 MB repeating pattern). R2 supports the <code>Range</code> HTTP header for partial reads.</p>
				{/snippet}

				<form
					method="POST"
					action="?/fetchRange"
					class="range-form"
					use:enhance={() => {
						fetchingRange = true;
						return async ({ result, update }) => {
							fetchingRange = false;
							if (result.type === 'failure') {
								toast.error(result.data?.message || 'Range request failed');
							}
							await update({ reset: false });
						};
					}}
				>
					<input type="hidden" name="key" value="showcase/large/padded.bin" />

					<div class="range-controls">
						<div class="range-field">
							<label for="range-start" class="field-label">Start byte</label>
							<input
								id="range-start"
								name="start"
								type="number"
								class="range-input"
								min={0}
								max={1048575}
								bind:value={rangeStart}
							/>
						</div>
						<div class="range-field">
							<label for="range-end" class="field-label">End byte</label>
							<input
								id="range-end"
								name="end"
								type="number"
								class="range-input"
								min={0}
								max={1048575}
								bind:value={rangeEnd}
							/>
						</div>
						<div class="range-field range-size">
							<span class="field-label">Size</span>
							<code>{rangeEnd - rangeStart + 1} bytes</code>
						</div>
					</div>

					<Button type="submit" variant="primary" size="sm" disabled={fetchingRange || rangeEnd - rangeStart > 1024}>
						{#if fetchingRange}
							<Spinner size="xs" class="mr-2" />
						{/if}
						<span class="i-lucide-download h-4 w-4 mr-1" />
						Fetch Range
					</Button>

					{#if rangeEnd - rangeStart > 1024}
						<p class="range-warn">Max 1024 bytes per request.</p>
					{/if}
				</form>

				{#if rangeResult}
					<div class="range-result">
						<div class="range-header-info">
							<Badge variant="secondary">Content-Range: {rangeResult.contentRange}</Badge>
							<Badge variant="default">{rangeResult.contentLength} bytes</Badge>
						</div>
						<pre class="hex-dump">{rangeResult.hexDump}</pre>
					</div>
				{/if}
			</Card>
		</section>

		<!-- ═══ MIME ENFORCEMENT ═══ -->
		<section id="mime">
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">MIME Enforcement</h2>
					<p class="section-desc">How presigned URLs lock Content-Type into the signature, preventing type-mismatch attacks.</p>
				{/snippet}

				<div class="mime-content">
					<div class="mime-comparison">
						<div class="mime-side mime-match">
							<h3 class="mime-heading">
								<Badge variant="success">Match</Badge>
								Correct Content-Type
							</h3>
							<p>Presigned URL was generated with <code>Content-Type: image/png</code>. Client sends <code>Content-Type: image/png</code>.</p>
							<div class="mime-result-box success">
								<code>200 OK</code> — Upload succeeds
							</div>
						</div>

						<div class="mime-side mime-mismatch">
							<h3 class="mime-heading">
								<Badge variant="error">Mismatch</Badge>
								Wrong Content-Type
							</h3>
							<p>Presigned URL was generated with <code>Content-Type: image/png</code>. Client sends <code>Content-Type: text/html</code>.</p>
							<div class="mime-result-box error">
								<code>403 SignatureDoesNotMatch</code> — Rejected
							</div>
						</div>
					</div>

					<div class="mime-code">
						<h3 class="sub-heading">How It Works</h3>
						<pre><code>// Server: Content-Type is baked into the signature
const command = new PutObjectCommand(&#123;
  Bucket: BUCKET,
  Key: key,
  ContentType: mimeType, // Locked into signature
&#125;);
const url = await getSignedUrl(s3, command, &#123;
  expiresIn: 300,
&#125;);

// Client: Must send the exact same Content-Type
fetch(url, &#123;
  method: 'PUT',
  headers: &#123; 'Content-Type': mimeType &#125;,
  body: file,
&#125;);</code></pre>
					</div>

					<div class="mime-note">
						<p>This prevents XSS attacks where an attacker could upload an HTML file disguised as an image. The signature ensures the Content-Type cannot be changed after the URL is generated.</p>
					</div>
				</div>
			</Card>
		</section>
	</div>

	<BackLink href="/showcases/db/storage" label="Storage" />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.section-desc {
		margin: var(--spacing-1) 0 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
	}

	.hidden {
		display: none;
	}

	/* ─── Upload ─── */
	.drop-zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-7) var(--spacing-4);
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-lg);
		cursor: pointer;
		transition: border-color var(--duration-fast), background var(--duration-fast);
	}

	.drop-zone:hover,
	.drop-zone.drag-over {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 5%, transparent);
	}

	.file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
	}

	.drop-icon {
		width: 2.5rem;
		height: 2.5rem;
		color: var(--color-muted);
	}

	.drop-text {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.drop-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.file-preview {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-4);
	}

	.file-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.file-name {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
		display: block;
	}

	.file-meta {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.upload-error {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-4);
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
	}

	.upload-status {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		padding: var(--spacing-4) 0;
	}

	.upload-progress-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.upload-result {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.upload-done-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
	}

	.objects-link {
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
	}

	/* ─── Diag grid (shared) ─── */
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		flex-shrink: 0;
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
		text-align: right;
	}

	/* ─── Range requests ─── */
	.range-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.range-controls {
		display: flex;
		gap: var(--spacing-4);
		flex-wrap: wrap;
		align-items: flex-end;
	}

	.range-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.field-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
	}

	.range-input {
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		width: 140px;
	}

	.range-size {
		justify-content: flex-end;
	}

	.range-size code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
	}

	.range-warn {
		color: var(--color-error);
		font-size: var(--text-fluid-xs);
		margin: 0;
	}

	.range-result {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.range-header-info {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.hex-dump {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		overflow-x: auto;
		margin: 0;
		white-space: pre;
	}

	/* ─── MIME enforcement ─── */
	.mime-content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.mime-comparison {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-4);
	}

	.mime-side {
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.mime-side p {
		margin: var(--spacing-2) 0 var(--spacing-3);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.mime-heading {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0;
	}

	.mime-result-box {
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-sm);
	}

	.mime-result-box.success {
		background: color-mix(in srgb, var(--color-success) 10%, transparent);
		color: var(--color-success);
	}

	.mime-result-box.error {
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		color: var(--color-error);
	}

	.mime-code pre {
		margin: 0;
		padding: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		overflow-x: auto;
	}

	.mime-code pre code {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		line-height: 1.6;
		white-space: pre;
	}

	.sub-heading {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0 0 var(--spacing-3);
	}

	.mime-note p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		font-style: italic;
	}

	@media (min-width: 768px) {
		.page {
			padding: var(--spacing-7);
		}
	}

	@media (max-width: 640px) {
		.page {
			padding: var(--spacing-4);
		}

		.mime-comparison {
			grid-template-columns: 1fr;
		}

		.range-controls {
			flex-direction: column;
		}
	}
</style>
