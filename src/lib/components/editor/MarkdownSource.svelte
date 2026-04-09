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

function handleDragOver(e: DragEvent) {
	if (e.dataTransfer?.types.includes('application/x-explorer-asset')) {
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}
}

function handleDrop(e: DragEvent) {
	const json = e.dataTransfer?.getData('application/x-explorer-asset');
	if (!json) return;
	e.preventDefault();

	try {
		const data = JSON.parse(json) as { id: string; altText: string };
		const markdown = `![${data.altText}](/api/blog/assets/${data.id}/image)`;

		const textarea = e.currentTarget as HTMLTextAreaElement;
		const pos = textarea.selectionStart ?? value.length;
		const before = value.slice(0, pos);
		const after = value.slice(pos);
		const needsNewline = before.length > 0 && !before.endsWith('\n');

		value = `${before + (needsNewline ? '\n' : '') + markdown}\n${after}`;
		oninput?.(value);

		// Move cursor after inserted text
		const newPos = pos + (needsNewline ? 1 : 0) + markdown.length + 1;
		requestAnimationFrame(() => {
			textarea.selectionStart = newPos;
			textarea.selectionEnd = newPos;
			textarea.focus();
		});
	} catch {
		// Invalid JSON — ignore
	}
}
</script>

<div class="markdown-source">
	<textarea
		class="source-textarea"
		{value}
		oninput={handleInput}
		onkeydown={handleKeydown}
		ondragover={handleDragOver}
		ondrop={handleDrop}
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
