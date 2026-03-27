<script lang="ts">
import { localizeHref } from '$lib/i18n';

interface Props {
	href: string;
	label: string;
}

let { href, label }: Props = $props();
</script>

<a href={localizeHref(href)} class="back-link">← Back to {label}</a>

<style>
	.back-link {
		display: inline-block;
		margin-top: var(--spacing-7);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
