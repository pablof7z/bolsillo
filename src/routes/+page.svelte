<script lang="ts">
	import { NDKCollaborativeEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import { ndk } from '$lib/ndk';
	import { collabEventsToDocList } from '$lib/documents.svelte';
	import { logout } from '$lib/state.svelte';
	import { formatTimestamp } from '$lib/utils';

	const isLoggedIn = $derived(!!ndk.$currentPubkey);

	// Subscribe to ALL collab events
	const collabSub = ndk.$subscribe(() => ({
		filters: [{ kinds: [NDKKind.CollaborativeEvent as number] }],
		skipVerification: true
	}));


	// Subscribe to articles for title enrichment
	const articleSub = ndk.$subscribe(() => {
		if (collabSub.events.length === 0) return undefined;
		const authors = new Set<string>();
		const dTags = new Set<string>();
		for (const e of collabSub.events) {
			try {
				const c = NDKCollaborativeEvent.from(e);
				if (c.dTag) dTags.add(c.dTag);
				for (const pk of c.authorPubkeys) authors.add(pk);
			} catch {}
		}
		if (dTags.size === 0 || authors.size === 0) return undefined;
		return {
			filters: [{ kinds: [NDKKind.Article as number], authors: [...authors], '#d': [...dTags] }],
			skipVerification: true
		};
	});

	// All documents
	const allDocuments = $derived(collabEventsToDocList(collabSub.events, articleSub.events));

	// My documents (filtered client-side from the same subscription)
	const myDocuments = $derived.by(() => {
		const pubkey = ndk.$currentPubkey;
		if (!pubkey) return [];
		const myCollabEvents = collabSub.events.filter(
			(e) => e.pubkey === pubkey || e.getMatchingTags('p').some((t) => t[1] === pubkey)
		);
		return collabEventsToDocList(myCollabEvents, articleSub.events);
	});
</script>

<div class="min-h-screen">
	<!-- Header -->
	<header class="border-b border-zinc-800/60 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-10">
		<div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center">
					<span class="text-sm">📝</span>
				</div>
				<h1 class="text-lg font-semibold text-zinc-200 tracking-tight">Collabstr</h1>
			</div>

			<div class="flex items-center gap-3">
				{#if isLoggedIn}
					<a href="/documents" class="btn-ghost text-sm">My Documents</a>
					<a href="/documents/new" class="btn-primary text-sm flex items-center gap-2">
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
						New
					</a>
					<div class="h-5 w-px bg-zinc-800"></div>
					<button onclick={() => { logout(); }} class="btn-ghost text-sm">
						Sign out
					</button>
				{:else}
					<a href="/login" class="btn-primary text-sm">Sign in</a>
				{/if}
			</div>
		</div>
	</header>

	<main class="max-w-5xl mx-auto px-6 py-8">
		<!-- My Documents (logged-in only) -->
		{#if isLoggedIn}
			<section class="mb-12">
				<h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">My Documents</h2>

				{#if myDocuments.length > 0}
					<div class="grid gap-3">
						{#each myDocuments as doc (doc.naddr)}
							<a
								href="/documents/{encodeURIComponent(doc.naddr)}"
								class="card-interactive group p-5 block"
							>
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0 flex-1">
										<h3 class="text-base font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
											{doc.title}
										</h3>
										<div class="flex items-center gap-3 mt-2 text-xs text-zinc-500">
											<span>{formatTimestamp(doc.updatedAt)}</span>
											<span class="text-zinc-700">·</span>
											<span class="inline-flex items-center gap-1">
												<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
												</svg>
												{doc.authorCount} author{doc.authorCount !== 1 ? 's' : ''}
											</span>
										</div>
									</div>
									<svg class="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
									</svg>
								</div>
							</a>
						{/each}
					</div>
				{:else if !collabSub.eosed}
					<div class="flex items-center gap-3 py-8 justify-center">
						<div class="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
						<span class="text-zinc-500 text-sm">Loading your documents…</span>
					</div>
				{:else}
					<div class="card p-6 text-center">
						<p class="text-zinc-500 text-sm mb-3">You don't have any documents yet.</p>
						<a href="/documents/new" class="btn-primary text-sm inline-flex items-center gap-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
							Create document
						</a>
					</div>
				{/if}
			</section>
		{/if}

		<!-- All Documents (public) -->
		<section>
			<h2 class="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-4">All Documents</h2>

			{#if allDocuments.length > 0}
				<div class="grid gap-3 animate-fade-in">
					{#each allDocuments as doc (doc.naddr)}
						<a
							href="/documents/{encodeURIComponent(doc.naddr)}"
							class="card-interactive group p-5 block"
						>
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0 flex-1">
									<h3 class="text-base font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
										{doc.title}
									</h3>
									<div class="flex items-center gap-3 mt-2 text-xs text-zinc-500">
										<span>{formatTimestamp(doc.updatedAt)}</span>
										<span class="text-zinc-700">·</span>
										<span class="inline-flex items-center gap-1">
											<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
											</svg>
											{doc.authorCount} author{doc.authorCount !== 1 ? 's' : ''}
										</span>
									</div>
								</div>
								<svg class="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
								</svg>
							</div>
						</a>
					{/each}
				</div>
			{:else if !collabSub.eosed}
				<div class="flex items-center gap-3 py-8 justify-center">
					<div class="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin"></div>
					<span class="text-zinc-500 text-sm">Discovering documents on relays…</span>
				</div>
			{:else}
				<div class="text-center py-16">
					<div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 mb-6">
						<svg class="w-7 h-7 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
						</svg>
					</div>
					<h2 class="text-lg font-medium text-zinc-300 mb-2">No documents found</h2>
					<p class="text-zinc-500 text-sm">No collaborative documents have been published to relays yet.</p>
				</div>
			{/if}
		</section>

		<!-- Footer -->
		<div class="mt-16 pb-8 text-center">
			<p class="text-xs text-zinc-700">
				Powered by <a href="https://github.com/nostr-dev-kit/ndk" target="_blank" rel="noopener" class="text-zinc-500 hover:text-zinc-300 transition-colors">NDK</a> &
				<a href="https://nostr.com" target="_blank" rel="noopener" class="text-zinc-500 hover:text-zinc-300 transition-colors">Nostr</a>
			</p>
		</div>
	</main>
</div>
