<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import type { LayoutNode } from '$lib/components/composites/dock';
import { DockLayout } from '$lib/components/composites/dock';
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
					tabs: ['notes', 'inbox'],
					activeTab: 'notes',
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
					tabs: ['terminal', 'gallery', 'files'],
					activeTab: 'terminal',
				},
			],
		},
	],
};

/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "notes-1709312345") */
function getPanelType(panelId: string): string | undefined {
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
				{#if type === 'chat'}
					<div class="chat-panel">
						<div class="chat-messages">
							<div class="chat-msg assistant">
								<span class="chat-avatar">AI</span>
								<div class="chat-bubble">Hey! I'm your AI assistant. How can I help you today?</div>
							</div>
							<div class="chat-msg user">
								<div class="chat-bubble">Can you explain how the dock layout works?</div>
							</div>
							<div class="chat-msg assistant">
								<span class="chat-avatar">AI</span>
								<div class="chat-bubble">The dock uses a binary split tree. Each node is either a <strong>split</strong> (horizontal/vertical with two children) or a <strong>leaf</strong> (tabbed panel container). You can drag tabs between leaves or split them into new panes.</div>
							</div>
							<div class="chat-msg user">
								<div class="chat-bubble">Nice, can I resize the panels?</div>
							</div>
							<div class="chat-msg assistant">
								<span class="chat-avatar">AI</span>
								<div class="chat-bubble">Yes! Drag the divider between any two panels to resize. The layout auto-persists to localStorage so your arrangement is remembered.</div>
							</div>
						</div>
						<div class="chat-input-bar">
							<input type="text" class="chat-input" placeholder="Type a message..." disabled />
							<button class="chat-send" disabled>
								<span class="i-lucide-send"></span>
							</button>
						</div>
					</div>
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
					<div class="sheet-panel">
						<div class="sheet-formula-bar">
							<span class="sheet-cell-ref">B6</span>
							<span class="sheet-fx">fx</span>
							<input type="text" class="sheet-formula-input" value="=SUM(B2:B5)" readonly />
						</div>
						<div class="sheet-grid-wrap">
							<table class="sheet-grid">
								<thead>
									<tr>
										<th class="sheet-row-header"></th>
										<th>A</th>
										<th>B</th>
										<th>C</th>
										<th>D</th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td class="sheet-row-header">1</td>
										<td class="sheet-bold">Category</td>
										<td class="sheet-bold sheet-num">Jan</td>
										<td class="sheet-bold sheet-num">Feb</td>
										<td class="sheet-bold sheet-num">Mar</td>
									</tr>
									<tr>
										<td class="sheet-row-header">2</td>
										<td>Engineering</td>
										<td class="sheet-num">1,200</td>
										<td class="sheet-num">1,350</td>
										<td class="sheet-num">1,400</td>
									</tr>
									<tr class="sheet-alt">
										<td class="sheet-row-header">3</td>
										<td>Marketing</td>
										<td class="sheet-num">800</td>
										<td class="sheet-num">950</td>
										<td class="sheet-num">1,100</td>
									</tr>
									<tr>
										<td class="sheet-row-header">4</td>
										<td>Operations</td>
										<td class="sheet-num">450</td>
										<td class="sheet-num">475</td>
										<td class="sheet-num">500</td>
									</tr>
									<tr class="sheet-alt">
										<td class="sheet-row-header">5</td>
										<td>Design</td>
										<td class="sheet-num">397</td>
										<td class="sheet-num">420</td>
										<td class="sheet-num">380</td>
									</tr>
									<tr class="sheet-total">
										<td class="sheet-row-header">6</td>
										<td class="sheet-bold">Total</td>
										<td class="sheet-num sheet-bold sheet-selected">2,847</td>
										<td class="sheet-num sheet-bold">3,195</td>
										<td class="sheet-num sheet-bold">3,380</td>
									</tr>
								</tbody>
							</table>
						</div>
						<div class="sheet-status-bar">
							<span>Sum: <strong>2,847</strong></span>
							<span>Count: <strong>4</strong></span>
							<span>Average: <strong>711.75</strong></span>
						</div>
					</div>
				{:else if type === 'files'}
					<div class="files-panel">
						<div class="files-toolbar">
							<span class="files-title"><span class="i-lucide-folder-tree"></span> Explorer</span>
							<span class="files-actions">
								<button class="files-action" disabled><span class="i-lucide-file-plus"></span></button>
								<button class="files-action" disabled><span class="i-lucide-folder-plus"></span></button>
								<button class="files-action" disabled><span class="i-lucide-refresh-cw"></span></button>
							</span>
						</div>
						<div class="files-tree">
							<div class="ft-item ft-folder ft-open ft-depth-0">
								<span class="ft-toggle">&#9662;</span>
								<span class="i-lucide-folder-open ft-icon ft-icon-folder"></span>
								<span class="ft-label">src</span>
							</div>
							<div class="ft-item ft-folder ft-open ft-depth-1">
								<span class="ft-toggle">&#9662;</span>
								<span class="i-lucide-folder-open ft-icon ft-icon-folder"></span>
								<span class="ft-label">lib</span>
							</div>
							<div class="ft-item ft-folder ft-depth-2">
								<span class="ft-toggle">&#9656;</span>
								<span class="i-lucide-folder ft-icon ft-icon-folder"></span>
								<span class="ft-label">components</span>
							</div>
							<div class="ft-item ft-folder ft-depth-2">
								<span class="ft-toggle">&#9656;</span>
								<span class="i-lucide-folder ft-icon ft-icon-folder"></span>
								<span class="ft-label">server</span>
							</div>
							<div class="ft-item ft-file ft-depth-2">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-code ft-icon ft-icon-ts"></span>
								<span class="ft-label">utils.ts</span>
							</div>
							<div class="ft-item ft-file ft-depth-2">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-code ft-icon ft-icon-ts"></span>
								<span class="ft-label">constants.ts</span>
							</div>
							<div class="ft-item ft-folder ft-open ft-depth-1">
								<span class="ft-toggle">&#9662;</span>
								<span class="i-lucide-folder-open ft-icon ft-icon-folder"></span>
								<span class="ft-label">routes</span>
							</div>
							<div class="ft-item ft-file ft-selected ft-depth-2">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file ft-icon ft-icon-svelte"></span>
								<span class="ft-label">+page.svelte</span>
							</div>
							<div class="ft-item ft-file ft-depth-2">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file ft-icon ft-icon-svelte"></span>
								<span class="ft-label">+layout.svelte</span>
							</div>
							<div class="ft-item ft-file ft-depth-2">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-code ft-icon ft-icon-ts"></span>
								<span class="ft-label">+page.server.ts</span>
							</div>
							<div class="ft-item ft-folder ft-depth-1">
								<span class="ft-toggle">&#9656;</span>
								<span class="i-lucide-folder ft-icon ft-icon-folder"></span>
								<span class="ft-label">styles</span>
							</div>
							<div class="ft-item ft-file ft-depth-0">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file ft-icon ft-icon-svelte"></span>
								<span class="ft-label">app.html</span>
							</div>
							<div class="ft-item ft-file ft-depth-0">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-code ft-icon ft-icon-css"></span>
								<span class="ft-label">app.css</span>
							</div>
							<div class="ft-item ft-file ft-depth-0">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-text ft-icon"></span>
								<span class="ft-label">package.json</span>
							</div>
							<div class="ft-item ft-file ft-depth-0">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-text ft-icon"></span>
								<span class="ft-label">svelte.config.js</span>
							</div>
							<div class="ft-item ft-file ft-depth-0">
								<span class="ft-toggle"></span>
								<span class="i-lucide-file-text ft-icon"></span>
								<span class="ft-label">uno.config.ts</span>
							</div>
						</div>
						<div class="files-status-bar">
							<span>16 items</span>
							<span>4 folders</span>
						</div>
					</div>
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

	/* Chat panel */
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.chat-msg {
		display: flex;
		gap: 8px;
		max-width: 85%;
	}

	.chat-msg.user {
		align-self: flex-end;
		flex-direction: row-reverse;
	}

	.chat-avatar {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: var(--color-on-primary-container);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 600;
	}

	.chat-bubble {
		padding: 8px 12px;
		border-radius: var(--radius-lg);
		font-size: 13px;
		line-height: 1.5;
	}

	.chat-msg.assistant .chat-bubble {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.chat-msg.user .chat-bubble {
		background: var(--color-primary);
		color: var(--color-on-primary-container);
	}

	.chat-input-bar {
		display: flex;
		gap: 8px;
		padding: 8px 12px;
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.chat-input {
		flex: 1;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: 13px;
	}

	.chat-input::placeholder {
		color: var(--color-muted);
	}

	.chat-send {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: var(--radius-md);
		background: var(--color-primary);
		color: var(--color-on-primary-container);
		cursor: pointer;
	}

	.chat-send:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Spreadsheet panel */
	.sheet-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.sheet-formula-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 8px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
		font-size: 12px;
	}

	.sheet-cell-ref {
		padding: 2px 8px;
		min-width: 40px;
		text-align: center;
		font-weight: 600;
		font-size: 11px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
	}

	.sheet-fx {
		font-style: italic;
		font-weight: 600;
		color: var(--color-muted);
		font-size: 11px;
	}

	.sheet-formula-input {
		flex: 1;
		padding: 2px 8px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		font-family: monospace;
		font-size: 12px;
	}

	.sheet-grid-wrap {
		flex: 1;
		overflow: auto;
	}

	.sheet-grid {
		width: 100%;
		border-collapse: collapse;
		font-size: 12px;
		table-layout: fixed;
	}

	.sheet-grid thead th {
		position: sticky;
		top: 0;
		z-index: 1;
		padding: 4px 12px;
		font-weight: 600;
		font-size: 11px;
		text-align: center;
		color: var(--color-muted);
		background: var(--surface-1);
		border-bottom: 1px solid var(--color-border);
		border-right: 1px solid var(--color-border);
	}

	.sheet-row-header {
		width: 36px;
		min-width: 36px;
		text-align: center;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-muted);
		background: var(--surface-1);
		border-right: 1px solid var(--color-border);
	}

	.sheet-grid td {
		padding: 4px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		border-right: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
		color: var(--color-fg);
	}

	.sheet-num {
		text-align: right;
		font-family: monospace;
		font-variant-numeric: tabular-nums;
	}

	.sheet-bold {
		font-weight: 600;
	}

	.sheet-alt td:not(.sheet-row-header) {
		background: color-mix(in srgb, var(--surface-1) 40%, transparent);
	}

	.sheet-total td {
		border-top: 2px solid var(--color-border);
	}

	.sheet-selected {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.sheet-status-bar {
		display: flex;
		gap: 16px;
		padding: 4px 12px;
		font-size: 11px;
		color: var(--color-muted);
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	/* File browser panel */
	.files-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-bg);
	}

	.files-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 10px;
		border-bottom: 1px solid var(--color-border);
		background: var(--surface-1);
	}

	.files-title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
	}

	.files-actions {
		display: flex;
		gap: 2px;
	}

	.files-action {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--color-muted);
		cursor: pointer;
		font-size: 14px;
	}

	.files-action:hover:not(:disabled) {
		background: var(--surface-2);
		color: var(--color-fg);
	}

	.files-action:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.files-tree {
		flex: 1;
		overflow-y: auto;
		padding: 4px 0;
	}

	.ft-item {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--color-fg);
		border-radius: 0;
	}

	.ft-item:hover {
		background: color-mix(in srgb, var(--surface-2) 60%, transparent);
	}

	.ft-item.ft-selected {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.ft-depth-0 { padding-left: 8px; }
	.ft-depth-1 { padding-left: 24px; }
	.ft-depth-2 { padding-left: 40px; }

	.ft-toggle {
		width: 14px;
		font-size: 10px;
		text-align: center;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	.ft-icon {
		font-size: 15px;
		flex-shrink: 0;
	}

	.ft-icon-folder {
		color: var(--color-warning, #d4a72c);
	}

	.ft-icon-svelte {
		color: #ff3e00;
	}

	.ft-icon-ts {
		color: #3178c6;
	}

	.ft-icon-css {
		color: #1572b6;
	}

	.ft-label {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ft-folder > .ft-label {
		font-weight: 500;
	}

	.files-status-bar {
		display: flex;
		gap: 16px;
		padding: 4px 10px;
		font-size: 11px;
		color: var(--color-muted);
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
	}
</style>
