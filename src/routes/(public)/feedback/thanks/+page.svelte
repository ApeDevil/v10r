<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Button } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
</script>
<div class="thanks-page">
	<Card>
		<Stack gap="4">
			<h1 class="thanks-title">{m.feedback_thanks_title()}</h1>
			<p class="thanks-body">{m.feedback_thanks_body()}</p>
			<div class="actions">
				<Button variant="outline" size="md" href="/">{m.feedback_thanks_back_home()}</Button>
				<Button variant="ghost" size="md" href="/feedback">{m.feedback_thanks_send_another()}</Button>
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
