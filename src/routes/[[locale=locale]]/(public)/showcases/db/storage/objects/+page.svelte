<script lang="ts">
import { enhance } from '$app/forms';
import { page } from '$app/state';
import { Alert, Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import {
	Badge,
	Body,
	Button,
	Cell,
	Header,
	HeaderCell,
	Row,
	Select,
	Spinner,
	Table,
	ToggleGroup,
	Typography,
} from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();
const toast = getToast();

const sections = $derived([
	{ id: 'browser', label: m.showcase_db_storage_objects_nav_browser() },
	{ id: 'metadata', label: m.showcase_db_storage_objects_nav_metadata() },
	{ id: 'presigned', label: m.showcase_db_storage_objects_nav_presigned() },
]);

// ─── Metadata inspection state ──────────────────────
let selectedKey = $state('');
let inspecting = $state(false);
let inspectedDetail = $state<{
	key: string;
	size: number;
	sizeFormatted: string;
	lastModified: string;
	etag: string;
	contentType?: string;
	metadata: Record<string, string>;
	cacheControl?: string;
	contentEncoding?: string;
} | null>(null);

// ─── Presigned URL state ────────────────────────────
let presignKey = $state('');
let presignExpiry = $state('300');
let generating = $state(false);
let presignedResult = $state<{ url: string; expiresIn: number; expiresAt: string } | null>(null);
let countdown = $state(0);
let countdownInterval: ReturnType<typeof setInterval> | undefined;

function startCountdown(seconds: number) {
	if (countdownInterval) clearInterval(countdownInterval);
	countdown = seconds;
	countdownInterval = setInterval(() => {
		countdown--;
		if (countdown <= 0) {
			clearInterval(countdownInterval);
			countdownInterval = undefined;
		}
	}, 1000);
}

function formatCountdown(s: number): string {
	const m = Math.floor(s / 60);
	const sec = s % 60;
	return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function copyToClipboard(text: string) {
	navigator.clipboard.writeText(text).then(
		() => toast.success('Copied to clipboard'),
		() => toast.error('Failed to copy'),
	);
}

function handleInspect(key: string) {
	selectedKey = key;
	document.getElementById('metadata')?.scrollIntoView({ behavior: 'smooth' });
}

const actionResult = $derived(page.form);

$effect(() => {
	if (actionResult?.detail) {
		inspectedDetail = actionResult.detail;
	}
	if (actionResult?.presigned) {
		presignedResult = actionResult.presigned;
		startCountdown(actionResult.presigned.expiresIn);
	}
});
</script>
{#if data.error}
		<Alert variant="error" title="Error" description={data.error} />
	{:else}
		<NavSection {sections} ariaLabel="Object operations" />

		<Stack gap="7">
			<!-- ═══ BROWSER ═══ -->
			<section id="browser">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">{m.showcase_db_storage_objects_card_browser()}</Typography>
						<p class="section-desc">{data.objects.length} objects in the showcase namespace.</p>
					{/snippet}

					{#if data.objects.length > 0}
						<div class="table-wrap">
							<Table>
								<Header>
									<Row>
										<HeaderCell>{m.showcase_db_storage_objects_col_key()}</HeaderCell>
										<HeaderCell>{m.showcase_db_storage_objects_col_size()}</HeaderCell>
										<HeaderCell>{m.showcase_db_storage_objects_col_modified()}</HeaderCell>
										<HeaderCell>{m.showcase_db_storage_objects_col_action()}</HeaderCell>
									</Row>
								</Header>
								<Body>
									{#each data.objects as obj (obj.key)}
										<Row>
											<Cell>
												<code class="key-cell">{obj.key}</code>
											</Cell>
											<Cell><code class="mono-cell">{obj.sizeFormatted}</code></Cell>
											<Cell>
												<code class="mono-cell">
													{new Date(obj.lastModified).toLocaleString('en-US', {
														month: 'short', day: 'numeric',
														hour: '2-digit', minute: '2-digit',
													})}
												</code>
											</Cell>
											<Cell>
												<form
													method="POST"
													action="?/inspect"
													use:enhance={() => {
														inspecting = true;
														selectedKey = obj.key;
														return async ({ result, update }) => {
															inspecting = false;
															if (result.type === 'failure') {
																toast.error((result.data?.message as string) || 'Inspect failed');
															}
															await update({ reset: false });
															document.getElementById('metadata')?.scrollIntoView({ behavior: 'smooth' });
														};
													}}
												>
													<input type="hidden" name="key" value={obj.key} />
													<Button type="submit" variant="ghost" size="sm">
														<span class="i-lucide-eye h-3.5 w-3.5 mr-1" ></span>
														{m.showcase_db_storage_objects_inspect()}
													</Button>
												</form>
											</Cell>
										</Row>
									{/each}
								</Body>
							</Table>
						</div>
					{:else}
						<Typography variant="muted" as="p" class="italic">No objects. Go to the <a href="/showcases/db/storage/connection" class="text-primary">Connection</a> page and click Reseed.</Typography>
					{/if}
				</Card>
			</section>

			<!-- ═══ METADATA ═══ -->
			<section id="metadata">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">{m.showcase_db_storage_objects_card_metadata()}</Typography>
						<p class="section-desc">
							{#if inspectedDetail}
								Inspecting <code>{inspectedDetail.key}</code>
							{:else}
								Click Inspect on an object above to view its metadata.
							{/if}
						</p>
					{/snippet}

					{#if inspecting}
						<div class="loading-state">
							<Spinner size="sm" />
							<span>Loading metadata for {selectedKey}...</span>
						</div>
					{:else if inspectedDetail}
						<div class="diag-grid">
							<div class="diag-row">
								<span class="diag-label">Key</span>
								<code class="diag-mono">{inspectedDetail.key}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">Content-Type</span>
								<code class="diag-mono">{inspectedDetail.contentType ?? 'unknown'}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">Size</span>
								<code class="diag-mono">{inspectedDetail.sizeFormatted}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">ETag</span>
								<code class="diag-mono">{inspectedDetail.etag}</code>
							</div>
							<div class="diag-row">
								<span class="diag-label">Last Modified</span>
								<code class="diag-mono">{new Date(inspectedDetail.lastModified).toLocaleString()}</code>
							</div>
							{#if inspectedDetail.cacheControl}
								<div class="diag-row">
									<span class="diag-label">Cache-Control</span>
									<code class="diag-mono">{inspectedDetail.cacheControl}</code>
								</div>
							{/if}
							{#if inspectedDetail.contentEncoding}
								<div class="diag-row">
									<span class="diag-label">Content-Encoding</span>
									<code class="diag-mono">{inspectedDetail.contentEncoding}</code>
								</div>
							{/if}
						</div>

						{#if Object.keys(inspectedDetail.metadata).length > 0}
							<div class="custom-metadata">
								<Typography variant="h6" as="h3" class="mb-3">Custom Metadata</Typography>
								<div class="diag-grid">
									{#each Object.entries(inspectedDetail.metadata) as [k, v]}
										<div class="diag-row">
											<span class="diag-label">{k}</span>
											<code class="diag-mono">{v}</code>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					{:else}
						<Typography variant="muted" as="p" class="italic">No object selected. Click Inspect in the Browser section above.</Typography>
					{/if}
				</Card>
			</section>

			<!-- ═══ PRESIGNED URLs ═══ -->
			<section id="presigned">
				<Card>
					{#snippet header()}
						<Typography variant="h5" as="h2">{m.showcase_db_storage_objects_card_presigned()}</Typography>
						<p class="section-desc">Generate a temporary, signed URL for direct download. The URL expires after the selected duration.</p>
					{/snippet}

					<form
						method="POST"
						action="?/presign"
						class="presign-form"
						use:enhance={() => {
							generating = true;
							return async ({ result, update }) => {
								generating = false;
								if (result.type === 'failure') {
									toast.error((result.data?.message as string) || 'Failed to generate URL');
								}
								await update({ reset: false });
							};
						}}
					>
						<div class="presign-controls">
							<div class="presign-field">
								<span class="field-label">Object</span>
								<input type="hidden" name="key" value={presignKey} />
								<Select
									options={data.objects.map((obj) => ({ value: obj.key, label: obj.key }))}
									bind:value={presignKey}
									placeholder="Select an object..."
								/>
							</div>

							<div class="presign-field">
								<span class="field-label">Expiry</span>
								<input type="hidden" name="expiresIn" value={presignExpiry} />
								<ToggleGroup
									type="single"
									bind:value={presignExpiry}
									items={[
										{ value: '300', label: '5 min' },
										{ value: '3600', label: '1 hr' },
										{ value: '86400', label: '24 hr' },
									]}
								/>
							</div>
						</div>

						<Button type="submit" variant="primary" size="sm" disabled={!presignKey || generating}>
							{#if generating}
								<Spinner size="xs" class="mr-2" />
							{/if}
							<span class="i-lucide-link h-4 w-4 mr-1" ></span>
							{m.showcase_db_storage_objects_generate_url()}
						</Button>
					</form>

					{#if presignedResult}
						<Stack gap="3" class="pt-4 border-t border-border">
							<div class="presign-url-row">
								<code class="presign-url">{presignedResult.url}</code>
								<Button variant="ghost" size="sm" onclick={() => copyToClipboard(presignedResult!.url)}>
									<span class="i-lucide-copy h-3.5 w-3.5" ></span>
								</Button>
								<a href={presignedResult.url} target="_blank" rel="noopener noreferrer">
									<Button variant="ghost" size="sm">
										<span class="i-lucide-external-link h-3.5 w-3.5" ></span>
									</Button>
								</a>
							</div>
							<div class="presign-info">
								{#if countdown > 0}
									<Badge variant="success">Expires in {formatCountdown(countdown)}</Badge>
								{:else}
									<Badge variant="error">Expired</Badge>
								{/if}
							</div>
						</Stack>
					{/if}
				</Card>
			</section>
		</Stack>
	{/if}


<style>
	.section-desc {
		margin: var(--spacing-1) 0 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.5;
	}

	.table-wrap {
		overflow-x: auto;
	}

	.key-cell {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.mono-cell {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	/* ─── Metadata ─── */
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

	.loading-state {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.custom-metadata {
		margin-top: var(--spacing-5);
		padding-top: var(--spacing-5);
		border-top: 1px solid var(--color-border);
	}

	/* ─── Presigned URLs ─── */
	.presign-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.presign-controls {
		display: flex;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.presign-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		flex: 1;
		min-width: 200px;
	}

	.field-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
	}

	.presign-url-row {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.presign-url {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		flex: 1;
		line-height: 1.5;
	}

	.presign-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	@media (max-width: 640px) {
		.presign-controls {
			flex-direction: column;
		}
	}
</style>
