<script lang="ts">
import type { SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { page } from '$app/state';
import QuotaPanel from '$lib/components/admin/ai/QuotaPanel.svelte';
import { Alert, Card, ConfirmDialog, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Select, Spinner, Switch } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { AUTOMATIC_DEFAULT } from '$lib/schemas/admin/ai-connections';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();

const toast = getToast();

type Connection = (typeof data.connections)[number];
type ProviderId = Connection['provider'];
type Draft = { enabled: boolean; modelId: string; apiKey: string };
type TestOutcome = 'ok' | 'invalid_key' | 'model_not_found' | 'rate_limited' | 'timeout' | 'network' | 'unknown';
type TestView = {
	outcome: TestOutcome;
	latencyMs: number;
	testedAt: string;
	target: 'draft' | 'saved';
	version: number;
};

// ── Drafts ─────────────────────────────────────────────────────────────────────
// One draft per card, seeded from the saved connection and re-seeded whenever a save lands
// (a new `version` arrives) so the password field never keeps a key past its submit.

function draftOf(c: Connection): Draft {
	return { enabled: c.enabled, modelId: c.modelId, apiKey: '' };
}

let drafts = $state<Record<string, Draft>>(Object.fromEntries(data.connections.map((c) => [c.provider, draftOf(c)])));
let seededVersions = $state<Record<string, number>>(
	Object.fromEntries(data.connections.map((c) => [c.provider, c.version])),
);
let testResults = $state<Record<string, TestView | null>>({});
let cardErrors = $state<Record<string, string | null>>({});
let submitting = $state<{ provider: string; kind: 'save' | 'test' | 'remove' } | null>(null);
let confirmRemove = $state<ProviderId | null>(null);
let removeForms = $state<Record<string, HTMLFormElement | undefined>>({});

$effect(() => {
	for (const c of data.connections) {
		if (seededVersions[c.provider] !== c.version) {
			drafts[c.provider] = draftOf(c);
			seededVersions[c.provider] = c.version;
			testResults[c.provider] = null;
		}
	}
});

/** Any edit invalidates a shown test result — it belonged to the fields as they were. */
function touched(provider: string) {
	testResults[provider] = null;
	cardErrors[provider] = null;
}

// ── Project default ────────────────────────────────────────────────────────────
// The selector names the default the DATABASE holds (`isDefault`), not the one resolution
// would use: a default whose key stopped decrypting is still the row the swap must clear.

const storedDefault = $derived(data.connections.find((c) => c.isDefault)?.provider ?? AUTOMATIC_DEFAULT);
let defaultChoice = $state<string>(AUTOMATIC_DEFAULT);
$effect(() => {
	defaultChoice = storedDefault;
});
const defaultOptions = $derived([
	{ value: AUTOMATIC_DEFAULT, label: m.admin_ai_models_default_automatic() },
	...data.connections.map((c) => ({ value: c.provider, label: c.name, disabled: !c.configured })),
]);
let defaultSubmitting = $state(false);
let defaultError = $state<string | null>(null);

// ── Cooldown ticker ────────────────────────────────────────────────────────────

let now = $state(Date.now());
$effect(() => {
	const anyCooling = Object.values(data.cooldowns).some(Boolean);
	if (!anyCooling) return;
	const id = setInterval(() => {
		now = Date.now();
	}, 1000);
	return () => clearInterval(id);
});

function secondsLeft(cooldownUntil: string | null | undefined): number {
	if (!cooldownUntil) return 0;
	return Math.max(0, Math.ceil((new Date(cooldownUntil).getTime() - now) / 1000));
}

// ── Presentation helpers ───────────────────────────────────────────────────────

function rolesFor(c: Connection): { label: string; variant: 'success' | 'secondary' | 'default' }[] {
	const roles: { label: string; variant: 'success' | 'secondary' | 'default' }[] = [];
	if (c.isDefault) roles.push({ label: m.admin_ai_models_role_default(), variant: 'default' });
	if (c.provider === data.activeProviderId) roles.push({ label: m.admin_ai_models_role_active(), variant: 'success' });
	if (c.provider === data.toolProviderId) roles.push({ label: m.admin_ai_models_role_tool(), variant: 'success' });
	if (c.provider === data.visionProviderId) roles.push({ label: m.admin_ai_models_role_vision(), variant: 'success' });
	if (data.fallbackIds.includes(c.provider))
		roles.push({ label: m.admin_ai_models_role_fallback(), variant: 'secondary' });
	return roles;
}

const TEST_RESULT_LABELS: Record<TestOutcome, () => string> = {
	ok: m.admin_ai_models_test_result_ok,
	invalid_key: m.admin_ai_models_test_result_invalid_key,
	model_not_found: m.admin_ai_models_test_result_model_not_found,
	rate_limited: m.admin_ai_models_test_result_rate_limited,
	timeout: m.admin_ai_models_test_result_timeout,
	network: m.admin_ai_models_test_result_network,
	unknown: m.admin_ai_models_test_result_unknown,
};

const EMBEDDING_STATUS_LABELS = {
	ready: m.admin_ai_models_embedding_status_ready,
	disabled: m.admin_ai_models_embedding_status_disabled,
	no_key: m.admin_ai_models_embedding_status_no_key,
	undecryptable: m.admin_ai_models_embedding_status_undecryptable,
} as const;

function testTarget(test: TestView): string {
	return test.target === 'draft'
		? m.admin_ai_models_test_target_draft()
		: m.admin_ai_models_test_target_saved({ version: String(test.version) });
}

const noneConnected = $derived(!data.unavailable && data.connections.every((c) => !c.configured));

// ── Form wiring ────────────────────────────────────────────────────────────────
// One `<form>` per card serves both Save and Test: the Test button carries a `formaction`,
// and the enhance callback tells the two apart by the action it was submitted to. A test
// never reloads the page data (the draft must survive it); a save does.

function enhanceCard(provider: ProviderId) {
	return (({ action }: { action: URL }) => {
		const kind = action.search.includes('/test') ? 'test' : 'save';
		submitting = { provider, kind };
		cardErrors[provider] = null;
		return async ({
			result,
			update,
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
		}) => {
			submitting = null;
			if (result.type === 'failure') {
				const message = (result.data?.message as string | undefined) || m.admin_action_failed_generic();
				cardErrors[provider] = message;
				toast.error(message);
				return update({ reset: false, invalidateAll: false });
			}
			if (kind === 'test') {
				if (result.type === 'success' && result.data?.test) testResults[provider] = result.data.test as TestView;
				return update({ reset: false, invalidateAll: false });
			}
			if (result.type === 'success' && result.data?.message) toast.success(result.data.message as string);
			return update();
		};
	}) as unknown as SubmitFunction;
}

function enhanceRemove(provider: ProviderId) {
	return (() => {
		submitting = { provider, kind: 'remove' };
		return async ({
			result,
			update,
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: () => Promise<void>;
		}) => {
			submitting = null;
			if (result.type === 'failure') {
				const message = (result.data?.message as string | undefined) || m.admin_action_failed_generic();
				cardErrors[provider] = message;
				toast.error(message);
			} else if (result.type === 'success' && result.data?.message) {
				toast.success(result.data.message as string);
			}
			return update();
		};
	}) as unknown as SubmitFunction;
}

const enhanceDefault: SubmitFunction = () => {
	defaultSubmitting = true;
	defaultError = null;
	return async ({ result, update }) => {
		defaultSubmitting = false;
		if (result.type === 'failure') {
			defaultError = (result.data as { message?: string } | undefined)?.message || m.admin_action_failed_generic();
			toast.error(defaultError);
		} else if (result.type === 'success' && (result.data as { message?: string } | undefined)?.message) {
			toast.success((result.data as { message: string }).message);
		}
		return update();
	};
};

function isBusy(provider: string, kind: 'save' | 'test' | 'remove'): boolean {
	return submitting?.provider === provider && submitting.kind === kind;
}
</script>

<Stack gap="6">
	<p class="intro">{m.admin_ai_models_intro()}</p>

	{#if data.unavailable}
		<Alert variant="error" title={m.admin_ai_models_unavailable_title()} description={m.admin_ai_models_unavailable_body()} />
	{/if}
	{#if data.degraded}
		<Alert variant="warning" title={m.admin_ai_models_degraded_title()} description={m.admin_ai_models_degraded_body()} />
	{/if}
	{#if !data.encryptionConfigured}
		<Alert variant="error" description={m.admin_ai_models_encryption_missing()} />
	{/if}
	{#if noneConnected}
		<Alert variant="info" description={m.admin_ai_models_none_connected()} />
	{/if}

	<!-- Provider connections -->
	<div class="connection-grid">
		{#each data.connections as c (c.provider)}
			{@const draft = drafts[c.provider] ?? draftOf(c)}
			{@const secs = secondsLeft(data.cooldowns[c.provider])}
			{@const test = testResults[c.provider] ?? null}
			{@const error = cardErrors[c.provider] ?? null}
			<Card>
				{#snippet header()}
					<Cluster gap="2" align="center" justify="between" wrap>
						<Cluster gap="2" align="center">
							<span class="health-dot health-dot--{c.configured ? 'success' : 'secondary'}"></span>
							<h2 class="text-fluid-lg font-semibold">{c.name}</h2>
						</Cluster>
						<Cluster gap="1" wrap>
							{#each rolesFor(c) as role}
								<Badge variant={role.variant}>{role.label}</Badge>
							{/each}
							{#if secs > 0}
								<Badge variant="warning">Cooling · {secs}s</Badge>
							{/if}
						</Cluster>
					</Cluster>
				{/snippet}

				<form method="POST" action="?/save" use:enhance={enhanceCard(c.provider)} autocomplete="off">
					<input type="hidden" name="provider" value={c.provider} />
					<input type="hidden" name="version" value={c.version} />
					<input type="hidden" name="enabled" value={String(draft.enabled)} />

					<Stack gap="4">
						<Cluster gap="2" align="center">
							<Switch
								id="enabled-{c.provider}"
								checked={draft.enabled}
								onCheckedChange={(checked) => {
									draft.enabled = checked;
									touched(c.provider);
								}}
							/>
							<label for="enabled-{c.provider}" class="field-label">{m.admin_ai_models_provider_enabled()}</label>
						</Cluster>

						<FormField
							id="model-{c.provider}"
							label={m.admin_ai_models_model_id_label()}
							description={m.admin_ai_models_model_id_hint({ suggested: c.suggestedModelId })}
						>
							{#snippet children({ fieldId, describedBy })}
								<Input
									id={fieldId}
									name="modelId"
									bind:value={draft.modelId}
									placeholder={c.suggestedModelId}
									aria-describedby={describedBy}
									oninput={() => touched(c.provider)}
									required
								/>
							{/snippet}
						</FormField>

						<Cluster gap="2" wrap>
							{#if c.capabilities.recognized}
								<Badge variant={c.capabilities.tools ? 'success' : 'secondary'}>
									{m.admin_ai_models_capability_tools()} {c.capabilities.tools ? '✓' : '—'}
								</Badge>
								<Badge variant={c.capabilities.vision ? 'success' : 'secondary'}>
									{m.admin_ai_models_capability_vision()} {c.capabilities.vision ? '✓' : '—'}
								</Badge>
							{:else}
								<span class="capability-warning">
									<span class="i-lucide-alert-triangle h-4 w-4"></span>
									{m.admin_ai_models_capability_unrecognized()}
								</span>
							{/if}
						</Cluster>

						<FormField
							id="key-{c.provider}"
							label={m.admin_ai_models_api_key_label()}
							description={c.hasKey ? m.admin_ai_models_api_key_hint_keep() : undefined}
						>
							{#snippet children({ fieldId, describedBy })}
								<Cluster gap="2" align="center" wrap>
									<Input
										id={fieldId}
										name="apiKey"
										type="password"
										autocomplete="new-password"
										bind:value={draft.apiKey}
										aria-describedby={describedBy}
										oninput={() => touched(c.provider)}
										class="key-input"
									/>
									{#if c.keyStatus === 'ready'}
										<Badge variant="success">{m.admin_ai_models_key_stored()}</Badge>
									{:else if c.keyStatus === 'undecryptable'}
										<Badge variant="error">{m.admin_ai_models_key_undecryptable()}</Badge>
									{:else}
										<Badge variant="secondary">{m.admin_ai_models_key_missing()}</Badge>
									{/if}
								</Cluster>
							{/snippet}
						</FormField>

						{#if error}
							<p class="card-error" role="alert">{error}</p>
						{/if}

						{#if test}
							<p class="test-result test-result--{test.outcome === 'ok' ? 'ok' : 'fail'}" aria-live="polite">
								<strong>{TEST_RESULT_LABELS[test.outcome]()}</strong>
								<span class="muted">
									{m.admin_ai_models_test_tested_at({
										when: formatRelative(new Date(test.testedAt), page.data.locale),
										latency: String(test.latencyMs),
										target: testTarget(test),
									})}
								</span>
							</p>
						{/if}

						<Cluster gap="2" wrap align="center">
							<Button type="submit" disabled={submitting?.provider === c.provider || !data.encryptionConfigured}>
								{#if isBusy(c.provider, 'save')}<Spinner size="xs" class="mr-1" />{m.admin_ai_models_saving()}{:else}{m.admin_ai_models_save()}{/if}
							</Button>
							<Button
								type="submit"
								formaction="?/test"
								variant="outline"
								disabled={submitting?.provider === c.provider || (!c.hasKey && !draft.apiKey)}
							>
								{#if isBusy(c.provider, 'test')}<Spinner size="xs" class="mr-1" />{m.admin_ai_models_testing()}{:else}{m.admin_ai_models_test()}{/if}
							</Button>
							{#if c.hasKey}
								<Button
									type="button"
									variant="ghost"
									disabled={submitting?.provider === c.provider}
									onclick={() => {
										confirmRemove = c.provider;
									}}
								>
									{m.admin_ai_models_remove_key()}
								</Button>
							{/if}
						</Cluster>

						<p class="note">{m.admin_ai_models_test_note_quota()}</p>
						{#if c.updatedAt}
							<p class="note">{m.admin_ai_models_updated_by({ when: formatRelative(new Date(c.updatedAt), page.data.locale) })}</p>
						{/if}
					</Stack>
				</form>

				<form
					method="POST"
					action="?/removeKey"
					use:enhance={enhanceRemove(c.provider)}
					bind:this={removeForms[c.provider]}
					hidden
				>
					<input type="hidden" name="provider" value={c.provider} />
					<input type="hidden" name="version" value={c.version} />
				</form>
			</Card>
		{/each}
	</div>

	<!-- Project default -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_ai_models_default_title()}</h2>
		{/snippet}
		<form method="POST" action="?/setDefault" use:enhance={enhanceDefault}>
			<input type="hidden" name="provider" value={defaultChoice} />
			<input type="hidden" name="expectedCurrentDefault" value={storedDefault} />
			<Stack gap="3">
				<p class="muted">{m.admin_ai_models_default_intro()}</p>
				<Cluster gap="2" align="center" wrap>
					<div class="default-select">
						<Select options={defaultOptions} bind:value={defaultChoice} disabled={data.unavailable} />
					</div>
					<Button type="submit" disabled={defaultSubmitting || data.unavailable || defaultChoice === storedDefault}>
						{#if defaultSubmitting}<Spinner size="xs" class="mr-1" />{/if}{m.admin_ai_models_save()}
					</Button>
				</Cluster>
				{#if defaultError}
					<p class="card-error" role="alert">{defaultError}</p>
				{/if}
			</Stack>
		</form>
	</Card>

	<!-- Embeddings (read-only) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_ai_models_embedding_title()}</h2>
		{/snippet}
		<Stack gap="3">
			<dl class="embedding-facts">
				<dt>{m.admin_ai_models_embedding_model()}</dt>
				<dd><code class="mono">{data.embedding.modelId}</code></dd>
				<dt>{m.admin_ai_models_embedding_dimensions()}</dt>
				<dd>{data.embedding.dimensions}</dd>
			</dl>
			<Badge variant={data.embedding.status === 'ready' ? 'success' : 'warning'}>
				{EMBEDDING_STATUS_LABELS[data.embedding.status]()}
			</Badge>
			<p class="note">{m.admin_ai_models_embedding_dependency_note()}</p>
		</Stack>
	</Card>

	<!-- Resources & limits -->
	<QuotaPanel resources={data.resources} />

	<!-- Resolvers -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Routing</h2>
		{/snippet}

		<p class="muted resolver-intro">
			Three resolvers pick the provider per turn. Chat-only, tool-calling and image turns use different
			capability orders, so the active chat provider, the tool provider and the vision provider can differ.
			Every resolver starts from the same two steps.
		</p>

		<div class="resolver-grid">
			<div class="resolver-col">
				<h3 class="resolver-title">Chat turns <span class="resolver-fn">resolveActiveProvider</span></h3>
				<ol class="resolver-order">
					<li>User preference</li>
					<li>{m.admin_ai_models_routing_default_step()}</li>
					<li>First connected</li>
				</ol>
				<div class="resolved">
					Resolved:
					{#if data.activeProviderId}<Badge variant="success">{data.activeProviderId}</Badge>{:else}<Badge variant="error">none</Badge>{/if}
				</div>
			</div>

			<div class="resolver-col">
				<h3 class="resolver-title">Tool turns <span class="resolver-fn">resolveToolProvider</span></h3>
				<ol class="resolver-order">
					<li>User preference</li>
					<li>{m.admin_ai_models_routing_default_step()}</li>
					<li>OpenAI → Google → others (tool-capable model)</li>
				</ol>
				<div class="resolved">
					Resolved:
					{#if data.toolProviderId}<Badge variant="success">{data.toolProviderId}</Badge>{:else}<Badge variant="error">none</Badge>{/if}
				</div>
			</div>

			<div class="resolver-col">
				<h3 class="resolver-title">Image turns <span class="resolver-fn">resolveVisionProvider</span></h3>
				<ol class="resolver-order">
					<li>User preference</li>
					<li>{m.admin_ai_models_routing_default_step()}</li>
					<li>Google → OpenAI (vision-capable model)</li>
				</ol>
				<div class="resolved">
					Resolved:
					{#if data.visionProviderId}<Badge variant="success">{data.visionProviderId}</Badge>{:else}<Badge variant="error">none</Badge>{/if}
				</div>
			</div>
		</div>

		<p class="note">
			Cooldown is the circuit-breaker state (60s), shared across instances via Redis — a 429 on one
			serverless instance cools the provider for all. Falls back to per-instance memory only when Redis
			is unavailable (dev).
		</p>
	</Card>
</Stack>

<ConfirmDialog
	open={confirmRemove !== null}
	title={m.admin_ai_models_remove_key_confirm_title()}
	description={confirmRemove ? m.admin_ai_models_remove_key_confirm_body({ name: data.connections.find((c) => c.provider === confirmRemove)?.name ?? '' }) : ''}
	confirmLabel={m.admin_ai_models_remove_key()}
	destructive
	onconfirm={() => {
		const provider = confirmRemove;
		confirmRemove = null;
		if (provider) removeForms[provider]?.requestSubmit();
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

	.capability-warning {
		display: inline-flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-warning);
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

	.mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.muted {
		color: var(--color-muted);
	}

	.note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.default-select {
		min-width: 14rem;
	}

	.embedding-facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-1) var(--spacing-4);
		margin: 0;
		font-size: var(--text-fluid-sm);
	}

	.embedding-facts dt {
		color: var(--color-muted);
	}

	.embedding-facts dd {
		margin: 0;
	}

	.resolver-intro {
		margin: 0 0 var(--spacing-4);
		font-size: var(--text-fluid-sm);
	}

	.resolver-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--spacing-4);
	}

	.resolver-col {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.resolver-title {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0;
	}

	.resolver-fn {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		font-weight: 400;
		color: var(--color-muted);
	}

	.resolver-order {
		margin: 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.resolved {
		margin-top: auto;
		padding-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}
</style>
