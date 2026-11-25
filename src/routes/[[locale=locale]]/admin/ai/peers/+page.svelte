<script lang="ts">
import { Alert, Card, FormField } from '#lib/components/composites/index.ts';
import { Cluster, Stack } from '#lib/components/layout/index.ts';
import { Badge, Button, Input, Select, Textarea } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { getToast } from '#lib/state/toast.svelte.ts';
import type { SubmitFunction } from '$app/forms';
import { enhance } from '$app/forms';

let { data } = $props();

const toast = getToast();

/** Every form answers `{ message }`; failures say why, successes say what changed. */
const enhanced: SubmitFunction = () => {
	return async ({ result, update }) => {
		const message = (result as { data?: { message?: string } }).data?.message;
		if (result.type === 'failure' && message) toast.error(message);
		else if (result.type === 'success' && message) toast.success(message);
		return update({ reset: false });
	};
};

const audienceOptions = [
	{ value: 'admin', label: m.admin_ai_peers_audience_admin() },
	{ value: 'user', label: m.admin_ai_peers_audience_user() },
];
const reversibilityOptions = [
	{ value: 'unknown', label: m.ai_external_reversibility_unknown() },
	{ value: 'reversible', label: m.ai_external_reversibility_reversible() },
	{ value: 'compensatable', label: m.ai_external_reversibility_compensatable() },
	{ value: 'irreversible', label: m.ai_external_reversibility_irreversible() },
];
const mutatesOptions = [
	{ value: 'true', label: m.ai_external_mutates() },
	{ value: 'false', label: m.ai_external_read_only() },
];

let newAudience = $state('admin');
const audienceDrafts = $state<Record<string, string>>({});
const toolDrafts = $state<Record<string, { mutates: string; reversibility: string }>>({});

type PeerTool = (typeof data.peers)[number]['tools'][number];

/** The operator's unsaved choice for one tool, else what is stored. Written only from change handlers. */
function toolDraft(peerId: string, tool: PeerTool) {
	return (
		toolDrafts[`${peerId}/${tool.remoteName}`] ?? { mutates: String(tool.mutates), reversibility: tool.reversibility }
	);
}

function setToolDraft(peerId: string, tool: PeerTool, change: Partial<{ mutates: string; reversibility: string }>) {
	toolDrafts[`${peerId}/${tool.remoteName}`] = { ...toolDraft(peerId, tool), ...change };
}

const short = (fingerprint: string | null) => (fingerprint ? fingerprint.slice(0, 12) : '—');
const destinationsText = (list: Array<{ cidr: string; port: number }>) =>
	list.map((d) => `${d.cidr}:${d.port}`).join('\n');
</script>

