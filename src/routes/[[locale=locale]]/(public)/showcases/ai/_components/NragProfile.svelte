<script lang="ts">
import * as m from '$lib/paraglide/messages';
import { BUILD_LABELS, LANE_LABELS } from '$lib/showcase/ai/labels';
import { AI_LAYERS } from '$lib/showcase/ai/topology';
import type { AiSurfaceId } from '$lib/types/ai-tools';

// The SHAPE of retrieval for this surface — no knobs, no chunk lists, no waterfall.
// The most instructive fact is spatial: lanes that exist in the kernel and this
// surface never asks for (dormant, hatched — never "skipped").
let { surface }: { surface: AiSurfaceId } = $props();

const retrieval = AI_LAYERS.find((l) => l.id === 'retrieval');
const lanes = (retrieval?.lanes ?? []).filter((lane) => lane.statusBySurface[surface]);

const corpus =
	surface === 'chatbot'
		? { filter: 'document.userId = SYSTEM_DOCS_USER_ID', label: 'docs + catalog (system-owned)' }
		: { filter: 'document.userId = <you>', label: 'your desk files (aiContext opt-in)' };
</script>

<div class="profile">
	<div class="kernel">
		<code class="kernel-entry">rawrag/retrieve()</code>
		<ul class="lanes" aria-label={m.showcase_ai_sec_nrag()}>
			{#each lanes as lane (lane.id)}
				{@const build = lane.statusBySurface[surface] ?? 'live'}
				<li class="lane" data-build={build}>
					<span class="lane-name">{LANE_LABELS[lane.id]?.() ?? lane.id}</span>
					<span class="lane-build">{BUILD_LABELS[build]()}</span>
				</li>
			{/each}
		</ul>
		<!-- The one node both surfaces pass through: the tenancy filter IS the corpus boundary. -->
		<div class="tenancy">
			<span class="i-lucide-filter h-4 w-4" aria-hidden="true"></span>
			<div>
				<code>{corpus.filter}</code>
				<span class="tenancy-label">{corpus.label}</span>
			</div>
		</div>
		<p class="tenancy-note">{m.showcase_ai_nrag_tenancy()}</p>
	</div>

	{#if surface === 'deskbot'}
		<!-- Dotted = async, out-of-band: the ONLY dotted edge on the page, and that
		     difference is the freshness claim. -->
		<div class="sync">
			<span class="sync-edge" aria-hidden="true"></span>
			<p class="sync-note">
				<code>desk.file.updatedAt</code> → <code>desk-rawrag-sync</code>
				<br />
				{m.showcase_ai_nrag_sync()}
			</p>
		</div>
	{/if}
</div>

<style>
	.profile {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.kernel {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.kernel-entry {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		background: var(--color-subtle);
		padding: 0.15em 0.5em;
		border-radius: var(--radius-sm);
	}

	.lanes {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin: var(--spacing-3) 0;
		padding: var(--spacing-2);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.lane {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		min-width: 10rem;
		flex: 1;
	}

	.lane[data-build='dormant'] {
		background: repeating-linear-gradient(
			135deg,
			transparent,
			transparent 5px,
			color-mix(in srgb, var(--color-muted) 12%, transparent) 5px,
			color-mix(in srgb, var(--color-muted) 12%, transparent) 6px
		);
		border-style: dashed;
	}

	.lane-name {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.lane-build {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.tenancy {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
		border-radius: var(--radius-sm);
	}

	.tenancy > span {
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.tenancy code {
		font-size: var(--text-fluid-xs);
		display: block;
	}

	.tenancy-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.tenancy-note {
		margin: var(--spacing-2) 0 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.sync {
		display: flex;
		gap: var(--spacing-2);
		align-items: stretch;
		padding-left: var(--spacing-2);
	}

	.sync-edge {
		border-left: 3px dotted var(--color-muted);
		flex-shrink: 0;
	}

	.sync-note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.sync-note code {
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
	}
</style>
