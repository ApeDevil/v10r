<script lang="ts">
	import {
		Button,
		Badge,
		Kamon,
		Flourish,
		Asterism
	} from '$lib/components';

	let isLoggedIn = $state(false);

	const mockUser = {
		name: 'Ada Lovelace',
		email: 'ada@example.com',
		role: 'Admin',
		lastLogin: 'Feb 28, 2026 at 10:42 AM',
		initials: 'AL'
	};
</script>

<section id="auth-insignia" class="section">
	<h2 class="section-title">Insignia</h2>
	<p class="section-description">
		Session state display toggling between authenticated and unauthenticated views.
	</p>

	<div class="demos">
		<div class="insignia-frame">
			<Flourish position="bottom-right" size={32} />

			<div class="insignia-inner">
				<div class="insignia-header">
					<Kamon folds={6} size={48} />
					<h3 class="text-xl font-bold text-fg">Session State</h3>
				</div>

				<Asterism pattern="fleuron" />

				{#if isLoggedIn}
					<div class="session-card">
						<div class="avatar">
							{mockUser.initials}
						</div>
						<div class="session-info">
							<p class="session-name">{mockUser.name}</p>
							<p class="session-email">{mockUser.email}</p>
							<div class="session-meta">
								<Badge variant="default">{mockUser.role}</Badge>
								<span class="text-xs text-muted">Last login: {mockUser.lastLogin}</span>
							</div>
						</div>
					</div>

					<Button
						variant="outline"
						size="lg"
						class="w-full justify-center"
						onclick={() => isLoggedIn = false}
					>
						<span class="i-lucide-log-out text-lg mr-2" aria-hidden="true"></span>
						Sign out
					</Button>
				{:else}
					<div class="signed-out">
						<span class="i-lucide-lock text-4xl text-muted" aria-hidden="true"></span>
						<p class="text-lg font-medium text-fg">Not signed in</p>
						<p class="text-sm text-muted">Sign in to access your account</p>
					</div>

					<Button
						variant="default"
						size="lg"
						class="w-full justify-center"
						onclick={() => isLoggedIn = true}
					>
						<span class="i-lucide-log-in text-lg mr-2" aria-hidden="true"></span>
						Sign in
					</Button>
				{/if}
			</div>
		</div>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.insignia-frame {
		position: relative;
		max-width: 420px;
		margin: 0 auto;
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.insignia-inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-5);
	}

	.insignia-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		text-align: center;
	}

	.insignia-header h3 {
		margin: 0;
	}

	.session-card {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		width: 100%;
		padding: var(--spacing-4);
		background: var(--color-surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.avatar {
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		color: var(--color-primary-fg);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 1.125rem;
		flex-shrink: 0;
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.session-name {
		margin: 0;
		font-weight: 600;
		color: var(--color-fg);
	}

	.session-email {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.session-meta {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		margin-top: var(--spacing-1);
	}

	.signed-out {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-6) 0;
		text-align: center;
	}

	.signed-out p {
		margin: 0;
	}
</style>
