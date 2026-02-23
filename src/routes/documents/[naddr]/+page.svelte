<script lang="ts">
	import { page } from '$app/state';
	import { NDKCollaborativeEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import { nip19 } from 'nostr-tools';
	import { ndk } from '$lib/ndk';
	import { eventToVersion, publishUpdate, type DocVersion } from '$lib/documents.svelte';
	import { formatDate, formatTimestamp } from '$lib/utils';
	import { User } from '$lib/components/ui';

	let editTitle = $state('');
	let editContent = $state('');
	let isEditing = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');
	let showVersions = $state(false);
	let selectedVersionIdx = $state(0);


	// Reset editing state when naddr changes
	$effect(() => {
		page.params.naddr; // track dependency
		selectedVersionIdx = 0;
		isEditing = false;
		saveError = '';
	});

	// Parse the naddr from the route params
	const decoded = $derived.by(() => {
		const raw = page.params.naddr;
		if (!raw) return null;
		try {
			const result = nip19.decode(decodeURIComponent(raw));
			if (result.type === 'naddr') return result.data as nip19.AddressPointer;
		} catch {}
		return null;
	});

	// Subscribe to the collaborative pointer event
	const collabSub = ndk.$subscribe(() => {
		if (!decoded) return undefined;
		return {
			filters: [{ kinds: [decoded.kind], authors: [decoded.pubkey], '#d': [decoded.identifier] }],
			skipVerification: true
		};
	});

	// Extract the newest collab event
	const collabEvent = $derived.by(() => {
		if (collabSub.events.length === 0) return null;
		return collabSub.events.reduce((a, b) =>
			(a.created_at || 0) > (b.created_at || 0) ? a : b
		);
	});

	const collab = $derived(collabEvent ? NDKCollaborativeEvent.from(collabEvent) : null);
	const authorPubkeys = $derived(collab?.authorPubkeys ?? []);

	// Subscribe to article versions for this document
	const articleSub = ndk.$subscribe(() => {
		if (!collab?.dTag || authorPubkeys.length === 0) return undefined;
		return {
			filters: [{ kinds: [NDKKind.Article as number], authors: [...authorPubkeys], '#d': [collab.dTag] }],
			skipVerification: true
		};
	});

	// Compute sorted versions from article events
	const versions: DocVersion[] = $derived.by(() => {
		const result: DocVersion[] = [];
		for (const event of articleSub.events) {
			const v = eventToVersion(event);
			if (v) result.push(v);
		}
		result.sort((a, b) => b.timestamp - a.timestamp);
		return result;
	});

	const currentVersion = $derived(versions[0] ?? null);
	const displayVersion = $derived(versions[selectedVersionIdx] ?? currentVersion);
	const isAuthor = $derived(
		ndk.$currentPubkey != null && authorPubkeys.includes(ndk.$currentPubkey)
	);
	const isLive = $derived(collabSub.eosed && collab !== null);

	function startEditing() {
		editTitle = currentVersion?.title ?? '';
		editContent = currentVersion?.content ?? '';
		isEditing = true;
		saveError = '';
	}

	function cancelEditing() {
		isEditing = false;
		saveError = '';
	}

	async function saveChanges() {
		if (!editTitle.trim()) {
			saveError = 'Title cannot be empty';
			return;
		}
		if (!collab) {
			saveError = 'Document not loaded';
			return;
		}

		isSaving = true;
		saveError = '';

		try {
			await publishUpdate(collab, editTitle.trim(), editContent);
			isEditing = false;
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="min-h-screen flex flex-col">
	<!-- Header -->
	<header class="border-b border-zinc-800/60 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-10">
		<div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
			<a href="/documents" class="btn-ghost text-sm inline-flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
				</svg>
				Documents
			</a>

			<div class="flex items-center gap-3">
				{#if isLive}
					<span class="inline-flex items-center gap-1.5 text-xs text-emerald-400">
						<span class="relative flex h-2 w-2">
							<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
							<span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
						</span>
						Live
					</span>
				{/if}

				{#if !isEditing && isAuthor}
					<button onclick={startEditing} class="btn-primary text-sm inline-flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
						</svg>
						Edit
					</button>
				{/if}

				{#if isEditing}
					<button onclick={cancelEditing} class="btn-ghost text-sm" disabled={isSaving}>
						Cancel
					</button>
					<button onclick={saveChanges} class="btn-primary text-sm" disabled={isSaving}>
						{#if isSaving}
							<span class="inline-flex items-center gap-2">
								<svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
								</svg>
								Saving…
							</span>
						{:else}
							Publish update
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</header>

	{#if !collabSub.eosed && !collab}
		<div class="flex-1 flex items-center justify-center animate-fade-in">
			<div class="flex flex-col items-center gap-4">
				<div class="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
				<p class="text-zinc-500 text-sm">Loading document…</p>
			</div>
		</div>
	{:else if collabSub.eosed && !collab}
		<div class="flex-1 flex items-center justify-center animate-fade-in">
			<div class="text-center">
				<div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 mb-4">
					<svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
					</svg>
				</div>
				<p class="text-red-400 mb-2">Document not found</p>
				<a href="/documents" class="btn-ghost text-sm">Back to documents</a>
			</div>
		</div>
	{:else}
		<div class="flex-1 flex">
			<!-- Main Content -->
			<main class="flex-1 max-w-4xl mx-auto px-6 py-10 w-full">
				<div class="animate-fade-in">
					{#if saveError}
						<div class="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm mb-6 animate-fade-in">
							{saveError}
						</div>
					{/if}

					{#if isEditing}
						<div class="space-y-6">
							<input
								type="text"
								bind:value={editTitle}
								class="w-full bg-transparent text-3xl font-semibold text-zinc-100 tracking-tight placeholder:text-zinc-700 focus:outline-none border-b border-zinc-800 pb-4"
								placeholder="Document title"
								disabled={isSaving}
							/>
							<textarea
								bind:value={editContent}
								class="w-full min-h-[60vh] bg-transparent text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-zinc-700"
								placeholder="Start writing…"
								disabled={isSaving}
							></textarea>
						</div>
					{:else}
						<div>
							<h1 class="text-3xl font-semibold text-zinc-100 tracking-tight mb-4">
								{displayVersion?.title || 'Untitled'}
							</h1>

							<div class="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-800/60">
								<div class="flex items-center -space-x-2">
									{#each authorPubkeys as pubkey}
										<User.Root {ndk} {pubkey}>
											<User.Avatar class="w-7 h-7 border-2 border-zinc-950 text-[10px] font-medium" />
										</User.Root>
									{/each}
								</div>

								<span class="text-xs text-zinc-500">
									{authorPubkeys.length} author{authorPubkeys.length !== 1 ? 's' : ''}
								</span>

								{#if displayVersion}
									<span class="text-zinc-700">·</span>
									<span class="text-xs text-zinc-500">
										Updated {formatTimestamp(displayVersion.timestamp)}
									</span>
								{/if}

								{#if !isAuthor}
									<span class="text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded">
										Read only
									</span>
								{/if}
							</div>

							{#if displayVersion?.content}
								<div class="prose-content font-mono text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
									{displayVersion.content}
								</div>
							{:else}
								<p class="text-zinc-600 italic">No content yet. Click Edit to add content.</p>
							{/if}
						</div>
					{/if}
				</div>
			</main>

			<!-- Sidebar: Version History -->
			<aside class="w-80 border-l border-zinc-800/60 bg-zinc-900/30 hidden lg:block overflow-y-auto">
				<div class="p-5">
					<h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
						Version History
					</h3>

					{#if versions.length === 0}
						<p class="text-xs text-zinc-600">No versions yet.</p>
					{:else}
						<div class="space-y-1">
							{#each versions as version, idx (version.eventId)}
								<button
									onclick={() => (selectedVersionIdx = idx)}
									class="w-full text-left px-3 py-3 rounded-lg transition-all duration-150 {selectedVersionIdx === idx
										? 'bg-zinc-800/80 border border-zinc-700/50'
										: 'hover:bg-zinc-800/40 border border-transparent'}"
								>
									<div class="flex items-center gap-2 mb-1">
										<User.Root {ndk} pubkey={version.author}>
											<User.Avatar class="w-5 h-5 text-[8px]" />
											<User.Name class="text-xs text-zinc-400 truncate" />
										</User.Root>
									</div>
									<div class="text-xs text-zinc-600 ml-4.5">
										{formatDate(version.timestamp)}
									</div>
									{#if idx === 0}
										<div class="mt-1.5 ml-4.5">
											<span class="text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded">
												Latest
											</span>
										</div>
									{/if}
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</aside>
		</div>

		<!-- Mobile version toggle -->
		<div class="lg:hidden fixed bottom-6 right-6">
			<button
				onclick={() => (showVersions = !showVersions)}
				class="bg-zinc-800 border border-zinc-700 text-zinc-300 w-12 h-12 rounded-full shadow-xl flex items-center justify-center hover:bg-zinc-700 transition-colors"
				aria-label="Toggle version history"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
				</svg>
			</button>
		</div>

		<!-- Mobile versions drawer -->
		{#if showVersions}
			<div class="lg:hidden fixed inset-0 z-50 animate-fade-in">
				<button class="absolute inset-0 bg-black/60" onclick={() => (showVersions = false)} aria-label="Close version history"></button>

				<div class="absolute bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up">
					<div class="p-5">
						<div class="flex items-center justify-between mb-4">
							<h3 class="text-sm font-semibold text-zinc-300">Version History</h3>
							<button onclick={() => (showVersions = false)} class="text-zinc-500 hover:text-zinc-300" aria-label="Close">
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						{#if versions.length === 0}
							<p class="text-xs text-zinc-600">No versions yet.</p>
						{:else}
							<div class="space-y-1">
								{#each versions as version, idx (version.eventId)}
									<button
										onclick={() => {
											selectedVersionIdx = idx;
											showVersions = false;
										}}
										class="w-full text-left px-3 py-3 rounded-lg transition-all {selectedVersionIdx === idx
											? 'bg-zinc-800 border border-zinc-700/50'
											: 'hover:bg-zinc-800/40 border border-transparent'}"
									>
										<div class="flex items-center gap-2 mb-1">
											<User.Root {ndk} pubkey={version.author}>
												<User.Avatar class="w-5 h-5 text-[8px]" />
												<User.Name class="text-xs text-zinc-400 truncate" />
											</User.Root>
										</div>
										<div class="text-xs text-zinc-600 ml-4.5">
											{formatDate(version.timestamp)}
										</div>
										{#if idx === 0}
											<span class="text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-4.5 mt-1 inline-block">
												Latest
											</span>
										{/if}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
