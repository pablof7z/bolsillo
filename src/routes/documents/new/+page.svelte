<script lang="ts">
	import { goto } from '$app/navigation';
	import { ndk } from '$lib/ndk';
	import { createDocument } from '$lib/documents.svelte';

	let title = $state('');
	let content = $state('');
	let authorsInput = $state('');
	let showAuthors = $state(false);
	let loading = $state(false);
	let error = $state('');
	let skippedWarning = $state('');

	$effect(() => {
		if (!ndk.$currentPubkey) {
			goto('/login');
		}
	});

	async function handleCreate(e: Event) {
		e.preventDefault();

		if (!title.trim()) {
			error = 'Please enter a title';
			return;
		}

		loading = true;
		error = '';
		skippedWarning = '';

		try {
			const additionalAuthors = authorsInput
				.split('\n')
				.map((a) => a.trim())
				.filter(Boolean);

			const result = await createDocument(title.trim(), content, additionalAuthors);

			if (result.skippedAuthors.length > 0) {
				// Brief delay so the user can see the warning before navigating
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

			<button
				type="submit"
				form="create-form"
				disabled={loading || !title.trim()}
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
					Create document
				{/if}
			</button>
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

			<form id="create-form" onsubmit={handleCreate} class="space-y-6">
				<!-- Title -->
				<div>
					<label for="title" class="block text-sm font-medium text-zinc-400 mb-2">Title</label>
					<input
						id="title"
						type="text"
						bind:value={title}
						placeholder="Untitled document"
						class="input text-lg"
						disabled={loading}
						autofocus
					/>
				</div>

				<!-- Content -->
				<div>
					<label for="content" class="block text-sm font-medium text-zinc-400 mb-2">
						Content
						<span class="text-zinc-600 font-normal ml-1">— Markdown supported</span>
					</label>
					<textarea
						id="content"
						bind:value={content}
						placeholder="Start writing…"
						rows={16}
						class="input font-mono text-sm leading-relaxed resize-none"
						disabled={loading}
					></textarea>
				</div>

				<!-- Additional Authors -->
				<div>
					<button
						type="button"
						onclick={() => (showAuthors = !showAuthors)}
						class="text-sm text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
					>
						<svg
							class="w-3.5 h-3.5 transition-transform {showAuthors ? 'rotate-90' : ''}"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
						</svg>
						Add collaborators
					</button>

					{#if showAuthors}
						<div class="mt-3 animate-slide-up">
							<textarea
								bind:value={authorsInput}
								placeholder="One npub or hex pubkey per line&#10;npub1abc...&#10;npub1xyz..."
								rows={4}
								class="input font-mono text-sm"
								disabled={loading}
							></textarea>
							<p class="text-xs text-zinc-600 mt-2">
								These users will be authorized to edit this document.
							</p>
						</div>
					{/if}
				</div>
			</form>
		</div>
	</main>
</div>
