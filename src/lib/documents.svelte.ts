import {
	NDKCollaborativeEvent,
	NDKEvent,
	NDKKind
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { ndk } from './ndk';
import { getAdapter } from './adapters';
import { generateDocId } from './utils';

// ── Types ─────────────────────────────────────────────────────

export interface DocListItem {
	/** Composite identity: `pubkey:dTag` to avoid collisions across authors */
	id: string;
	title: string;
	authorCount: number;
	updatedAt: number;
	naddr: string;
	/** The target event kind */
	targetKind: number;
}

export interface DocVersion {
	eventId: string;
	author: string;
	title: string;
	content: string;
	timestamp: number;
}

// ── Doc list building ─────────────────────────────────────────

/**
 * Convert collab pointer events + target events into a sorted DocListItem array.
 * Pure function — no fetching.
 */
export function collabEventsToDocList(
	pointerEvents: NDKEvent[],
	targetEvents: NDKEvent[]
): DocListItem[] {
	// Build target lookup: dTag -> newest event
	const targetByDTag = new Map<string, NDKEvent>();
	for (const event of targetEvents) {
		const dTag = event.tagValue('d');
		if (!dTag) continue;
		const existing = targetByDTag.get(dTag);
		if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
			targetByDTag.set(dTag, event);
		}
	}

	// Deduplicate pointer events by pubkey:dTag (keep newest)
	const pointerByKey = new Map<string, NDKEvent>();
	for (const event of pointerEvents) {
		const dTag = event.tagValue('d');
		if (!dTag) continue;
		const key = `${event.pubkey}:${dTag}`;
		const existing = pointerByKey.get(key);
		if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
			pointerByKey.set(key, event);
		}
	}

	const docs: DocListItem[] = [];
	for (const [compositeKey, event] of pointerByKey) {
		const collab = NDKCollaborativeEvent.from(event);
		const dTag = collab.dTag || '';
		const targetKind = collab.targetKind ?? NDKKind.Article;
		const adapter = getAdapter(targetKind);

		const targetEvent = targetByDTag.get(dTag);
		let title = dTag;
		let updatedAt = event.created_at || 0;

		if (targetEvent) {
			title = adapter.getTitle(targetEvent);
			updatedAt = targetEvent.created_at || updatedAt;
		}

		docs.push({
			id: compositeKey,
			title,
			authorCount: collab.authorPubkeys.length || 1,
			updatedAt,
			naddr: collab.encode(),
			targetKind
		});
	}

	docs.sort((a, b) => b.updatedAt - a.updatedAt);
	return docs;
}

// ── Version helpers ───────────────────────────────────────────

/** Convert an NDKEvent to a DocVersion using the appropriate adapter */
export function eventToVersion(event: NDKEvent): DocVersion | null {
	try {
		if (event.kind == null) {
			// Intentionally silent in production.
			return null;
		}
		const adapter = getAdapter(event.kind);
		return {
			eventId: event.id || '',
			author: event.pubkey,
			title: adapter.getTitle(event),
			content: adapter.getContent(event),
			timestamp: event.created_at || 0
		};
	} catch (e) {
		// Intentionally silent in production.
		return null;
	}
}

// ── Publish ───────────────────────────────────────────────────

/** Publish an update to a collaborative document */
export async function publishUpdate(
	collab: NDKCollaborativeEvent,
	fields: Record<string, string>
): Promise<DocVersion> {
	const pubkey = ndk.$currentPubkey;
	if (!pubkey) throw new Error('Not authenticated');

	const isAuthor = collab.authorPubkeys.includes(pubkey);
	if (!isAuthor) throw new Error('You are not an authorized author of this document');

	const targetKind = collab.targetKind ?? NDKKind.Article;
	const adapter = getAdapter(targetKind);
	if (!adapter) {
		throw new Error(`No adapter available for kind ${targetKind}`);
	}
	const event = adapter.createEvent(ndk, collab.dTag || '', fields);

	// Add the back-reference to the pointer
	const pointerAddr = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}`;
	event.tags.push(['a', pointerAddr]);

	await adapter.publishEvent(event);

	return {
		eventId: event.id || '',
		author: pubkey,
		title: adapter.getTitle(event),
		content: adapter.getContent(event),
		timestamp: Math.floor(Date.now() / 1000)
	};
}

// ── Create ────────────────────────────────────────────────────

export interface CreateDocumentResult {
	naddr: string;
	skippedAuthors: string[];
}

/**
 * Create a new collaborative document of any kind.
 */
export async function createDocument(
	targetKind: number,
	fields: Record<string, string>,
	additionalAuthors: string[] = []
): Promise<CreateDocumentResult> {
	const pubkey = ndk.$currentPubkey;
	if (!pubkey) throw new Error('Not authenticated');

	const signer = ndk.signer!;
	const user = await signer.user();
	const dTag = generateDocId();

	// Build the collaborative pointer
	const collab = new NDKCollaborativeEvent(ndk);
	collab.dTag = dTag;
	collab.targetKind = targetKind;
	collab.authors.push(user);

	const skippedAuthors: string[] = [];
	for (const pubkeyOrNpub of additionalAuthors) {
		let pk = pubkeyOrNpub.trim();
		if (!pk) continue;
		try {
			if (pk.startsWith('npub1')) {
				const decoded = nip19.decode(pk);
				if (decoded.type === 'npub') pk = decoded.data as string;
			}
			if (!/^[0-9a-f]{64}$/i.test(pk)) {
				skippedAuthors.push(pubkeyOrNpub);
				continue;
			}
			if (!collab.authorPubkeys.includes(pk)) {
				collab.authors.push(ndk.getUser({ pubkey: pk }));
			}
		} catch {
			skippedAuthors.push(pubkeyOrNpub);
		}
	}

	for (const author of collab.authors) {
		collab.tags.push(['p', author.pubkey]);
	}

	await collab.sign(signer);

	/*
	 * WORKAROUND: NDKCollaborativeEvent.publish() override
	 *
	 * NDKCollaborativeEvent overrides the publish() method to broadcast
	 * updates to the *target* event rather than publishing the pointer
	 * event itself.  We need to publish the raw pointer (kind 34235) as a
	 * regular replaceable event, so we bypass the override by calling
	 * NDKEvent.prototype.publish directly on the collab instance.
	 *
	 * Applies to: NDK v3.x (ndk-svelte / @nostr-dev-kit/ndk)
	 * Remove when: NDKCollaborativeEvent exposes a dedicated
	 *   `publishPointer()` method or the override is refactored.
	 */
	await NDKEvent.prototype.publish.call(collab, undefined, undefined, 0);

	// Build and publish the initial target event
	const adapter = getAdapter(targetKind);
	if (!adapter) {
		throw new Error(`No adapter available for kind ${targetKind}`);
	}
	const targetEvent = adapter.createEvent(ndk, dTag, fields);
	const pointerAddr = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}`;
	targetEvent.tags.push(['a', pointerAddr]);
	await adapter.publishEvent(targetEvent);

	// Encode the pointer naddr for navigation
	return { naddr: collab.encode(), skippedAuthors };
}
