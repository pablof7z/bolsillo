<script lang="ts">
	import { goto } from '$app/navigation';
	import { untrack } from 'svelte';
	import { NDKKind } from '@nostr-dev-kit/ndk';
	import NDKBlossom from '@nostr-dev-kit/blossom';
	import { ndk } from '$lib/ndk';
	import { createDocument } from '$lib/documents.svelte';
	import { getAdapter, type KindAdapter } from '$lib/adapters';
	import { SUGGESTED_KINDS, isReplaceableKind, isEphemeralKind } from '$lib/kind-labels';
	import CollaboratorList from '$lib/components/collaborators/CollaboratorList.svelte';
	import RelaySelector from '$lib/components/RelaySelector.svelte';

	let selectedKind = $state(NDKKind.Article as number);
	let customKind = $state('');
	let showCustomKind = $state(false);
	let fields = $state<Record<string, string>>({});
	let collaboratorPubkeys = $state<string[]>([]);
	let loading = $state(false);
	let error = $state('');
	let skippedWarning = $state('');
	let imageUploading = $state(false);

	async function uploadImage(fieldKey: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		imageUploading = true;
		error = '';
		try {
			const blossom = new NDKBlossom(ndk);
			const imeta = await blossom.upload(file);
			if (imeta.url) {
				fields[fieldKey] = imeta.url;
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Image upload failed';
		} finally {
			imageUploading = false;
			input.value = '';
		}
	}

	const adapter: KindAdapter = $derived(getAdapter(selectedKind));

	/** Warning text shown when the user picks a problematic kind range */
	const kindWarning = $derived.by(() => {
		if (isEphemeralKind(selectedKind)) {
			return 'Ephemeral events (20000–29999) are not persisted by relays. Collaborative documents require persistence — this kind will likely not work.';
		}
		if (isReplaceableKind(selectedKind)) {
			return 'Replaceable events (10000–19999) share a single slot per author+kind. Every edit will overwrite ALL documents of this kind by the same author.';
		}
		return '';
	});

	// Reset fields when the adapter (i.e. selectedKind) changes.
	// Use untrack to read `fields` without creating a self-dependency.
	$effect(() => {
		const currentFields = adapter.editorFields;
		const prev = untrack(() => fields);
		const newFields: Record<string, string> = {};
		for (const field of currentFields) {
			newFields[field.key] = prev[field.key] ?? '';
		}
		fields = newFields;
	});

	$effect(() => {
		if (!ndk.$currentPubkey) {
			goto('/login');
		}
	});

	function selectKind(kind: number) {
		selectedKind = kind;
		showCustomKind = false;
	}

	function applyCustomKind() {
		const n = parseInt(customKind, 10);
		if (!isNaN(n) && n >= 0) {
			selectedKind = n;
		}
	}

	async function handleCreate(e: Event) {
		e.preventDefault();

		// Validate required fields
		for (const field of adapter.editorFields) {
			if (field.required && !fields[field.key]?.trim()) {
				error = `Please enter a ${field.label.toLowerCase()}`;
				return;
			}
		}

		loading = true;
		error = '';
		skippedWarning = '';

		try {
			const result = await createDocument(selectedKind, fields, collaboratorPubkeys);

			if (result.skippedAuthors.length > 0) {
				skippedWarning = `Skipped invalid collaborator${result.skippedAuthors.length > 1 ? 's' : ''}: ${result.skippedAuthors.join(', ')}`;
				await new Promise((r) => setTimeout(r, 2500));
			}

			goto(`/documents/${encodeURIComponent(result.naddr)}`);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to create document';
		} finally {
			loading = false;
		}
	}
</script>

<div class="min-h-screen">
	<!-- Header -->
	<header class="border-b border-zinc-800/60 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-10">
		<div class="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
			<a href="/documents" class="btn-ghost text-sm inline-flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
				Back
			</a>

			<div class="flex items-center gap-3">
				<RelaySelector />

				<button
					type="submit"
					form="create-form"
					disabled={loading}
					class="btn-primary text-sm"
				>
					{#if loading}
						<span class="inline-flex items-center gap-2">
							<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
							</svg>
							Publishing…
						</span>
					{:else}
						Create {adapter.label.toLowerCase()}
					{/if}
				</button>
			</div>
		</div>
	</header>

	<!-- Content -->
	<main class="max-w-3xl mx-auto px-6 py-10">
		<div class="animate-fade-in">
			<h1 class="text-2xl font-semibold text-zinc-100 mb-8 tracking-tight">New document</h1>

			{#if error}
				<div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm mb-6 animate-fade-in">
					{error}
				</div>
			{/if}

			{#if skippedWarning}
				<div class="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm mb-6 animate-fade-in">
					{skippedWarning}
				</div>
			{/if}

			<!-- Kind Picker -->
			<div class="mb-8">
				<label class="block text-sm font-medium text-zinc-400 mb-3">Event Kind</label>
				<div class="flex flex-wrap gap-2">
					{#each SUGGESTED_KINDS as sk (sk.kind)}
						<button
							type="button"
							onclick={() => selectKind(sk.kind)}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
								{selectedKind === sk.kind && !showCustomKind
									? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
									: 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'}"
						>
							<span>{sk.icon}</span>
							<span>{sk.label}</span>
							<span class="text-[10px] text-zinc-600">({sk.kind})</span>
						</button>
					{/each}

					<button
						type="button"
						onclick={() => { showCustomKind = !showCustomKind; }}
						class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all
							{showCustomKind
								? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
								: 'bg-zinc-800/50 border border-zinc-700/50 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600'}"
					>
						<span>🔢</span>
						<span>Custom</span>
					</button>
				</div>

				{#if showCustomKind}
					<div class="mt-3 flex items-center gap-2 animate-fade-in">
						<input
							type="number"
							bind:value={customKind}
							placeholder="Kind number (e.g. 1, 30023)"
							class="input font-mono text-sm w-48"
							min="0"
							oninput={applyCustomKind}
						/>
						<span class="text-xs text-zinc-500">
							{adapter.icon} {adapter.label}
						</span>
					</div>
				{/if}

				{#if kindWarning}
					<div class="mt-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 px-4 py-3 rounded-lg text-sm animate-fade-in">
						⚠️ {kindWarning}
					</div>
				{/if}
			</div>

			<form id="create-form" onsubmit={handleCreate} class="space-y-6">
				<!-- Dynamic editor fields from the adapter -->
				{#each adapter.editorFields as field (field.key)}
					<div>
						<label for="field-{field.key}" class="block text-sm font-medium text-zinc-400 mb-2">
							{field.label}
							{#if !field.required}
								<span class="text-zinc-600 font-normal ml-1">— optional</span>
							{/if}
						</label>

						{#if field.type === 'text'}
							<input
								id="field-{field.key}"
								type="text"
								bind:value={fields[field.key]}
								placeholder={field.placeholder}
								class="input text-lg"
								disabled={loading}
							/>
						{:else if field.type === 'image'}
							<div class="space-y-2">
								<div class="flex gap-2 items-center">
									<input
										id="field-{field.key}"
										type="text"
										bind:value={fields[field.key]}
										placeholder={field.placeholder}
										class="input text-sm flex-1"
										disabled={loading || imageUploading}
									/>
									<label class="btn-ghost text-sm cursor-pointer inline-flex items-center gap-1.5 shrink-0">
										{#if imageUploading}
											<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
											</svg>
											Uploading…
										{:else}
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
											</svg>
											Upload
										{/if}
										<input
											type="file"
											accept="image/*"
											class="sr-only"
											disabled={loading || imageUploading}
											onchange={(e) => uploadImage(field.key, e)}
										/>
									</label>
								</div>
								{#if fields[field.key]}
									<img src={fields[field.key]} alt="Preview" class="max-h-40 rounded-lg object-cover border border-zinc-800" />
								{/if}
							</div>
						{:else if field.type === 'textarea'}
							<textarea
								id="field-{field.key}"
								bind:value={fields[field.key]}
								placeholder={field.placeholder}
								rows={16}
								class="input font-mono text-sm leading-relaxed resize-none"
								disabled={loading}
							></textarea>
						{:else if field.type === 'json'}
							<textarea
								id="field-{field.key}"
								bind:value={fields[field.key]}
								placeholder={field.placeholder}
								rows={6}
								class="input font-mono text-sm leading-relaxed resize-none"
								disabled={loading}
							></textarea>
						{:else if field.type === 'number'}
							<input
								id="field-{field.key}"
								type="number"
								bind:value={fields[field.key]}
								placeholder={field.placeholder}
								class="input text-sm font-mono"
								disabled={loading}
							/>
						{/if}
					</div>
				{/each}

				<!-- Collaborators -->
				<CollaboratorList
					pubkeys={collaboratorPubkeys}
					onUpdate={(updated) => (collaboratorPubkeys = updated)}
					disabled={loading}
				/>
			</form>
		</div>
	</main>
</div>
