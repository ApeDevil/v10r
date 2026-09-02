<script lang="ts">
import {
	Alert,
	BackLink,
	BoundaryFallback,
	Card,
	DiagGrid,
	DiagRow,
	NavSection,
	PageHeader,
	ShowcaseDocs,
} from '$lib/components/composites';
import { CodeBlock } from '$lib/components/composites/info-dialog';
import { Button, Select, Spinner, Textarea } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import {
	DIRTY_SNIPPET,
	headExcerpt,
	llmsStats,
	parseToolResult,
	splitNextActions,
	toolCallBody,
} from '$lib/showcases/ax/demo';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// Every demo hits the real, same-origin surface an external agent uses.
const MCP_ENDPOINT = '/api/mcp/public';
const DOC_CLEAN_URL = '/docs/foundation/architecture';
const DOC_MD_URL = '/docs/foundation/architecture.md';

const sections = $derived([
	{ id: 'ax-surfaces', label: m.showcase_ax_section_surfaces() },
	{ id: 'ax-markdown', label: m.showcase_ax_section_markdown() },
	{ id: 'ax-llms', label: m.showcase_ax_section_llms() },
	{ id: 'ax-errors', label: m.showcase_ax_section_errors() },
	{ id: 'ax-validate', label: m.showcase_ax_section_validate() },
	{ id: 'ax-agents', label: m.showcase_ax_section_agents() },
]);

const surfaceCards = $derived([
	{
		icon: 'i-lucide-file-text',
		title: m.showcase_ax_surface_agents_title(),
		description: m.showcase_ax_surface_agents_description(),
	},
	{
		icon: 'i-lucide-file-code',
		title: m.showcase_ax_surface_markdown_title(),
		description: m.showcase_ax_surface_markdown_description(),
	},
	{
		icon: 'i-lucide-map',
		title: m.showcase_ax_surface_llms_title(),
		description: m.showcase_ax_surface_llms_description(),
	},
	{
		icon: 'i-lucide-wrench',
		title: m.showcase_ax_surface_mcp_title(),
		description: m.showcase_ax_surface_mcp_description(),
	},
]);

type ToolState = 'idle' | 'running' | 'done' | 'error';

let liveStatus = $state('');

interface NegotiateResult {
	redirected: boolean;
	url: string;
	contentType: string;
	excerpt: string;
}
let negotiateState = $state<ToolState>('idle');
let negotiateError = $state('');
let negotiateResult = $state<NegotiateResult | null>(null);

interface DirectResult {
	contentType: string;
	linkHeader: string;
	excerpt: string;
}
let directState = $state<ToolState>('idle');
let directError = $state('');
let directResult = $state<DirectResult | null>(null);

async function runNegotiate() {
	if (negotiateState === 'running') return;
	negotiateState = 'running';
	negotiateError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch(DOC_CLEAN_URL, { headers: { accept: 'text/markdown' } });
		const text = await res.text();
		negotiateResult = {
			redirected: res.redirected,
			url: new URL(res.url).pathname,
			contentType: res.headers.get('content-type') ?? '',
			excerpt: headExcerpt(text, 10),
		};
		negotiateState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		negotiateState = 'error';
		negotiateError = m.showcase_ax_error_network();
		liveStatus = negotiateError;
	}
}

async function runDirect() {
	if (directState === 'running') return;
	directState = 'running';
	directError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch(DOC_MD_URL);
		const text = await res.text();
		directResult = {
			contentType: res.headers.get('content-type') ?? '',
			linkHeader: res.headers.get('link') ?? '',
			excerpt: headExcerpt(text, 10),
		};
		directState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		directState = 'error';
		directError = m.showcase_ax_error_network();
		liveStatus = directError;
	}
}

// /llms.txt
interface LlmsResult {
	lines: number;
	docUrls: number;
	excerpt: string;
}
let llmsState = $state<ToolState>('idle');
let llmsError = $state('');
let llmsResult = $state<LlmsResult | null>(null);

