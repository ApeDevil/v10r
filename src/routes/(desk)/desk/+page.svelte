<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { LayoutNode } from '$lib/components/composites/dock';
import { DockLayout } from '$lib/components/composites/dock';
import { ChatPanel } from '$lib/components/chat';
import { EditorPanel } from '$lib/components/editor';
import { ExplorerPanel } from '$lib/components/explorer';
import { PreviewPanel } from '$lib/components/preview';
import { SpreadsheetPanel } from '$lib/components/spreadsheet';
import {
	DotPattern,
	GradientBlob,
	GridPattern,
	NoiseTexture,
	RadialGlow,
	RetroGrid,
} from '$lib/components/primitives/decorative/background';
import { DESK_ACTIVITY_BAR_ITEMS, DESK_PANEL_TYPES, DESK_PANELS } from '$lib/config/desk-panels';

let openPanel = $derived(page.url.searchParams.get('open'));

// Clean URL param after it's consumed
$effect(() => {
	if (openPanel && page.url.searchParams.has('open')) {
		goto(page.url.pathname, { replaceState: true });
	}
});

const initialRoot: LayoutNode = {
	type: 'split',
	id: 'desk-root',
	direction: 'horizontal',
	sizes: [30, 70],
	children: [
		{
			type: 'split',
			id: 'desk-left',
			direction: 'vertical',
			sizes: [55, 45],
			children: [
				{
					type: 'leaf',
					id: 'desk-left-top',
					tabs: ['explorer', 'inbox'],
					activeTab: 'explorer',
				},
				{
					type: 'leaf',
					id: 'desk-left-bottom',
					tabs: ['chat'],
					activeTab: 'chat',
				},
			],
		},
		{
			type: 'split',
			id: 'desk-right',
			direction: 'vertical',
			sizes: [60, 40],
			children: [
				{
					type: 'leaf',
					id: 'desk-right-top',
					tabs: ['canvas', 'dashboard', 'spreadsheet'],
					activeTab: 'canvas',
				},
				{
					type: 'leaf',
					id: 'desk-right-bottom',
					tabs: ['terminal', 'gallery', 'notes'],
					activeTab: 'terminal',
				},
			],
		},
	],
};

/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "notes-1709312345") */
function getPanelType(panelId: string): string | undefined {
	// Backward compat: legacy panel types map to explorer
	if (panelId === 'documents' || panelId === 'files') return 'explorer';
	if (panelId.startsWith('documents-') || panelId.startsWith('files-')) return 'explorer';
	return DESK_PANEL_TYPES.find((t) => panelId === t || panelId.startsWith(`${t}-`));
}
</script>

<svelte:head>
	<title>Desk - Velociraptor</title>
</svelte:head>

