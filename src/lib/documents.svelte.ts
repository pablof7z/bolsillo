import {
	NDKArticle,
	NDKCollaborativeEvent,
	NDKEvent,
	NDKKind
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { ndk } from './ndk';
import { generateDocId } from './utils';

export interface DocListItem {
	/** Composite identity: `pubkey:dTag` to avoid collisions across authors */
	id: string;
	title: string;
	authorCount: number;
	updatedAt: number;
	naddr: string;
}

export interface DocVersion {
	eventId: string;
	author: string;
	title: string;
	content: string;
	timestamp: number;
}

/**
 * Convert collab events + article events into a sorted DocListItem array.
 * Pure function — no fetching.
 */
export function collabEventsToDocList(
	collabEvents: NDKEvent[],
	articleEvents: NDKEvent[]
): DocListItem[] {
	// Build article lookup: dTag -> newest article
	const articleByDTag = new Map<string, NDKEvent>();
	for (const event of articleEvents) {
		const dTag = event.tagValue('d');
		if (!dTag) continue;
		const existing = articleByDTag.get(dTag);
		if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
			articleByDTag.set(dTag, event);
		}
	}

	// Deduplicate collab events by pubkey:dTag (keep newest)
	const collabByKey = new Map<string, NDKEvent>();
	for (const event of collabEvents) {
		const dTag = event.tagValue('d');
		if (!dTag) continue;
		const key = `${event.pubkey}:${dTag}`;
		const existing = collabByKey.get(key);
		if (!existing || (event.created_at || 0) > (existing.created_at || 0)) {
			collabByKey.set(key, event);
		}
	}

	const docs: DocListItem[] = [];
	for (const [compositeKey, event] of collabByKey) {
		const collab = NDKCollaborativeEvent.from(event);
		const dTag = collab.dTag || '';

		const articleEvent = articleByDTag.get(dTag);
		let title = dTag;
		let updatedAt = event.created_at || 0;

		if (articleEvent && articleEvent.kind === NDKKind.Article) {
			const article = NDKArticle.from(articleEvent);
			title = article.title || dTag;
			updatedAt = articleEvent.created_at || updatedAt;
		}

		const naddrData: nip19.AddressPointer = {
			kind: NDKKind.CollaborativeEvent,
			pubkey: event.pubkey,
			identifier: dTag,
			relays: ['wss://relay.damus.io', 'wss://nos.lol']
		};

		docs.push({
			id: compositeKey,
			title,
			authorCount: collab.authorPubkeys.length || 1,
			updatedAt,
			naddr: nip19.naddrEncode(naddrData)
		});
	}

	docs.sort((a, b) => b.updatedAt - a.updatedAt);
	return docs;
}

/** Convert an NDKEvent to a DocVersion */
export function eventToVersion(event: NDKEvent): DocVersion | null {
	try {
		if (event.kind === NDKKind.Article) {
			const article = NDKArticle.from(event);
			return {
				eventId: event.id || '',
				author: event.pubkey,
				title: article.title || 'Untitled',
				content: article.content || '',
				timestamp: event.created_at || 0
			};
		}

		return {
			eventId: event.id || '',
			author: event.pubkey,
			title: 'Untitled',
			content: event.content || '',
			timestamp: event.created_at || 0
		};
	} catch (e) {
		console.warn('Failed to parse event as version:', e);
		return null;
	}
}

/** Publish an update to a collaborative document */
export async function publishUpdate(
	collab: NDKCollaborativeEvent,
	title: string,
	content: string
): Promise<DocVersion> {
	const pubkey = ndk.$currentPubkey;
	if (!pubkey) throw new Error('Not authenticated');

	const isAuthor = collab.authorPubkeys.includes(pubkey);
	if (!isAuthor) throw new Error('You are not an authorized author of this document');

	const article = new NDKArticle(ndk);
	article.dTag = collab.dTag || '';
	article.title = title;
	article.content = content;

	await article.publishReplaceable(undefined, undefined, 0);

	return {
		eventId: article.id || '',
		author: pubkey,
		title,
		content,
		timestamp: Math.floor(Date.now() / 1000)
	};
}

export interface CreateDocumentResult {
	naddr: string;
	skippedAuthors: string[];
}

/**
 * Create a new collaborative document
 */
export async function createDocument(
	title: string,
	content: string,
	additionalAuthors: string[] = []
): Promise<CreateDocumentResult> {
	const pubkey = ndk.$currentPubkey;
	if (!pubkey) {
		throw new Error('Not authenticated');
	}

	const signer = ndk.signer!;
	const user = await signer.user();

	// Create the article but don't publish yet — we need the collab pointer first
	// so we can add the backlink before the first publish.
	const article = new NDKArticle(ndk);
	article.title = title;
	article.content = content;
	article.dTag = generateDocId();

	// Build the collaborative pointer
	const collab = new NDKCollaborativeEvent(ndk);
	collab.dTag = article.dTag;
	collab.targetKind = article.kind;
	collab.authors.push(user);

	const skippedAuthors: string[] = [];
	for (const pubkeyOrNpub of additionalAuthors) {
		let pk = pubkeyOrNpub.trim();
		if (!pk) continue;

		try {
			if (pk.startsWith('npub1')) {
				const decoded = nip19.decode(pk);
				if (decoded.type === 'npub') {
					pk = decoded.data as string;
				}
			}

			if (!/^[0-9a-f]{64}$/i.test(pk)) {
				skippedAuthors.push(pubkeyOrNpub);
				continue;
			}

			if (!collab.authorPubkeys.includes(pk)) {
				collab.authors.push(ndk.getUser({ pubkey: pk }));
			}
		} catch (e) {
			skippedAuthors.push(pubkeyOrNpub);
		}
	}

	for (const author of collab.authors) {
		collab.tags.push(['p', author.pubkey]);
	}

	await collab.sign(signer);

	// Publish the collab pointer using NDKEvent.prototype.publish directly
	// to bypass NDKCollaborativeEvent's overridden publish behavior.
	await NDKEvent.prototype.publish.call(collab, undefined, undefined, 0);

	// Now add the backlink to the article and publish it once
	// publishReplaceable handles signing, so no need to sign separately
	const pointerAddress = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}`;
	article.tags.push(['a', pointerAddress]);
	await article.publishReplaceable(undefined, undefined, 0);

	const naddrData: nip19.AddressPointer = {
		kind: NDKKind.CollaborativeEvent,
		pubkey: collab.pubkey,
		identifier: collab.dTag || '',
		relays: ['wss://relay.damus.io', 'wss://nos.lol']
	};

	return { naddr: nip19.naddrEncode(naddrData), skippedAuthors };
}
