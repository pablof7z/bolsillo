<script lang="ts">
	import '../app.css';
	import { restoreSession } from '$lib/state.svelte';

	let { children } = $props();

	$effect(() => {
		restoreSession();
	});
</script>

<svelte:head>
	<title>Bolsillo — Collaborative Documents on Nostr</title>
	<meta name="description" content="Real-time collaborative document editing powered by Nostr and NDK" />
</svelte:head>

<div class="min-h-screen bg-zinc-950">
	{@render children()}
</div>