<div class="desk-page">
	<DockLayout
		{initialRoot}
		initialPanels={DESK_PANELS}
		activityBarItems={DESK_ACTIVITY_BAR_ITEMS}
		persist="desk-layout"
		{openPanel}
		class="desk-dock"
	>
		{#snippet panelContent(panelId)}
			{@const type = getPanelType(panelId)}
			<div class="desk-panel">
				{#if type === 'explorer'}
					<ExplorerPanel />
				{:else if type === 'editor'}
					<EditorPanel {panelId} />
				{:else if type === 'preview'}
					<PreviewPanel />
				{:else if type === 'chat'}
					<ChatPanel {panelId} />
				{:else if type === 'notes'}
					<DotPattern opacity={0.08} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-notebook-pen"></span> Notes</div>
				{:else if type === 'canvas'}
					<GridPattern opacity={0.06} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-pen-tool"></span> Canvas</div>
				{:else if type === 'terminal'}
					<div class="term-panel">
						<div class="term-output">
							<div class="term-line"><span class="term-path">~/dev/velociraptor</span></div>
							<div class="term-line"><span class="term-prompt">$</span> bun dev</div>
							<div class="term-line term-blank"></div>
							<div class="term-line"><span class="term-dim">  VITE v6.0.7</span>  ready in <span class="term-green">342 ms</span></div>
							<div class="term-line term-blank"></div>
							<div class="term-line">  <span class="term-green">➜</span>  <span class="term-dim">Local:</span>   <span class="term-cyan">http://localhost:5173/</span></div>
							<div class="term-line">  <span class="term-green">➜</span>  <span class="term-dim">Network:</span> <span class="term-cyan">http://192.168.1.42:5173/</span></div>
							<div class="term-line term-blank"></div>
							<div class="term-line"><span class="term-path">~/dev/velociraptor</span></div>
							<div class="term-line"><span class="term-prompt">$</span> git log --oneline -5</div>
							<div class="term-line"><span class="term-yellow">3d6b1c4</span> panes clean up</div>
							<div class="term-line"><span class="term-yellow">56e468d</span> link card sublink</div>
							<div class="term-line"><span class="term-yellow">9ea260b</span> ref: chips to tags</div>
							<div class="term-line"><span class="term-yellow">6118888</span> backgrounds</div>
							<div class="term-line"><span class="term-yellow">360e84e</span> ref landing page</div>
							<div class="term-line term-blank"></div>
							<div class="term-line"><span class="term-path">~/dev/velociraptor</span></div>
							<div class="term-line"><span class="term-prompt">$</span> bun test</div>
							<div class="term-line"> <span class="term-green">✓</span> <span class="term-dim">lib/utils.test.ts</span> (3 tests) <span class="term-dim">[12ms]</span></div>
							<div class="term-line"> <span class="term-green">✓</span> <span class="term-dim">lib/nav.test.ts</span> (5 tests) <span class="term-dim">[8ms]</span></div>
							<div class="term-line"> <span class="term-green">✓</span> <span class="term-dim">server/auth.test.ts</span> (7 tests) <span class="term-dim">[24ms]</span></div>
							<div class="term-line term-blank"></div>
							<div class="term-line"> Tests  <span class="term-green">15 passed</span> (3 files)</div>
							<div class="term-line"> Time   <span class="term-dim">44ms</span></div>
							<div class="term-line term-blank"></div>
							<div class="term-line"><span class="term-path">~/dev/velociraptor</span></div>
							<div class="term-line"><span class="term-prompt">$</span> <span class="term-cursor"></span></div>
						</div>
					</div>
				{:else if type === 'gallery'}
					<GradientBlob opacity={0.08} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-image"></span> Gallery</div>
				{:else if type === 'inbox'}
					<NoiseTexture opacity={0.06} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-inbox"></span> Inbox</div>
				{:else if type === 'dashboard'}
					<RadialGlow opacity={0.10} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-bar-chart-3"></span> Dashboard</div>
				{:else if type === 'spreadsheet'}
					<SpreadsheetPanel {panelId} />
				{:else}
					<div class="desk-chip"><span class="i-lucide-layout-grid"></span> {panelId}</div>
				{/if}
			</div>
		{/snippet}
	</DockLayout>
</div>

<style>
	.desk-page {
		flex: 1;
		min-height: 0;
	}

	:global(.desk-dock) {
		flex: 1;
		min-height: 0;
	}

	.desk-panel {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.desk-chip {
		position: absolute;
		top: 8px;
		left: 8px;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		font-size: 12px;
		font-weight: 500;
		color: var(--color-muted);
		background: color-mix(in srgb, var(--surface-1) 60%, transparent);
		backdrop-filter: blur(4px);
		border-radius: var(--radius-md);
		pointer-events: none;
		z-index: 1;
	}

	.desk-chip span {
		font-size: 14px;
	}

	/* Terminal panel */
	.term-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: #1a1b26;
		color: #c0caf5;
		font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
		font-size: 13px;
		line-height: 1.6;
	}

	.term-output {
		flex: 1;
		overflow-y: auto;
		padding: 12px 14px;
	}

	.term-line {
		white-space: pre;
	}

	.term-blank {
		height: 0.8em;
	}

	.term-prompt {
		color: #9ece6a;
		font-weight: 700;
	}

	.term-path {
		color: #565f89;
		font-size: 11px;
	}

	.term-green { color: #9ece6a; }
	.term-cyan { color: #7dcfff; }
	.term-yellow { color: #e0af68; }
	.term-dim { color: #565f89; }

	.term-cursor {
		display: inline-block;
		width: 8px;
		height: 1.15em;
		vertical-align: text-bottom;
		background: #c0caf5;
		animation: term-blink 1s step-end infinite;
	}

	@keyframes term-blink {
		50% { opacity: 0; }
	}



</style>