async function runLlms() {
	if (llmsState === 'running') return;
	llmsState = 'running';
	llmsError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch('/llms.txt');
		const text = await res.text();
		const stats = llmsStats(text);
		llmsResult = { ...stats, excerpt: headExcerpt(text, 24) };
		llmsState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		llmsState = 'error';
		llmsError = m.showcase_ax_error_network();
		liveStatus = llmsError;
	}
}

// Self-correcting errors
interface BadIdResult {
	body: string;
	actions: string[];
}
let badIdState = $state<ToolState>('idle');
let badIdError = $state('');
let badIdResult = $state<BadIdResult | null>(null);

interface ProtocolResult {
	status: number;
	body: string;
}
let protocolState = $state<ToolState>('idle');
let protocolError = $state('');
let protocolResult = $state<ProtocolResult | null>(null);

async function runBadId() {
	if (badIdState === 'running') return;
	badIdState = 'running';
	badIdError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch(MCP_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(toolCallBody('get_pattern', { id: 'not-a-real-pattern' }, 2)),
		});
		const outcome = parseToolResult(await res.json());
		badIdResult = splitNextActions(outcome.text);
		badIdState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		badIdState = 'error';
		badIdError = m.showcase_ax_error_network();
		liveStatus = badIdError;
	}
}

async function runProtocol() {
	if (protocolState === 'running') return;
	protocolState = 'running';
	protocolError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch(MCP_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'mcp-protocol-version': '1999-01-01' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' }),
		});
		const raw = await res.text();
		let body = raw;
		try {
			body = JSON.stringify(JSON.parse(raw), null, 2);
		} catch {
			// keep the raw text
		}
		protocolResult = { status: res.status, body };
		protocolState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		protocolState = 'error';
		protocolError = m.showcase_ax_error_network();
		liveStatus = protocolError;
	}
}

const languageOptions = [
	{ value: 'svelte', label: 'Svelte' },
	{ value: 'ts', label: 'TypeScript' },
];
let snippet = $state(DIRTY_SNIPPET);
let language = $state('svelte');
let validateState = $state<ToolState>('idle');
let validateError = $state('');
let report = $state('');
let clean = $state(false);

const requestPreview = $derived(
	JSON.stringify(toolCallBody('validate_snippet', { snippet: '<your snippet>', language }, 1), null, 2),
);

async function runValidate() {
	if (validateState === 'running') return;
	validateState = 'running';
	validateError = '';
	liveStatus = m.showcase_ax_running();
	try {
		const res = await fetch(MCP_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(toolCallBody('validate_snippet', { snippet, language }, 1)),
		});
		const outcome = parseToolResult(await res.json());
		report = outcome.text;
		clean = !outcome.isError && outcome.text.startsWith('No issues found');
		validateState = 'done';
		liveStatus = m.showcase_ax_status_done();
	} catch {
		validateState = 'error';
		validateError = m.showcase_ax_error_network();
		liveStatus = validateError;
	}
}

function restoreExample() {
	snippet = DIRTY_SNIPPET;
	language = 'svelte';
	report = '';
	clean = false;
	validateState = 'idle';
	validateError = '';
}
</script>