<Stack gap="6">
	<p class="intro">{m.admin_ai_peers_intro()}</p>
	{#if data.unavailable}
		<Alert variant="error" description={m.admin_ai_peers_unavailable()} />
	{/if}

	{#each data.peers as peer (peer.id)}
		{@const audience = audienceDrafts[peer.id] ?? peer.audience}
		<Card>
			{#snippet header()}
				<Cluster gap="2" align="center" justify="between" wrap>
					<h2 class="text-fluid-lg font-semibold">{peer.label} <span class="mono">mcp_{peer.id}_*</span></h2>
					<Cluster gap="1" wrap>
						{#if peer.revoked}
							<Badge variant="error">{m.admin_ai_peers_revoked()}</Badge>
						{:else if peer.lastTestOutcome === 'ok'}
							<Badge variant="success">{m.admin_ai_peers_reachable()}</Badge>
						{:else if peer.lastTestOutcome}
							<Badge variant="warning">{peer.lastTestOutcome}</Badge>
						{/if}
					</Cluster>
				</Cluster>
			{/snippet}

			<Stack gap="4">
				<form method="POST" action="?/save" use:enhance={enhanced} autocomplete="off">
					<input type="hidden" name="id" value={peer.id} />
					<input type="hidden" name="audience" value={audience} />
					<Stack gap="3">
						<FormField id="label-{peer.id}" label={m.admin_ai_peers_label()}>
							{#snippet children({ fieldId })}
								<Input id={fieldId} name="label" value={peer.label} required />
							{/snippet}
						</FormField>
						<FormField id="url-{peer.id}" label={m.admin_ai_peers_url()} description={m.admin_ai_peers_url_hint()}>
							{#snippet children({ fieldId, describedBy })}
								<Input id={fieldId} name="url" value={peer.url} aria-describedby={describedBy} required />
							{/snippet}
						</FormField>
						<FormField
							id="secret-{peer.id}"
							label={m.admin_ai_peers_secret_ref()}
							description={m.admin_ai_peers_secret_ref_hint()}
						>
							{#snippet children({ fieldId, describedBy })}
								<Input id={fieldId} name="secretRef" value={peer.secretRef ?? ''} aria-describedby={describedBy} />
							{/snippet}
						</FormField>
						<FormField id="audience-{peer.id}" label={m.admin_ai_peers_audience()}>
							{#snippet children()}
								<Select
									options={audienceOptions}
									value={audience}
									onchange={(value) => {
										audienceDrafts[peer.id] = value;
									}}
									aria-label={m.admin_ai_peers_audience()}
								/>
							{/snippet}
						</FormField>
						<FormField id="bytes-{peer.id}" label={m.admin_ai_peers_max_bytes()}>
							{#snippet children({ fieldId })}
								<Input id={fieldId} name="maxArgumentBytes" type="number" value={peer.maxArgumentBytes === null ? '' : String(peer.maxArgumentBytes)} />
							{/snippet}
						</FormField>
						<FormField
							id="dest-{peer.id}"
							label={m.admin_ai_peers_private_destinations()}
							description={m.admin_ai_peers_private_destinations_hint()}
						>
							{#snippet children({ fieldId, describedBy })}
								<Textarea
									id={fieldId}
									name="privateDestinations"
									value={destinationsText(peer.privateDestinations)}
									aria-describedby={describedBy}
									rows={2}
								/>
							{/snippet}
						</FormField>
						<Cluster gap="2" wrap>
							<Button type="submit">{m.admin_ai_peers_save()}</Button>
							<Button type="submit" variant="outline" formaction="?/test">{m.admin_ai_peers_test()}</Button>
							<Button type="submit" variant="outline" formaction="?/discover">{m.admin_ai_peers_discover()}</Button>
						</Cluster>
					</Stack>
				</form>

				<form method="POST" action="?/revoke" use:enhance={enhanced}>
					<input type="hidden" name="id" value={peer.id} />
					<input type="hidden" name="revoked" value={String(!peer.revoked)} />
					<Button type="submit" variant={peer.revoked ? 'outline' : 'destructive'} size="sm">
						{peer.revoked ? m.admin_ai_peers_restore() : m.admin_ai_peers_revoke()}
					</Button>
				</form>

				<h3 class="font-semibold">{m.admin_ai_peers_tools()}</h3>
				{#if peer.tools.length === 0}
					<p class="muted">{m.admin_ai_peers_no_tools()}</p>
				{/if}
				{#each peer.tools as tool (tool.remoteName)}
					{@const draft = toolDraft(peer.id, tool)}
					<div class="tool">
						<Cluster gap="2" align="center" wrap>
							<span class="mono">{tool.remoteName}</span>
							{#if tool.drift}
								<Badge variant="error">{m.admin_ai_peers_tool_drift()}</Badge>
							{:else if tool.activatedFingerprint}
								<Badge variant="success">{m.admin_ai_peers_tool_active()}</Badge>
							{:else}
								<Badge variant="secondary">{m.admin_ai_peers_tool_inactive()}</Badge>
							{/if}
							{#if tool.hints.readOnlyHint}<Badge variant="secondary">{m.admin_ai_peers_hint_read_only()}</Badge>{/if}
							{#if tool.hints.destructiveHint}<Badge variant="warning">{m.admin_ai_peers_hint_destructive()}</Badge>{/if}
						</Cluster>
						<p class="muted">{m.admin_ai_peers_untrusted_description()}</p>
						<pre class="mono description">{tool.description}</pre>
						<p class="mono muted">
							{m.admin_ai_peers_fingerprints({
								discovered: short(tool.discoveredFingerprint),
								activated: short(tool.activatedFingerprint),
							})}
						</p>
						<details>
							<summary>{m.admin_ai_peers_input_schema()}</summary>
							<pre class="mono description">{tool.inputSchema}</pre>
						</details>
						<form method="POST" action="?/activate" use:enhance={enhanced}>
							<input type="hidden" name="peerId" value={peer.id} />
							<input type="hidden" name="remoteName" value={tool.remoteName} />
							<input type="hidden" name="fingerprint" value={tool.discoveredFingerprint} />
							<input type="hidden" name="mutates" value={draft.mutates} />
							<input type="hidden" name="reversibility" value={draft.reversibility} />
							<Cluster gap="2" align="end" wrap>
								<Select
									options={mutatesOptions}
									value={draft.mutates}
									onchange={(value) => setToolDraft(peer.id, tool, { mutates: value })}
									aria-label={m.ai_external_effect_label()}
								/>
								<Select
									options={reversibilityOptions}
									value={draft.reversibility}
									onchange={(value) => setToolDraft(peer.id, tool, { reversibility: value })}
									aria-label={m.admin_ai_peers_reversibility()}
								/>
								<Input
									name="argumentFields"
									value={tool.argumentFields?.join(', ') ?? ''}
									placeholder={m.admin_ai_peers_argument_fields()}
									aria-label={m.admin_ai_peers_argument_fields()}
								/>
								<Button type="submit" size="sm">{m.admin_ai_peers_activate()}</Button>
								{#if tool.activatedFingerprint}
									<Button type="submit" size="sm" variant="ghost" formaction="?/deactivate">
										{m.admin_ai_peers_deactivate()}
									</Button>
								{/if}
							</Cluster>
						</form>
					</div>
				{/each}
			</Stack>
		</Card>
	{/each}

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.admin_ai_peers_add()}</h2>
		{/snippet}
		<form method="POST" action="?/save" use:enhance={enhanced} autocomplete="off">
			<input type="hidden" name="audience" value={newAudience} />
			<Stack gap="3">
				<FormField id="new-id" label={m.admin_ai_peers_id()} description={m.admin_ai_peers_id_hint()}>
					{#snippet children({ fieldId, describedBy })}
						<Input id={fieldId} name="id" aria-describedby={describedBy} required />
					{/snippet}
				</FormField>
				<FormField id="new-label" label={m.admin_ai_peers_label()}>
					{#snippet children({ fieldId })}
						<Input id={fieldId} name="label" required />
					{/snippet}
				</FormField>
				<FormField id="new-url" label={m.admin_ai_peers_url()} description={m.admin_ai_peers_url_hint()}>
					{#snippet children({ fieldId, describedBy })}
						<Input id={fieldId} name="url" aria-describedby={describedBy} required />
					{/snippet}
				</FormField>
				<FormField id="new-secret" label={m.admin_ai_peers_secret_ref()} description={m.admin_ai_peers_secret_ref_hint()}>
					{#snippet children({ fieldId, describedBy })}
						<Input id={fieldId} name="secretRef" aria-describedby={describedBy} />
					{/snippet}
				</FormField>
				<FormField id="new-audience" label={m.admin_ai_peers_audience()}>
					{#snippet children()}
						<Select options={audienceOptions} bind:value={newAudience} aria-label={m.admin_ai_peers_audience()} />
					{/snippet}
				</FormField>
				<Cluster gap="2">
					<Button type="submit">{m.admin_ai_peers_save()}</Button>
				</Cluster>
			</Stack>
		</form>
	</Card>
</Stack>

<style>
	.intro,
	.muted {
		color: var(--color-muted);
	}
	.mono {
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
	}
	.tool {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}
	.description {
		margin: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		max-height: 10rem;
		overflow: auto;
	}
</style>
