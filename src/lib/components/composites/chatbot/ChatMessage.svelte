<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		role: 'user' | 'assistant';
		content: string;
	}

	let { role, content }: Props = $props();

	const isUser = $derived(role === 'user');
</script>

<div class={cn('flex gap-3 px-4 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
	<div
		class={cn(
			'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
			isUser ? 'bg-primary text-white' : 'chat-avatar-assistant'
		)}
	>
		<span class={cn(isUser ? 'i-lucide-user' : 'i-lucide-bot', 'h-4 w-4')}></span>
	</div>

	<div
		class={cn(
			'chat-bubble max-w-[80%] rounded-lg px-4 py-2 text-fluid-sm',
			isUser ? 'chat-bubble-user text-white' : 'chat-bubble-assistant text-fg'
		)}
	>
		<p class="whitespace-pre-wrap">{content}</p>
	</div>
</div>

<style>
	.chat-avatar-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.chat-bubble-user {
		background-color: var(--color-primary);
	}

	.chat-bubble-assistant {
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}
</style>
