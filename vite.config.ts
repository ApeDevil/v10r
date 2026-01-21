import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	ssr: {
		noExternal: ['three'] // Required for Three.js/Threlte SSR compatibility
	},
	server: {
		host: '0.0.0.0',
		port: 5173,
		watch: {
			usePolling: true // Required for container file watching
		},
		hmr: {
			port: 24678
		}
	}
});
