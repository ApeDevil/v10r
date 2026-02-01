<script lang="ts">
	const currentYear = new Date().getFullYear();
</script>

<footer class="mt-auto py-8 px-4 border-t border-border bg-bg">
	<div class="max-w-[80rem] mx-auto flex flex-col gap-4 items-center text-center md:flex-row md:justify-between md:text-left">
		<p class="text-muted text-sm m-0">
			© {currentYear} Velociraptor. Built with SvelteKit.
		</p>
		<nav class="flex gap-6 flex-wrap">
			<a href="/about" class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">About</a>
			<a href="/privacy" class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Privacy</a>
			<a href="/terms" class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Terms</a>
		</nav>
	</div>
</footer>
