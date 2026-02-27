<script lang="ts">
	interface Props {
		count: number;
	}

	let { count }: Props = $props();
</script>

{#if count > 0}
	<span class="notification-badge" aria-label="{count} unread notifications">
		{count > 99 ? '99+' : count}
	</span>
{/if}

<style>
	.notification-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.125rem;
		height: 1.125rem;
		padding: 0 0.3125rem;
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1;
		color: white;
		background-color: var(--color-error);
		border-radius: 9999px;
	}
</style>
