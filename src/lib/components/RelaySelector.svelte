<script lang="ts">
	import { relayState, addRelay, removeRelay, resetToDefault } from '$lib/relay-store.svelte';

	let isOpen = $state(false);
	let newRelayUrl = $state('');
	let inputError = $state('');
	// Plain element ref — no need for $state, bind:this handles reactivity
	let container: HTMLDivElement | null = null;

	function close(): void {
		isOpen = false;
		newRelayUrl = '';
		inputError = '';
	}

	function toggle(): void {
		if (isOpen) {
			close();
		} else {
			isOpen = true;
		}
	}

	function handleAdd(): void {
		inputError = '';
		if (!newRelayUrl.trim()) return;
		try {
			addRelay(newRelayUrl);
			newRelayUrl = '';
		} catch (err) {
			inputError = err instanceof Error ? err.message : 'Invalid relay URL';
		}
	}

	function handleInputKeydown(e: KeyboardEvent): void {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleAdd();
		} else if (e.key === 'Escape') {
			close();
		}
	}

	function handleReset(): void {
		resetToDefault();
		close();
	}

	// Close dropdown when clicking outside
	function handleDocumentClick(e: MouseEvent): void {
		if (container && !container.contains(e.target as Node)) {
			close();
		}
	}

	$effect(() => {
		if (isOpen) {
			document.addEventListener('click', handleDocumentClick);
			return () => document.removeEventListener('click', handleDocumentClick);
		}
	});
</script>

<div class="relative" bind:this={container}>
	<button
		type="button"
		onclick={toggle}
		class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
			{relayState.isCustomMode
				? 'bg-violet-500/20 border border-violet-500/40 text-violet-300 hover:bg-violet-500/30'
				: 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'}"
		title={relayState.isCustomMode ? 'Custom relays active — click to manage' : 'Using default relays — click to customize'}
	>
		<!-- Relay/wifi icon -->
		<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path stroke-linecap="round" stroke-linejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
		</svg>
		{#if relayState.isCustomMode}
			<span>{relayState.customRelays.length} relay{relayState.customRelays.length !== 1 ? 's' : ''}</span>
			<span class="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
		{:else}
			<span>Default</span>
		{/if}
		<svg
			class="w-2.5 h-2.5 transition-transform duration-150 {isOpen ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
		</svg>
	</button>

	{#if isOpen}
		<div class="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700/60 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in">
			<!-- Header -->
			<div class="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
				<span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Relay Selection</span>
				{#if relayState.isCustomMode}
					<button
						type="button"
						onclick={handleReset}
						class="text-xs text-zinc-500 hover:text-red-400 transition-colors"
					>
						Reset to default
					</button>
				{/if}
			</div>

			<!-- Current relays list -->
			{#if relayState.isCustomMode}
				<div class="max-h-44 overflow-y-auto">
					{#each relayState.customRelays as relay (relay)}
						<div class="flex items-center gap-2 px-4 py-2 group hover:bg-zinc-800/40 transition-colors">
							<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
							<span class="flex-1 text-xs text-zinc-300 font-mono truncate">{relay}</span>
							<button
								type="button"
								onclick={() => removeRelay(relay)}
								class="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all"
								title="Remove relay"
							>
								<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<div class="px-4 py-3 text-xs text-zinc-500 leading-relaxed">
					Using default relays. Add one or more relays below to restrict reading and publishing exclusively to those relays.
				</div>
			{/if}

			<!-- Add relay input -->
			<div class="px-4 py-3 border-t border-zinc-800/60 space-y-2">
				<div class="flex gap-1.5">
					<input
						type="text"
						bind:value={newRelayUrl}
						placeholder="wss://relay.example.com"
						onkeydown={handleInputKeydown}
						class="flex-1 bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all"
					/>
					<button
						type="button"
						onclick={handleAdd}
						disabled={!newRelayUrl.trim()}
						class="px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
					>
						Add
					</button>
				</div>

				{#if inputError}
					<p class="text-xs text-red-400">{inputError}</p>
				{/if}

				{#if relayState.isCustomMode}
					<p class="text-[10px] text-zinc-600 leading-relaxed">
						⚡ Events will be tagged with NIP-70 protection (<code class="font-mono">["-"]</code>) and published exclusively to these relays. Reading will also be restricted to these relays.
					</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
