<script lang="ts">
	interface Props {
		value: string;
		onsave?: () => void;
		oninput?: (value: string) => void;
	}

	let { value = $bindable(''), onsave, oninput }: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault();
			onsave?.();
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		oninput?.(value);
	}
</script>

<div class="markdown-source">
	<textarea
		class="source-textarea"
		{value}
		oninput={handleInput}
		onkeydown={handleKeydown}
		placeholder="Start writing markdown..."
		spellcheck="true"
	></textarea>
</div>

<style>
	.markdown-source {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.source-textarea {
		flex: 1;
		width: 100%;
		min-height: 0;
		padding: 16px 20px;
		font-family: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
		font-size: 13px;
		line-height: 1.7;
		color: var(--color-fg);
		background: var(--color-bg);
		border: none;
		outline: none;
		resize: none;
		tab-size: 2;
	}

	.source-textarea::placeholder {
		color: var(--color-muted);
		opacity: 0.6;
	}
</style>
