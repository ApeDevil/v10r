<script lang="ts">
	import { DockLayout } from '$lib/components/composites/dock';
	import type { LayoutNode, PanelDefinition, ActivityBarItem } from '$lib/components/composites/dock';
	import {
		DotPattern,
		GridPattern,
		RetroGrid,
		GradientBlob,
		NoiseTexture,
		RadialGlow
	} from '$lib/components/primitives/decorative/background';

	const panelTypes = ['notes', 'canvas', 'terminal', 'gallery', 'inbox', 'dashboard', 'chat', 'spreadsheet'] as const;

	const panels: Record<string, PanelDefinition> = {
		notes: { id: 'notes', type: 'notes', label: 'Notes', icon: 'i-lucide-notebook-pen', closable: true },
		canvas: { id: 'canvas', type: 'canvas', label: 'Canvas', icon: 'i-lucide-pen-tool', closable: true },
		terminal: { id: 'terminal', type: 'terminal', label: 'Terminal', icon: 'i-lucide-terminal', closable: true },
		gallery: { id: 'gallery', type: 'gallery', label: 'Gallery', icon: 'i-lucide-image', closable: true },
		inbox: { id: 'inbox', type: 'inbox', label: 'Inbox', icon: 'i-lucide-inbox', closable: true },
		dashboard: { id: 'dashboard', type: 'dashboard', label: 'Dashboard', icon: 'i-lucide-bar-chart-3', closable: true },
		chat: { id: 'chat', type: 'chat', label: 'Chat', icon: 'i-lucide-message-circle', closable: true },
		spreadsheet: { id: 'spreadsheet', type: 'spreadsheet', label: 'Spreadsheet', icon: 'i-lucide-sheet', closable: true },
	};

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
						activeTab: 'notes'
					},
					{
						type: 'leaf',
						id: 'desk-left-bottom',
						tabs: ['chat'],
						activeTab: 'chat'
					}
				]
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
						activeTab: 'canvas'
					},
					{
						type: 'leaf',
						id: 'desk-right-bottom',
						tabs: ['terminal', 'gallery'],
						activeTab: 'terminal'
					}
				]
			}
		]
	};

	const activityBarItems: ActivityBarItem[] = [
		{ panelType: 'notes', icon: 'i-lucide-notebook-pen', label: 'Notes' },
		{ panelType: 'canvas', icon: 'i-lucide-pen-tool', label: 'Canvas' },
		{ panelType: 'terminal', icon: 'i-lucide-terminal', label: 'Terminal' },
		{ panelType: 'gallery', icon: 'i-lucide-image', label: 'Gallery' },
		{ panelType: 'inbox', icon: 'i-lucide-inbox', label: 'Inbox' },
		{ panelType: 'dashboard', icon: 'i-lucide-bar-chart-3', label: 'Dashboard' },
		{ panelType: 'chat', icon: 'i-lucide-message-circle', label: 'Chat' },
		{ panelType: 'spreadsheet', icon: 'i-lucide-sheet', label: 'Spreadsheet' },
	];

	/** Resolve panel type — handles dynamic IDs from activity bar (e.g. "notes-1709312345") */
	function getPanelType(panelId: string): string | undefined {
		return panelTypes.find(t => panelId === t || panelId.startsWith(`${t}-`));
	}
</script>

<svelte:head>
	<title>Desk - Velociraptor</title>
</svelte:head>

<div class="desk-page">
	<DockLayout
		{initialRoot}
		initialPanels={panels}
		{activityBarItems}
		persist="desk-layout"
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
					<RetroGrid opacity={0.10} class="absolute inset-0" />
					<div class="desk-chip"><span class="i-lucide-terminal"></span> Terminal</div>
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

	/* Chat panel */
	.chat-panel {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--surface-0);
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
		color: var(--color-primary-fg);
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
		color: var(--color-primary-fg);
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
		background: var(--surface-0);
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
		color: var(--color-primary-fg);
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
		background: var(--surface-0);
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
		background: var(--surface-0);
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
		background: var(--surface-0);
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
</style>
