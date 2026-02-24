<script lang="ts">
	import { tick } from 'svelte';
	import { resolveUser, type ResolveResult } from '$lib/resolve-user';
	import { ndk } from '$lib/ndk';
	import { User } from '$lib/components/ui';

	interface Props {
		open: boolean;
		existingPubkeys: string[];
		onAdd: (pubkey: string) => void;
		onClose: () => void;
	}

	let { open, existingPubkeys, onAdd, onClose }: Props = $props();

	let inputValue = $state('');
	let resolving = $state(false);
	let result = $state<ResolveResult | null>(null);
	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	let inputEl = $state<HTMLInputElement | undefined>();

	// Focus the input when the modal opens
	$effect(() => {
		if (open) {
			tick().then(() => inputEl?.focus());
		}
	});

	// Clear pending debounce timer on component teardown
	$effect(() => {
		return () => {
			if (debounceTimer) clearTimeout(debounceTimer);
		};
	});

	function reset() {
		inputValue = '';
		resolving = false;
		result = null;
		if (debounceTimer) clearTimeout(debounceTimer);
	}

	function handleClose() {
		reset();
		onClose();
	}

	function handleAdd() {
		if (result?.ok) {
			onAdd(result.user.pubkey);
			reset();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			handleClose();
		} else if (e.key === 'Enter' && result?.ok && !isDuplicate) {
			e.preventDefault();
			handleAdd();
		}
	}

	function handleInput() {
		result = null;
		if (debounceTimer) clearTimeout(debounceTimer);

		const value = inputValue.trim();
		if (!value) {
			resolving = false;
			return;
		}

		resolving = true;
		debounceTimer = setTimeout(async () => {
			try {
				const res = await resolveUser(value, ndk);
				// Only update if input hasn't changed
				if (inputValue.trim() === value) {
					result = res;
					resolving = false;
				}
			} catch {
				if (inputValue.trim() === value) {
					result = { ok: false, error: { type: 'network', message: 'Unexpected error resolving user' } };
					resolving = false;
				}
			}
		}, 400);
	}

	const isDuplicate = $derived(
		result?.ok ? existingPubkeys.includes(result.user.pubkey) : false
	);
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] animate-fade-in"
		onkeydown={handleKeydown}
	>
		<!-- Backdrop -->
		<button
			class="absolute inset-0 bg-black/60 backdrop-blur-sm"
			onclick={handleClose}
			aria-label="Close"
			tabindex="-1"
		></button>

		<!-- Modal -->
		<div class="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 animate-slide-up">
			<div class="p-5">
				<h3 class="text-sm font-semibold text-zinc-300 mb-4">Add collaborator</h3>

				<!-- Search input -->
				<div class="relative">
					<input
						type="text"
						bind:this={inputEl}
						bind:value={inputValue}
						oninput={handleInput}
						placeholder="npub, NIP-05 (user@domain.com), or hex pubkey"
						class="input text-sm pr-10"
					/>
					{#if resolving}
						<div class="absolute right-3 top-1/2 -translate-y-1/2">
							<svg class="w-4 h-4 animate-spin text-zinc-500" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
						</div>
					{/if}
				</div>

				<!-- Result preview -->
				<div class="mt-3 min-h-[60px]">
					{#if result?.ok}
						<div class="flex items-center justify-between gap-3 bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3">
							<User.Root {ndk} pubkey={result.user.pubkey}>
								<div class="flex items-center gap-3 min-w-0">
									<User.Avatar class="w-9 h-9 text-xs font-medium shrink-0" />
									<div class="min-w-0">
										<User.Name class="text-sm text-zinc-200 truncate block" />
										<User.Nip05 class="text-xs text-zinc-500 truncate block" showVerified={false} />
									</div>
								</div>
							</User.Root>

							{#if isDuplicate}
								<span class="text-xs text-amber-400 shrink-0">Already added</span>
							{:else}
								<button
									onclick={handleAdd}
									class="btn-primary text-xs px-3 py-1.5 shrink-0"
								>
									Add
								</button>
							{/if}
						</div>
					{:else if result && !result.ok}
						<div class="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
							{result.error.message}
						</div>
					{:else if resolving && inputValue.trim()}
						<p class="text-xs text-zinc-600 px-1">Resolving…</p>
					{/if}
				</div>
			</div>

			<!-- Footer -->
			<div class="border-t border-zinc-800 px-5 py-3 flex justify-end">
				<button onclick={handleClose} class="btn-ghost text-sm">
					Done
				</button>
			</div>
		</div>
	</div>
{/if}
