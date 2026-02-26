<script lang="ts">
	import { page } from '$app/state';
	import { NDKCollaborativeEvent, NDKKind } from '@nostr-dev-kit/ndk';
	import NDKBlossom from '@nostr-dev-kit/blossom';
	import { nip19 } from 'nostr-tools';
	import { ndk } from '$lib/ndk';
	import { eventToVersion, publishUpdate, type DocVersion } from '$lib/documents.svelte';
	import { formatDate, formatTimestamp } from '$lib/utils';
	import { getAdapter, type KindAdapter } from '$lib/adapters';
	import { User } from '$lib/components/ui';
	import MarkdownContent from '$lib/components/MarkdownContent.svelte';

	let editFields = $state<Record<string, string>>({});
	let isEditing = $state(false);
	let isSaving = $state(false);
	let saveError = $state('');
	let showVersions = $state(false);
	let selectedVersionIdx = $state(0);
	let copySuccess = $state(false);
	let imageUploading = $state(false);

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
			filters: [{ kinds: [decoded.kind], authors: [decoded.pubkey], '#d': [decoded.identifier] }]
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
	const targetKind = $derived(collab?.targetKind ?? NDKKind.Article);
	const adapter: KindAdapter = $derived(getAdapter(targetKind));

	// Subscribe to target event versions for this document
	const targetSub = ndk.$subscribe(() => {
		if (!collab?.dTag || authorPubkeys.length === 0) return undefined;
		return {
			filters: [{ kinds: [targetKind as number], authors: [...authorPubkeys], '#d': [collab.dTag] }]
		};
	});

	// Compute sorted versions from target events
	const versions: DocVersion[] = $derived.by(() => {
		const result: DocVersion[] = [];
		for (const event of targetSub.events) {
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

	/**
	 * The address string used as the backlink a-tag value on target events.
	 * Every version published through this app includes `['a', pointerAddr]`.
	 */
	const pointerAddr = $derived(
		collab ? `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}` : ''
	);

	/**
	 * Pubkeys of collaborators who have actually published a version that
	 * back-references the pointer event — i.e. confirmed co-authors.
	 */
	const confirmedPubkeys = $derived.by(() => {
		if (!pointerAddr) return new Set<string>();
		const confirmed = new Set<string>();
		for (const event of targetSub.events) {
			const hasBacklink = event.tags.some((t) => t[0] === 'a' && t[1] === pointerAddr);
			if (hasBacklink) confirmed.add(event.pubkey);
		}
		return confirmed;
	});

	/** Collaborators who have been invited but not yet contributed a version. */
	const pendingPubkeys = $derived(authorPubkeys.filter((pk) => !confirmedPubkeys.has(pk)));

	/** Kinds whose content should be rendered as markdown rather than plain text. */
	const MARKDOWN_KINDS = new Set([NDKKind.Article, NDKKind.Wiki, 3023]);
	const isMarkdownKind = $derived(MARKDOWN_KINDS.has(targetKind));

	/** Tags that are managed automatically and should not appear in the extra-tags editor. */
	const SYSTEM_TAG_NAMES = new Set(['d', 'a', 'title', 'published_at', 'summary', 'image']);

	/** The actual NDKEvent backing the latest version, used for encoding the naddr. */
	const latestEvent = $derived(
		currentVersion ? targetSub.events.find((e) => e.id === currentVersion.eventId) ?? null : null
	);

	async function copyNaddr() {
		if (!latestEvent) return;
		try {
			const encoded = latestEvent.encode();
			await navigator.clipboard.writeText(encoded);
			copySuccess = true;
			setTimeout(() => (copySuccess = false), 2000);
		} catch {
			// Fallback: if clipboard API fails, do nothing
		}
	}

	function startEditing() {
		// Find the actual NDKEvent backing the current version so we can
		// read its tags (DocVersion only stores title + content).
		const latestEvent = currentVersion
			? targetSub.events.find((e) => e.id === currentVersion.eventId)
			: undefined;

		const fields: Record<string, string> = {};
		for (const field of adapter.editorFields) {
			if (field.key === 'title') {
				fields.title = currentVersion?.title ?? '';
			} else if (field.key === 'content') {
				fields.content = currentVersion?.content ?? '';
			} else if (field.key === 'tags' && latestEvent) {
				// Prefill custom tags from the existing event so edits
				// don't silently drop them (fixes tag-merge issue).
				const customTags = latestEvent.tags.filter(
					(t) => !SYSTEM_TAG_NAMES.has(t[0])
				);
				fields.tags = customTags.length > 0 ? JSON.stringify(customTags) : '';
			} else {
				// For any other field (e.g. summary, image), read from the event's tags by key name.
				fields[field.key] = latestEvent?.tagValue(field.key) ?? '';
			}
		}
		editFields = fields;
		isEditing = true;
		saveError = '';
	}

	async function uploadImage(fieldKey: string, e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		imageUploading = true;
		saveError = '';
		try {
			const blossom = new NDKBlossom(ndk);
			const imeta = await blossom.upload(file);
			if (imeta.url) {
				editFields[fieldKey] = imeta.url;
			}
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Image upload failed';
		} finally {
			imageUploading = false;
			// Reset file input so the same file can be re-selected if needed
			input.value = '';
		}
	}

	function cancelEditing() {
		isEditing = false;
		saveError = '';
	}

	async function saveChanges() {
		// Validate required fields
		for (const field of adapter.editorFields) {
			if (field.required && !editFields[field.key]?.trim()) {
				saveError = `${field.label} cannot be empty`;
				return;
			}
		}
		if (!collab) {
			saveError = 'Document not loaded';
			return;
		}

		isSaving = true;
		saveError = '';

		try {
			await publishUpdate(collab, editFields);
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
			<div class="flex items-center gap-3">
				<a href="/documents" class="btn-ghost text-sm inline-flex items-center gap-2">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 19.5L8.25 12l7.5-7.5" />
					</svg>
					Documents
				</a>

				{#if collab}
					<span class="text-[10px] font-medium text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
						<span>{adapter.icon}</span>
						{adapter.label}
					</span>
				{/if}

				{#if versions.length > 1}
					<span class="text-[10px] font-medium text-indigo-400/80 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
						{versions.length} versions
					</span>
				{/if}
			</div>

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

				{#if !isEditing && latestEvent}
					<button onclick={copyNaddr} class="btn-ghost text-sm inline-flex items-center gap-2" title="Copy naddr">
						{#if copySuccess}
							<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.5 12.75l6 6 9-13.5" />
							</svg>
							<span class="text-emerald-400">Copied!</span>
						{:else}
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
							</svg>
							Copy naddr
						{/if}
					</button>
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
							{#each adapter.editorFields as field (field.key)}
								{#if field.type === 'text'}
									<div>
										<label for="edit-{field.key}" class="block text-sm font-medium text-zinc-400 mb-2">{field.label}</label>
										<input
											id="edit-{field.key}"
											type="text"
											bind:value={editFields[field.key]}
											class="w-full bg-transparent text-xl font-semibold text-zinc-100 tracking-tight placeholder:text-zinc-700 focus:outline-none border-b border-zinc-800 pb-4"
											placeholder={field.placeholder}
											disabled={isSaving}
										/>
									</div>
								{:else if field.type === 'image'}
									<div>
										<label for="edit-{field.key}" class="block text-sm font-medium text-zinc-400 mb-2">{field.label}</label>
										<div class="flex gap-2 items-center">
											<input
												id="edit-{field.key}"
												type="text"
												bind:value={editFields[field.key]}
												class="flex-1 bg-transparent text-sm text-zinc-300 placeholder:text-zinc-700 focus:outline-none border-b border-zinc-800 pb-2"
												placeholder={field.placeholder}
												disabled={isSaving || imageUploading}
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
													disabled={isSaving || imageUploading}
													onchange={(e) => uploadImage(field.key, e)}
												/>
											</label>
										</div>
										{#if editFields[field.key]}
											<img src={editFields[field.key]} alt="Preview" class="mt-3 max-h-40 rounded-lg object-cover border border-zinc-800" />
										{/if}
									</div>
								{:else if field.type === 'textarea'}
									<div>
										<label for="edit-{field.key}" class="block text-sm font-medium text-zinc-400 mb-2">
											{field.label}
										</label>
										<textarea
											id="edit-{field.key}"
											bind:value={editFields[field.key]}
											class="w-full min-h-[60vh] bg-transparent text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-zinc-700"
											placeholder={field.placeholder}
											disabled={isSaving}
										></textarea>
									</div>
								{:else if field.type === 'json'}
									<div>
										<label for="edit-{field.key}" class="block text-sm font-medium text-zinc-400 mb-2">
											{field.label}
										</label>
										<textarea
											id="edit-{field.key}"
											bind:value={editFields[field.key]}
											class="w-full min-h-[12vh] bg-transparent text-zinc-300 font-mono text-sm leading-relaxed resize-none focus:outline-none placeholder:text-zinc-700"
											placeholder={field.placeholder}
											disabled={isSaving}
										></textarea>
									</div>
								{/if}
							{/each}
						</div>
					{:else}
						<div>
							<h1 class="text-3xl font-semibold text-zinc-100 tracking-tight mb-4">
								{displayVersion?.title || 'Untitled'}
							</h1>

							<div class="flex items-center gap-4 mb-8 pb-6 border-b border-zinc-800/60">
								<div class="flex items-center -space-x-2">
									{#each authorPubkeys as pubkey}
										{@const isPending = !confirmedPubkeys.has(pubkey)}
										<div class="relative" title={isPending ? 'Invite pending' : 'Author'}>
											<User.Root {ndk} {pubkey}>
												<User.Avatar
													class="w-7 h-7 border-2 text-[10px] font-medium {isPending
														? 'border-amber-500/50 opacity-50 grayscale'
														: 'border-zinc-950'}"
												/>
											</User.Root>
											{#if isPending}
												<span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full border border-zinc-950 flex items-center justify-center z-10 pointer-events-none">
													<svg class="w-2 h-2 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
														<circle cx="12" cy="12" r="10" />
														<polyline points="12 6 12 12 16 14" />
													</svg>
												</span>
											{/if}
										</div>
									{/each}
								</div>

								<span class="text-xs text-zinc-500">
									{confirmedPubkeys.size} author{confirmedPubkeys.size !== 1 ? 's' : ''}
									{#if pendingPubkeys.length > 0}
										<span class="text-amber-400/70">· {pendingPubkeys.length} invite{pendingPubkeys.length !== 1 ? 's' : ''} pending</span>
									{/if}
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
								{#if isMarkdownKind}
									<MarkdownContent content={displayVersion.content} />
								{:else}
									<div class="prose-content font-mono text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
										{displayVersion.content}
									</div>
								{/if}
							{:else}
								<p class="text-zinc-600 italic">No content yet. Click Edit to add content.</p>
							{/if}
						</div>
					{/if}
				</div>
			</main>

			<!-- Sidebar: Version History -->
			<aside class="w-80 border-l border-zinc-800/60 bg-zinc-900/30 hidden lg:block overflow-y-auto">
				<!-- Contributors -->
				<div class="p-5 border-b border-zinc-800/60">
					<h3 class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
						Contributors
					</h3>
					<div class="space-y-2">
						{#each authorPubkeys as pubkey (pubkey)}
							{@const confirmed = confirmedPubkeys.has(pubkey)}
							<div class="flex items-center gap-2 px-1">
								<User.Root {ndk} {pubkey}>
									<div class="relative shrink-0">
										<User.Avatar class="w-6 h-6 text-[8px] {confirmed ? '' : 'opacity-50 grayscale'}" />
										{#if !confirmed}
											<span class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border border-zinc-900 flex items-center justify-center pointer-events-none">
												<svg class="w-1.5 h-1.5 text-zinc-950" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="3">
													<circle cx="12" cy="12" r="10" />
													<polyline points="12 6 12 12 16 14" />
												</svg>
											</span>
										{/if}
									</div>
									<User.Name class="text-xs {confirmed ? 'text-zinc-400' : 'text-zinc-500'} truncate flex-1 min-w-0" />
								</User.Root>
								{#if confirmed}
									<span class="text-[10px] font-medium text-emerald-400/80 bg-emerald-500/10 px-1.5 py-0.5 rounded shrink-0">
										author
									</span>
								{:else}
									<span class="text-[10px] font-medium text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded shrink-0">
										pending
									</span>
								{/if}
							</div>
						{/each}
					</div>
				</div>

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
