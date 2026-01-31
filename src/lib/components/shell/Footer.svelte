<script lang="ts">
	const currentYear = new Date().getFullYear();
</script>

<footer class="app-footer">
	<div class="footer-content">
		<p class="footer-text">
			© {currentYear} Velociraptor. Built with SvelteKit.
		</p>
		<nav class="footer-links">
			<a href="/about" class="footer-link">About</a>
			<a href="/privacy" class="footer-link">Privacy</a>
			<a href="/terms" class="footer-link">Terms</a>
		</nav>
	</div>
</footer>

<style>
	.app-footer {
		margin-top: auto;
		padding: 2rem 1rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-bg);
	}

	.footer-content {
		max-width: var(--layout-max-width, 80rem);
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		align-items: center;
		text-align: center;
	}

	.footer-text {
		color: var(--color-muted);
		font-size: 0.875rem;
		margin: 0;
	}

	.footer-links {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.footer-link {
		color: var(--color-muted);
		font-size: 0.875rem;
		text-decoration: none;
		transition: color var(--duration-fast, 150ms);
	}

	.footer-link:hover {
		color: var(--color-fg);
	}

	.footer-link:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: 0.25rem;
	}

	@media (min-width: 768px) {
		.footer-content {
			flex-direction: row;
			justify-content: space-between;
			text-align: left;
		}
	}
</style>
