# AGENTS.md

## Project Overview

Bolsillo is a SvelteKit application using Svelte 5, NDK (Nostr Development Kit), and TypeScript.

## Development

- **Package manager:** bun
- **Dev server:** `bun run dev`
- **Build:** `bun run build`
- **Type check:** `bun run check`

## Deployment

Deployments use **Vercel** by default.

- **Adapter:** `@sveltejs/adapter-vercel` (Node.js 22.x runtime)
- **Build command:** `bun run build`
- **Install command:** `bun install`
- **Framework:** SvelteKit
