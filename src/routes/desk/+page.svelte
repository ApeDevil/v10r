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

	const panelTypes = ['notes', 'canvas', 'terminal', 'gallery', 'inbox', 'dashboard', 'chat'] as const;

	const panels: Record<string, PanelDefinition> = {
		notes: { id: 'notes', type: 'notes', label: 'Notes', icon: 'i-lucide-notebook-pen', closable: true },
		canvas: { id: 'canvas', type: 'canvas', label: 'Canvas', icon: 'i-lucide-pen-tool', closable: true },
		terminal: { id: 'terminal', type: 'terminal', label: 'Terminal', icon: 'i-lucide-terminal', closable: true },
		gallery: { id: 'gallery', type: 'gallery', label: 'Gallery', icon: 'i-lucide-image', closable: true },
		inbox: { id: 'inbox', type: 'inbox', label: 'Inbox', icon: 'i-lucide-inbox', closable: true },
		dashboard: { id: 'dashboard', type: 'dashboard', label: 'Dashboard', icon: 'i-lucide-bar-chart-3', closable: true },
		chat: { id: 'chat', type: 'chat', label: 'Chat', icon: 'i-lucide-message-circle', closable: true },
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
						tabs: ['canvas', 'dashboard'],
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
</style>
