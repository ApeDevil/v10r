<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button } from '$lib/components/primitives';
</script>
<div class="thanks-page">
	<Card>
		<Stack gap="4">
			<h1 class="thanks-title">Thanks — we got it.</h1>
			<p class="thanks-body">
				Your message was saved. If you left an email and we have something useful to say back, we'll reach out.
				Otherwise, no news = signal received.
			</p>
			<div class="actions">
				<Button variant="outline" size="md" href="/">Back home</Button>
				<Button variant="ghost" size="md" href="/feedback">Send another</Button>
			</div>
		</Stack>
	</Card>
</div>

<style>
	.thanks-page {
		max-width: 36rem;
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	.thanks-title {
		margin: 0;
		font-size: var(--text-fluid-2xl, 1.5rem);
		font-weight: 600;
		color: var(--color-fg);
	}

	.thanks-body {
		margin: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
	}

	.actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}
</style>
