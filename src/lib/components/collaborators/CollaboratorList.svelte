<script lang="ts">
	import { ndk } from '$lib/ndk';
	import { User } from '$lib/components/ui';
	import CollaboratorSearch from './CollaboratorSearch.svelte';

	interface Props {
		/** Hex pubkeys of added collaborators (not including the current user) */
		pubkeys: string[];
		onUpdate: (pubkeys: string[]) => void;
		disabled?: boolean;
	}

	let { pubkeys, onUpdate, disabled = false }: Props = $props();

	let showSearch = $state(false);

	const allPubkeys = $derived(
		ndk.$currentPubkey ? [ndk.$currentPubkey, ...pubkeys] : pubkeys
	);

	function addCollaborator(pubkey: string) {
		if (pubkey === ndk.$currentPubkey) return;
		if (pubkeys.includes(pubkey)) return;
		onUpdate([...pubkeys, pubkey]);
	}

	function removeCollaborator(pubkey: string) {
		onUpdate(pubkeys.filter((p) => p !== pubkey));
	}
</script>

<div>
	<span class="block text-sm font-medium text-zinc-400 mb-3">Collaborators</span>

	<div class="space-y-2">
		<!-- Current user (always shown, not removable) -->
		{#if ndk.$currentPubkey}
			<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/30 border border-zinc-800/40">
				<User.Root {ndk} pubkey={ndk.$currentPubkey}>
					<User.Avatar class="w-8 h-8 text-[10px] font-medium shrink-0" />
					<div class="flex items-center gap-2 min-w-0 flex-1">
						<User.Name class="text-sm text-zinc-300 truncate" />
						<span class="text-[10px] text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">you</span>
					</div>
				</User.Root>
			</div>
		{/if}

		<!-- Added collaborators -->
		{#each pubkeys as pubkey (pubkey)}
			<div class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-800/30 border border-zinc-800/40 group animate-fade-in">
				<User.Root {ndk} {pubkey}>
					<User.Avatar class="w-8 h-8 text-[10px] font-medium shrink-0" />
					<div class="min-w-0 flex-1">
						<User.Name class="text-sm text-zinc-300 truncate block" />
						<User.Nip05 class="text-xs text-zinc-500 truncate block" showVerified={false} />
					</div>
				</User.Root>

				{#if !disabled}
					<button
						type="button"
						onclick={() => removeCollaborator(pubkey)}
						class="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1 rounded-lg hover:bg-red-500/10 shrink-0"
						aria-label="Remove collaborator"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				{/if}
			</div>
		{/each}

		<!-- Add button -->
		{#if !disabled}
			<button
				type="button"
				onclick={() => (showSearch = true)}
				class="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-dashed border-zinc-700/60 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-all"
			>
				<div class="w-8 h-8 rounded-full bg-zinc-800/50 flex items-center justify-center shrink-0">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
					</svg>
				</div>
				<span class="text-sm">Add collaborator</span>
			</button>
		{/if}
	</div>

	<p class="text-xs text-zinc-600 mt-2">
		Collaborators can edit this document.
	</p>
</div>

<CollaboratorSearch
	open={showSearch}
	existingPubkeys={allPubkeys}
	onAdd={addCollaborator}
	onClose={() => (showSearch = false)}
/>
