import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			allow: ['.']
		}
	},
	ssr: {
		// Bundle these so Vite resolve aliases are applied during SSR
		noExternal: ['@nostr-dev-kit/ndk', 'nostr-tools', '@noble/curves', '@noble/hashes', '@noble/ciphers']
	},
	optimizeDeps: {
		// Svelte must NOT be pre-bundled — Vite's esbuild resolves it to index-server.js
		exclude: ['svelte']
	},
	resolve: {
		// Ensure the 'browser' export condition is used for client-side resolution
		// Without this, Vite may resolve svelte to index-server.js (the 'default' export)
		conditions: ['browser']
	}
});