<div class="page">
	<PageHeader
		title={m.showcase_ax_title()}
		description={m.showcase_ax_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_ax_title() }
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavSection {sections} />

	<p class="sr-only" aria-live="polite">{liveStatus}</p>

	<svelte:boundary>
	<main class="content">
		<p class="lead">{m.showcase_ax_intro_lead()}</p>

		<!-- The four surfaces -->
		<section id="ax-surfaces" class="section">
			<h2 class="section-title">{m.showcase_ax_section_surfaces()}</h2>
			<div class="surface-grid">
				{#each surfaceCards as card}
					<Card>
						{#snippet header()}
							<div class="surface-header">
								<span class="{card.icon} text-icon-sm surface-icon" aria-hidden="true"></span>
								<span class="surface-title">{card.title}</span>
							</div>
						{/snippet}
						<p class="surface-summary">{card.description}</p>
					</Card>
				{/each}
			</div>
		</section>

		<!-- Markdown negotiation -->
		<section id="ax-markdown" class="section">
			<h2 class="section-title">{m.showcase_ax_section_markdown()}</h2>
			<p class="section-description">{m.showcase_ax_markdown_lead()}</p>

			<div class="demo-block">
				<div class="actions">
					<Button onclick={runNegotiate} disabled={negotiateState === 'running'}>
						{#if negotiateState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_markdown_run_negotiate()}
					</Button>
					<Button variant="secondary" onclick={runDirect} disabled={directState === 'running'}>
						{#if directState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_markdown_run_direct()}
					</Button>
				</div>
				{#if negotiateError}<Alert variant="error" description={negotiateError} />{/if}
				{#if directError}<Alert variant="error" description={directError} />{/if}
				{#if negotiateResult}
					<DiagGrid>
						<DiagRow label={m.showcase_ax_markdown_redirected()}><code>{String(negotiateResult.redirected)}</code></DiagRow>
						<DiagRow label={m.showcase_ax_markdown_final_url()}><code>{negotiateResult.url}</code></DiagRow>
						<DiagRow label={m.showcase_ax_markdown_content_type()}><code>{negotiateResult.contentType}</code></DiagRow>
					</DiagGrid>
					<CodeBlock code={negotiateResult.excerpt} language="markdown" filename={negotiateResult.url} />
				{/if}
				{#if directResult}
					<DiagGrid>
						<DiagRow label={m.showcase_ax_markdown_content_type()}><code>{directResult.contentType}</code></DiagRow>
						<DiagRow label={m.showcase_ax_markdown_link_header()}><code class="wrap-code">{directResult.linkHeader}</code></DiagRow>
					</DiagGrid>
					<CodeBlock code={directResult.excerpt} language="markdown" filename={DOC_MD_URL} />
				{/if}
			</div>
		</section>

		<!-- llms.txt -->
		<section id="ax-llms" class="section">
			<h2 class="section-title">{m.showcase_ax_section_llms()}</h2>
			<p class="section-description">{m.showcase_ax_llms_lead()}</p>

			<div class="demo-block">
				<div class="actions">
					<Button onclick={runLlms} disabled={llmsState === 'running'}>
						{#if llmsState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_llms_run()}
					</Button>
				</div>
				{#if llmsError}<Alert variant="error" description={llmsError} />{/if}
				{#if llmsResult}
					<div class="stats-grid">
						<div class="stat-card">
							<span class="stat-value">{llmsResult.lines}</span>
							<span class="stat-label">{m.showcase_ax_llms_stat_lines()}</span>
						</div>
						<div class="stat-card">
							<span class="stat-value">{llmsResult.docUrls}</span>
							<span class="stat-label">{m.showcase_ax_llms_stat_urls()}</span>
						</div>
					</div>
					<CodeBlock code={llmsResult.excerpt} language="markdown" filename="/llms.txt" />
				{/if}
			</div>
		</section>

		<!-- Self-correcting errors -->
		<section id="ax-errors" class="section">
			<h2 class="section-title">{m.showcase_ax_section_errors()}</h2>
			<p class="section-description">{m.showcase_ax_errors_lead()}</p>

			<div class="demo-block">
				<div class="actions">
					<Button onclick={runBadId} disabled={badIdState === 'running'}>
						{#if badIdState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_errors_run_bad_id()}
					</Button>
					<Button variant="secondary" onclick={runProtocol} disabled={protocolState === 'running'}>
						{#if protocolState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_errors_run_protocol()}
					</Button>
				</div>
				{#if badIdError}<Alert variant="error" description={badIdError} />{/if}
				{#if protocolError}<Alert variant="error" description={protocolError} />{/if}
				{#if badIdResult}
					<CodeBlock code={badIdResult.body} language="text" filename="tools/call · get_pattern" />
					{#if badIdResult.actions.length > 0}
						<p class="trailer-note">{m.showcase_ax_errors_trailer_note()}</p>
						<ul class="actions-list">
							{#each badIdResult.actions as action}
								<li><code>{action}</code></li>
							{/each}
						</ul>
					{/if}
				{/if}
				{#if protocolResult}
					<DiagGrid>
						<DiagRow label={m.showcase_ax_errors_status()}><code>{protocolResult.status}</code></DiagRow>
					</DiagGrid>
					<CodeBlock code={protocolResult.body} language="json" filename="MCP-Protocol-Version: 1999-01-01" />
				{/if}
			</div>
		</section>

		<!-- validate_snippet loop -->
		<section id="ax-validate" class="section">
			<h2 class="section-title">{m.showcase_ax_section_validate()}</h2>
			<p class="section-description">{m.showcase_ax_validate_lead()}</p>

			<div class="demo-block">
				<Textarea bind:value={snippet} rows={12} class="snippet-input" aria-label={m.showcase_ax_section_validate()} />
				<div class="actions">
					<div class="field">
						<span class="field-label">{m.showcase_ax_validate_language()}</span>
						<Select options={languageOptions} bind:value={language} class="language-select" />
					</div>
					<Button onclick={runValidate} disabled={validateState === 'running'}>
						{#if validateState === 'running'}<Spinner size="sm" variant="muted" />{/if}
						{m.showcase_ax_validate_run()}
					</Button>
					<Button variant="ghost" onclick={restoreExample}>{m.showcase_ax_validate_reset()}</Button>
				</div>
				{#if validateError}<Alert variant="error" description={validateError} />{/if}
				{#if clean}<Alert variant="success" title={m.showcase_ax_validate_clean()} />{/if}
				{#if report}
					<CodeBlock code={report} language="text" filename="tools/call · validate_snippet" />
					<p class="trailer-note">{m.showcase_ax_validate_loop_note()}</p>
				{/if}
				<p class="trailer-note">{m.showcase_ax_validate_request_label()}</p>
				<CodeBlock code={requestPreview} language="json" filename="POST {MCP_ENDPOINT}" />
			</div>
		</section>

		<!-- AGENTS.md -->
		<section id="ax-agents" class="section">
			<h2 class="section-title">{m.showcase_ax_section_agents()}</h2>
			<p class="section-description">{m.showcase_ax_agents_lead()}</p>
			<div class="doc-scroll">
				<CodeBlock code={data.agentsMd} language="markdown" filename="AGENTS.md" />
			</div>
		</section>
	</main>

	{#snippet failed(error, reset)}
		<BoundaryFallback {reset} />
	{/snippet}
	</svelte:boundary>

	<BackLink href="/showcases" label={m.showcase_breadcrumb_showcases()} />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.lead {
		margin: 0 0 var(--spacing-8) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-6) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.surface-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--spacing-4);
		margin-top: var(--spacing-5);
	}

	.surface-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.surface-icon {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.surface-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.surface-summary {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.demo-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--spacing-3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 11rem;
	}

	.field-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: var(--spacing-3);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
	}

	.stat-value {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		color: var(--color-fg);
		line-height: 1;
	}

	.stat-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.trailer-note {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.actions-list {
		margin: 0;
		padding: var(--spacing-3) var(--spacing-4);
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border: 1px solid var(--color-border);
		border-left: 3px solid var(--color-primary);
		border-radius: var(--radius-md);
		background: var(--surface-1);
	}

	.actions-list code,
	.wrap-code {
		word-break: break-word;
	}

	.doc-scroll {
		max-height: 28rem;
		overflow-y: auto;
		border-radius: var(--radius-lg);
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
	}
</style>
