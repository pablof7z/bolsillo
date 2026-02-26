<script lang="ts">
	import '../app.css';
	import { restoreSession } from '$lib/state.svelte';
	import { initializeRelays } from '$lib/relay-store.svelte';

	let { children } = $props();

	$effect(() => {
		restoreSession();
		// Register any stored custom relays with NDK after it is initialized.
		// Called here (post-mount) rather than at module init time to avoid a
		// race condition during NDK startup.
		initializeRelays();
	});
</script>

<svelte:head>
	<title>Bolsillo — Collaborative Documents on Nostr</title>
	<meta name="description" content="Real-time collaborative document editing powered by Nostr and NDK" />
</svelte:head>

<div class="min-h-screen bg-zinc-950">
	{@render children()}
</div>
