<script lang="ts">
import type { SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import { Alert, Card, ConfirmDialog, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner, Switch, Typography } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import type { NameSourceTestResult } from '$lib/name-check/connection';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();

const toast = getToast();
const copy = $derived(data.labels.copy);

type Connection = (typeof data.connections)[number];
type Vendor = Connection['vendor'];
type Draft = { enabled: boolean; clientId: string; secret: string; apiBase: string; tokenUrl: string };
type TestView = NameSourceTestResult & { target: 'draft' | 'saved'; version: number };

// ── Drafts ─────────────────────────────────────────────────────────────────────
// One draft per card, seeded from the saved connection and re-seeded whenever a save lands
// (a new `version` arrives) so the password field never keeps a secret past its submit.

function draftOf(c: Connection): Draft {
	return {
		enabled: c.enabled,
		clientId: c.clientId ?? '',
		secret: '',
		apiBase: c.apiBase ?? '',
		tokenUrl: c.tokenUrl ?? '',
	};
}

let drafts = $state<Record<string, Draft>>(Object.fromEntries(data.connections.map((c) => [c.vendor, draftOf(c)])));
let seededVersions = $state<Record<string, number>>(
	Object.fromEntries(data.connections.map((c) => [c.vendor, c.version])),
);
let testResults = $state<Record<string, TestView | null>>({});
let cardErrors = $state<Record<string, string | null>>({});
let submitting = $state<{ vendor: string; kind: 'save' | 'test' | 'remove' } | null>(null);
let confirmRemove = $state<Vendor | null>(null);
let removeForms = $state<Record<string, HTMLFormElement | undefined>>({});

$effect(() => {
	for (const c of data.connections) {
		if (seededVersions[c.vendor] !== c.version) {
			drafts[c.vendor] = draftOf(c);
			seededVersions[c.vendor] = c.version;
			testResults[c.vendor] = null;
		}
	}
});

/** Any edit invalidates a shown test result — it belonged to the fields as they were. */
function touched(vendor: string) {
	testResults[vendor] = null;
	cardErrors[vendor] = null;
}

const noneConnected = $derived(!data.unavailable && data.connections.every((c) => !c.configured));

function testTarget(test: TestView): string {
	return test.target === 'draft' ? copy.test_target_draft : `${copy.test_target_saved} ${test.version}`;
}

// ── Form wiring ────────────────────────────────────────────────────────────────
// One `<form>` per card serves both Save and Test: the Test button carries a `formaction`,
// and the enhance callback tells the two apart by the action it was submitted to. A test
// never reloads the page data (the draft must survive it); a save does.

function enhanceCard(vendor: Vendor) {
	return (({ action }: { action: URL }) => {
		const kind = action.search.includes('/test') ? 'test' : 'save';
		submitting = { vendor, kind };
		cardErrors[vendor] = null;
		return async ({
			result,
			update,
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			submitting = null;
			if (result.type === 'failure') {
				const message = (result.data?.message as string | undefined) || copy.unavailable_title;
				cardErrors[vendor] = message;
				toast.error(message);
				return update({ reset: false, invalidateAll: false });
			}
			if (kind === 'test') {
				if (result.type === 'success' && result.data?.test) testResults[vendor] = result.data.test as TestView;
				return update({ reset: false, invalidateAll: false });
			}
			if (result.type === 'success' && result.data?.message) toast.success(result.data.message as string);
			return update();
		};
	}) as unknown as SubmitFunction;
}

function enhanceRemove(vendor: Vendor) {
	return (() => {
		submitting = { vendor, kind: 'remove' };
		return async ({
			result,
			update,
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			submitting = null;
			if (result.type === 'failure') {
				const message = (result.data?.message as string | undefined) || copy.unavailable_title;
				cardErrors[vendor] = message;
				toast.error(message);
			} else if (result.type === 'success' && result.data?.message) {
				toast.success(result.data.message as string);
			}
			return update();
		};
	}) as unknown as SubmitFunction;
}

function isBusy(vendor: string, kind: 'save' | 'test' | 'remove'): boolean {
	return submitting?.vendor === vendor && submitting.kind === kind;
}

function keyStatusVariant(status: Connection['keyStatus']): 'success' | 'error' | 'secondary' {
	if (status === 'ready') return 'success';
	if (status === 'undecryptable') return 'error';
	return 'secondary';
}
</script>

<Stack gap="6">
	<Typography variant="h1">{copy.title}</Typography>
	<p class="intro">{copy.intro}</p>

	{#if data.unavailable}
		<Alert variant="error" title={copy.unavailable_title} description={copy.unavailable_body} />
	{/if}
	{#if data.degraded}
		<Alert variant="warning" title={copy.degraded_title} description={copy.degraded_body} />
	{/if}
	{#if !data.encryptionConfigured}
		<Alert variant="error" description={copy.encryption_missing} />
	{/if}
	{#if noneConnected}
		<Alert variant="info" description={copy.none_connected} />
	{/if}

	<div class="connection-grid">
		{#each data.connections as c (c.vendor)}
			{@const draft = drafts[c.vendor] ?? draftOf(c)}
			{@const test = testResults[c.vendor] ?? null}
			{@const error = cardErrors[c.vendor] ?? null}
			{@const secretLabel = c.vendor === 'euipo' ? copy.client_secret_label : copy.api_key_label}
			<Card>
				{#snippet header()}
					<Cluster gap="2" align="center" justify="between" wrap>
						<Cluster gap="2" align="center">
							<span class="health-dot health-dot--{c.configured ? 'success' : 'secondary'}"></span>
							<h2 class="text-fluid-lg font-semibold">{c.name}</h2>
						</Cluster>
						<Badge variant={c.configured ? 'success' : 'secondary'}>
							{c.configured ? copy.status_configured : copy.status_not_configured}
						</Badge>
					</Cluster>
				{/snippet}

				<form method="POST" action="?/save" use:enhance={enhanceCard(c.vendor)} autocomplete="off">
					<input type="hidden" name="vendor" value={c.vendor} />
					<input type="hidden" name="version" value={c.version} />
					<input type="hidden" name="enabled" value={String(draft.enabled)} />

					<Stack gap="4">
						<p class="note">{data.labels.vendorNotes[c.vendor]}</p>

						<Cluster gap="2" align="center">
							<Switch
								id="enabled-{c.vendor}"
								checked={draft.enabled}
								onCheckedChange={(checked) => {
									draft.enabled = checked;
									touched(c.vendor);
								}}
							/>
							<label for="enabled-{c.vendor}" class="field-label">{copy.enabled}</label>
						</Cluster>

						{#if c.vendor === 'euipo'}
							<FormField id="client-id-{c.vendor}" label={copy.client_id_label} description={copy.client_id_hint}>
								{#snippet children({ fieldId, describedBy })}
									<Input
										id={fieldId}
										name="clientId"
										bind:value={draft.clientId}
										aria-describedby={describedBy}
										oninput={() => touched(c.vendor)}
									/>
								{/snippet}
							</FormField>
						{/if}

						<FormField id="secret-{c.vendor}" label={secretLabel} description={c.hasSecret ? copy.secret_hint_keep : undefined}>
							{#snippet children({ fieldId, describedBy })}
								<Cluster gap="2" align="center" wrap>
									<Input
										id={fieldId}
										name="secret"
										type="password"
										autocomplete="new-password"
										bind:value={draft.secret}
										aria-describedby={describedBy}
										oninput={() => touched(c.vendor)}
										class="secret-input"
									/>
									<Badge variant={keyStatusVariant(c.keyStatus)}>{data.labels.keyStatuses[c.keyStatus]}</Badge>
								</Cluster>
							{/snippet}
						</FormField>

						{#if c.vendor === 'euipo'}
							<FormField id="api-base-{c.vendor}" label={copy.api_base_label} description={copy.hosts_hint}>
								{#snippet children({ fieldId, describedBy })}
									<Input
										id={fieldId}
										name="apiBase"
										type="url"
										bind:value={draft.apiBase}
										placeholder={data.euipoDefaults.apiBase}
										aria-describedby={describedBy}
										oninput={() => touched(c.vendor)}
									/>
								{/snippet}
							</FormField>
							<FormField id="token-url-{c.vendor}" label={copy.token_url_label}>
								{#snippet children({ fieldId, describedBy })}
									<Input
										id={fieldId}
										name="tokenUrl"
										type="url"
										bind:value={draft.tokenUrl}
										placeholder={data.euipoDefaults.tokenUrl}
										aria-describedby={describedBy}
										oninput={() => touched(c.vendor)}
									/>
								{/snippet}
							</FormField>
						{/if}

						{#if error}
							<p class="card-error" role="alert">{error}</p>
						{/if}

						{#if test}
							<p class="test-result test-result--{test.outcome === 'ok' ? 'ok' : 'fail'}" aria-live="polite">
								<strong>{data.labels.testOutcomes[test.outcome]}</strong>
								<span class="muted">
									{formatRelative(new Date(test.testedAt), page.data.locale)} · {test.latencyMs} ms · {testTarget(test)}{#if test.detail}
										· {test.detail}{/if}
								</span>
							</p>
						{/if}

						<Cluster gap="2" wrap align="center">
							<Button type="submit" disabled={submitting?.vendor === c.vendor || !data.encryptionConfigured || data.unavailable}>
								{#if isBusy(c.vendor, 'save')}<Spinner size="xs" class="mr-1" />{copy.saving}{:else}{copy.save}{/if}
							</Button>
							<Button
								type="submit"
								formaction="?/test"
								variant="outline"
								disabled={submitting?.vendor === c.vendor || data.unavailable || (!c.hasSecret && !draft.secret)}
							>
								{#if isBusy(c.vendor, 'test')}<Spinner size="xs" class="mr-1" />{copy.testing}{:else}{copy.test}{/if}
							</Button>
							{#if c.hasSecret}
								<Button
									type="button"
									variant="ghost"
									disabled={submitting?.vendor === c.vendor}
									onclick={() => {
										confirmRemove = c.vendor;
									}}
								>
									{copy.remove_secret}
								</Button>
							{/if}
						</Cluster>

						<p class="note">{copy.test_note}</p>
						{#if c.updatedAt}
							<p class="note">{copy.saved_at} · {formatRelative(new Date(c.updatedAt), page.data.locale)}</p>
						{/if}
					</Stack>
				</form>

				<form
					method="POST"
					action="?/removeSecret"
					use:enhance={enhanceRemove(c.vendor)}
					bind:this={removeForms[c.vendor]}
					hidden
				>
					<input type="hidden" name="vendor" value={c.vendor} />
					<input type="hidden" name="version" value={c.version} />
				</form>
			</Card>
		{/each}
	</div>

	{#if !data.unavailable}
		<p class="note">{copy.web_order_note}</p>
	{/if}
</Stack>

<ConfirmDialog
	open={confirmRemove !== null}
	title={copy.remove_secret_confirm_title}
	description={confirmRemove ? data.labels.removeConfirm[confirmRemove] : ''}
	confirmLabel={copy.remove_secret}
	destructive
	onconfirm={() => {
		const vendor = confirmRemove;
		confirmRemove = null;
		if (vendor) removeForms[vendor]?.requestSubmit();
	}}
	oncancel={() => {
		confirmRemove = null;
	}}
/>

<style>
	.intro {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.connection-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: var(--spacing-4);
	}

	.field-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
	}

	.health-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		flex-shrink: 0;
	}

	.health-dot--success {
		background: var(--color-success);
	}

	.health-dot--secondary {
		background: var(--color-muted);
	}

	.card-error {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-error);
	}

	.test-result {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		border: 1px solid var(--color-border);
	}

	.test-result--ok {
		border-color: color-mix(in srgb, var(--color-success) 40%, transparent);
		background: color-mix(in srgb, var(--color-success) 8%, transparent);
	}

	.test-result--fail {
		border-color: color-mix(in srgb, var(--color-error) 40%, transparent);
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
	}

	.muted {
		color: var(--color-muted);
	}

	.note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	:global(.secret-input) {
		flex: 1 1 16rem;
	}
</style>
