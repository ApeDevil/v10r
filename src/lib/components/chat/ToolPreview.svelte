<script lang="ts">
	interface Props {
		toolName: string;
		args: Record<string, unknown>;
		onapprove: () => void;
		onreject: () => void;
	}

	let { toolName, args, onapprove, onreject }: Props = $props();

	function formatArgs(): string {
		try {
			return JSON.stringify(args, null, 2);
		} catch {
			return String(args);
		}
	}

	function describeAction(): string {
		if (toolName === 'spreadsheet_setCell') {
			return `Set cell ${args.cell} = ${args.value}`;
		}
		if (toolName === 'spreadsheet_setRange') {
			const cells = args.cells as Array<{ cell: string }> | undefined;
			return `Set ${cells?.length ?? '?'} cells`;
		}
		return `Execute ${toolName}`;
	}
</script>

<div class="tool-preview">
	<div class="tool-preview-header">
		<span class="i-lucide-wrench tool-preview-icon"></span>
		<span class="tool-preview-name">{toolName}</span>
	</div>

	<div class="tool-preview-description">{describeAction()}</div>

	<pre class="tool-preview-args">{formatArgs()}</pre>

	<div class="tool-preview-actions">
		<button class="tool-preview-btn tool-preview-btn--approve" onclick={onapprove}>
			<span class="i-lucide-check"></span>
			Approve
		</button>
		<button class="tool-preview-btn tool-preview-btn--reject" onclick={onreject}>
			<span class="i-lucide-x"></span>
			Reject
		</button>
	</div>
</div>

<style>
	.tool-preview {
		margin: 4px 16px 4px 60px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 30%, transparent);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 6%, transparent);
		font-size: 12px;
	}

	.tool-preview-header {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 4px;
	}

	.tool-preview-icon {
		font-size: 12px;
		color: var(--color-warning, #f59e0b);
	}

	.tool-preview-name {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--color-muted);
	}

	.tool-preview-description {
		font-size: 12px;
		color: var(--color-fg);
		margin-bottom: 4px;
	}

	.tool-preview-args {
		margin: 0 0 8px;
		padding: 4px 8px;
		border-radius: 4px;
		background: color-mix(in srgb, var(--color-muted) 8%, transparent);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.5;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-all;
	}

	.tool-preview-actions {
		display: flex;
		gap: 8px;
	}

	.tool-preview-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-size: 11px;
		cursor: pointer;
		background: transparent;
		color: var(--color-fg);
	}

	.tool-preview-btn:hover {
		background: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.tool-preview-btn--approve {
		border-color: color-mix(in srgb, var(--color-success, #22c55e) 40%, transparent);
		color: var(--color-success, #22c55e);
	}

	.tool-preview-btn--approve:hover {
		background: color-mix(in srgb, var(--color-success, #22c55e) 10%, transparent);
	}

	.tool-preview-btn--reject {
		border-color: color-mix(in srgb, var(--color-error-fg, #ef4444) 40%, transparent);
		color: var(--color-error-fg, #ef4444);
	}

	.tool-preview-btn--reject:hover {
		background: color-mix(in srgb, var(--color-error-fg, #ef4444) 10%, transparent);
	}

	.tool-preview-btn span {
		font-size: 12px;
	}
</style>
