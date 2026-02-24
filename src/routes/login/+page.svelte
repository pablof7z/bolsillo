<script lang="ts">
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { ndk } from '$lib/ndk';
	import { login, loginWithExtension, loginWithBunker } from '$lib/state.svelte';

	type Tab = 'extension' | 'bunker' | 'nsec';

	let hasExtension = $state(false);
	let activeTab = $state<Tab>('extension');

	// Form state
	let nsec = $state('');
	let bunkerConnection = $state('');
	let showKey = $state(false);
	let loading = $state(false);
	let error = $state('');

	// Detect NIP-07 extension availability reactively
	$effect(() => {
		if (!browser) return;

		// Check immediately
		hasExtension = !!window.nostr;

		// Re-check after a short delay (extensions may inject asynchronously)
		const timer = setTimeout(() => {
			hasExtension = !!window.nostr;
			if (!hasExtension && activeTab === 'extension') {
				activeTab = 'bunker';
			}
		}, 500);

		return () => clearTimeout(timer);
	});

	// If already authenticated, redirect to homepage
	$effect(() => {
		if (ndk.$currentPubkey) {
			goto('/');
		}
	});

	function setTab(tab: Tab) {
		activeTab = tab;
		error = '';
	}

	async function handleExtensionLogin() {
		loading = true;
		error = '';
		try {
			await loginWithExtension();
			goto('/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Extension login failed';
		} finally {
			loading = false;
		}
	}

	async function handleBunkerLogin(e: Event) {
		e.preventDefault();
		if (!bunkerConnection.trim()) {
			error = 'Please enter a bunker connection string';
			return;
		}
		loading = true;
		error = '';
		try {
			await loginWithBunker(bunkerConnection.trim());
			goto('/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Bunker login failed';
		} finally {
			loading = false;
		}
	}

	async function handleNsecLogin(e: Event) {
		e.preventDefault();
		if (!nsec.trim()) {
			error = 'Please enter your nsec';
			return;
		}
		loading = true;
		error = '';
		try {
			await login(nsec.trim());
			goto('/');
		} catch (err) {
			error = err instanceof Error ? err.message : 'Login failed';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen flex items-center justify-center p-6">
	<div class="w-full max-w-md animate-fade-in">
		<!-- Logo / Brand -->
		<div class="text-center mb-10">
			<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 mb-5">
				<span class="text-2xl">📝</span>
			</div>
			<h1 class="text-2xl font-semibold text-zinc-100 tracking-tight">Bolsillo</h1>
			<p class="text-zinc-500 mt-2 text-sm">Collaborative documents on Nostr</p>
		</div>

		<!-- Login Card -->
		<div class="card p-8">
			<h2 class="text-lg font-medium text-zinc-200 mb-1">Sign in</h2>
			<p class="text-sm text-zinc-500 mb-6">Choose how you'd like to connect</p>

			<!-- Tabs -->
			<div class="flex gap-1 bg-zinc-900 rounded-lg p-1 mb-6">
				<button
					onclick={() => setTab('extension')}
					class="flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-150 {activeTab === 'extension'
						? 'bg-zinc-800 text-zinc-100 shadow-sm'
						: 'text-zinc-500 hover:text-zinc-300'}"
				>
					Extension
				</button>
				<button
					onclick={() => setTab('bunker')}
					class="flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-150 {activeTab === 'bunker'
						? 'bg-zinc-800 text-zinc-100 shadow-sm'
						: 'text-zinc-500 hover:text-zinc-300'}"
				>
					Remote Signer
				</button>
				<button
					onclick={() => setTab('nsec')}
					class="flex-1 text-xs font-medium py-2 px-3 rounded-md transition-all duration-150 {activeTab === 'nsec'
						? 'bg-zinc-800 text-zinc-100 shadow-sm'
						: 'text-zinc-500 hover:text-zinc-300'}"
				>
					Private Key
				</button>
			</div>

			{#if error}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm mb-5 animate-fade-in">
					{error}
				</div>
			{/if}

			<!-- Extension (NIP-07) Tab -->
			{#if activeTab === 'extension'}
				<div class="animate-fade-in">
					{#if hasExtension}
						<p class="text-sm text-zinc-400 mb-5">
							Sign in using your browser extension (nos2x, Alby, etc). Your keys never leave the extension.
						</p>
						<button
							onclick={handleExtensionLogin}
							disabled={loading}
							class="btn-primary w-full flex items-center justify-center gap-2"
						>
							{#if loading}
								<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
								Connecting…
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
								</svg>
								Sign in with Extension
							{/if}
						</button>
					{:else}
						<div class="text-center py-4">
							<div class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 mb-4">
								<svg class="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
								</svg>
							</div>
							<p class="text-sm text-zinc-400 mb-2">No extension detected</p>
							<p class="text-xs text-zinc-600 leading-relaxed">
								Install a NIP-07 compatible extension like
								<a href="https://github.com/nickodev/nos2x" target="_blank" rel="noopener" class="text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700">nos2x</a> or
								<a href="https://getalby.com" target="_blank" rel="noopener" class="text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700">Alby</a>
								to sign in with your browser.
							</p>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Bunker (NIP-46) Tab -->
			{#if activeTab === 'bunker'}
				<div class="animate-fade-in">
					<p class="text-sm text-zinc-400 mb-5">
						Connect to a remote signer using a bunker connection string or NIP-05 identifier.
					</p>
					<form onsubmit={handleBunkerLogin}>
						<div class="mb-5">
							<label for="bunker" class="block text-sm font-medium text-zinc-400 mb-2">
								Connection String
							</label>
							<input
								id="bunker"
								type="text"
								bind:value={bunkerConnection}
								placeholder="bunker://… or user@domain.com"
								class="input font-mono text-sm"
								disabled={loading}
								autocomplete="off"
								spellcheck="false"
							/>
						</div>

						<button type="submit" disabled={loading || !bunkerConnection.trim()} class="btn-primary w-full">
							{#if loading}
								<span class="inline-flex items-center gap-2">
									<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									Connecting to signer…
								</span>
							{:else}
								Connect
							{/if}
						</button>
					</form>
				</div>
			{/if}

			<!-- nsec Tab -->
			{#if activeTab === 'nsec'}
				<div class="animate-fade-in">
					<p class="text-sm text-zinc-400 mb-5">
						Sign in with your private key. It will be stored locally in your browser.
					</p>
					<form onsubmit={handleNsecLogin}>
						<div class="mb-5">
							<label for="nsec" class="block text-sm font-medium text-zinc-400 mb-2">
								Private Key
							</label>
							<div class="relative">
								<input
									id="nsec"
									type={showKey ? 'text' : 'password'}
									bind:value={nsec}
									placeholder="nsec1…"
									class="input pr-12 font-mono text-sm"
									disabled={loading}
									autocomplete="off"
									spellcheck="false"
								/>
								<button
									type="button"
									onclick={() => (showKey = !showKey)}
									class="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
									tabindex="-1"
								>
									{#if showKey}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
										</svg>
									{:else}
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
										</svg>
									{/if}
								</button>
							</div>
						</div>

						<button type="submit" disabled={loading || !nsec.trim()} class="btn-primary w-full">
							{#if loading}
								<span class="inline-flex items-center gap-2">
									<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
									</svg>
									Connecting…
								</span>
							{:else}
								Sign in
							{/if}
						</button>
					</form>
				</div>
			{/if}

			<p class="text-xs text-zinc-600 mt-5 text-center leading-relaxed">
				{#if activeTab === 'nsec'}
					Your key is stored locally in your browser<br />and never sent to any server.
				{:else if activeTab === 'extension'}
					Your keys stay in your extension — Bolsillo never sees them.
				{:else}
					Connected via your remote signer — your keys stay safe.
				{/if}
			</p>
		</div>

		<!-- Footer -->
		<p class="text-xs text-zinc-700 text-center mt-8">
			Powered by <a href="https://github.com/nostr-dev-kit/ndk" target="_blank" rel="noopener" class="text-zinc-500 hover:text-zinc-300 transition-colors">NDK</a> &
			<a href="https://nostr.com" target="_blank" rel="noopener" class="text-zinc-500 hover:text-zinc-300 transition-colors">Nostr</a>
		</p>
	</div>
</div>
