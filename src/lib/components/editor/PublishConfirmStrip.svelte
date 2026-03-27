<script lang="ts">
	import { Button } from '$lib/components/primitives';

	interface Props {
		postStatus: 'draft' | 'published' | 'archived';
		onconfirm: () => void;
		oncancel: () => void;
	}

	let { postStatus, onconfirm, oncancel }: Props = $props();

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			oncancel();
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="publish-strip" role="alert" onkeydown={handleKeyDown}>
	<span class="i-lucide-alert-triangle strip-icon"></span>
	<span class="strip-text">
		{postStatus === 'published' ? 'Update this post?' : 'Publish this post?'}
	</span>
	<Button variant="outline" size="sm" onclick={onconfirm}>
		{postStatus === 'published' ? 'Update' : 'Publish'}
	</Button>
	<Button variant="ghost" size="sm" onclick={oncancel}>
		Cancel
	</Button>
</div>

<style>
	.publish-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-bottom: 1px solid var(--color-border);
		border-left: 3px solid var(--color-warning, #f59e0b);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 5%, var(--color-bg));
		font-size: 13px;
	}

	.strip-icon {
		font-size: 14px;
		color: var(--color-warning, #f59e0b);
		flex-shrink: 0;
	}

	.strip-text {
		flex: 1;
		color: var(--color-fg);
	}
</style>
