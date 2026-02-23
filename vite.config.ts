import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';

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
		conditions: ['browser'],
		alias: [
			// Use local NDK build which includes NDKCollaborativeEvent
			{
				find: '@nostr-dev-kit/ndk',
				replacement: path.resolve(__dirname, './.ndk-local/index.mjs')
			},
			// Handle @noble/curves subpath imports — v2 has files in root, not esm/
			{
				find: '@noble/curves/esm/secp256k1',
				replacement: path.resolve(__dirname, './node_modules/@noble/curves/secp256k1.js')
			},
			{
				find: '@noble/curves/esm/ed25519',
				replacement: path.resolve(__dirname, './node_modules/@noble/curves/ed25519.js')
			},
			{
				find: '@noble/curves/secp256k1',
				replacement: path.resolve(__dirname, './node_modules/@noble/curves/secp256k1.js')
			},
			{
				find: '@noble/curves/ed25519',
				replacement: path.resolve(__dirname, './node_modules/@noble/curves/ed25519.js')
			},
			{
				find: '@noble/hashes/sha256',
				replacement: path.resolve(__dirname, './node_modules/@noble/hashes/sha2.js')
			},
			{
				find: '@noble/hashes/sha512',
				replacement: path.resolve(__dirname, './node_modules/@noble/hashes/sha2.js')
			},
			{
				find: '@noble/hashes/utils',
				replacement: path.resolve(__dirname, './node_modules/@noble/hashes/utils.js')
			}
		]
	}
});
