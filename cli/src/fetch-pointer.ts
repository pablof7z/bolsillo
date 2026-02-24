import NDK, {
	NDKCollaborativeEvent,
	NDKSubscriptionCacheUsage
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

/**
 * Decode an naddr string into an AddressPointer.
 * Throws if the input is not a valid naddr.
 */
export function decodeNaddr(naddr: string): nip19.AddressPointer {
	const result = nip19.decode(naddr);
	if (result.type !== 'naddr') {
		throw new Error(`Expected naddr, got ${result.type}`);
	}
	return result.data;
}

/**
 * Fetch the collaborative pointer event from relays and return it
 * as an NDKCollaborativeEvent.
 * Throws if no pointer is found.
 */
export async function fetchCollaborativePointer(
	ndk: NDK,
	decoded: nip19.AddressPointer
): Promise<NDKCollaborativeEvent> {
	const pointerEvents = await ndk.fetchEvents(
		{
			kinds: [decoded.kind],
			authors: [decoded.pubkey],
			'#d': [decoded.identifier]
		},
		{ cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY }
	);

	if (pointerEvents.size === 0) {
		throw new Error('Collaborative pointer not found');
	}

	const pointerEvent = [...pointerEvents].reduce((a, b) =>
		(a.created_at ?? 0) > (b.created_at ?? 0) ? a : b
	);

	return NDKCollaborativeEvent.from(pointerEvent);
}
