import NDK, { NDKUser } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

/**
 * Resolve a collaborator identifier to a hex pubkey.
 *
 * Accepts:
 *  - 64-char hex pubkey
 *  - npub1… bech32-encoded pubkey
 *  - NIP-05 identifier (user@domain.com)
 */
export async function resolveCollaborator(
	ndk: NDK,
	input: string
): Promise<string> {
	const trimmed = input.trim();

	// Hex pubkey
	if (/^[0-9a-f]{64}$/i.test(trimmed)) {
		return trimmed.toLowerCase();
	}

	// npub
	if (trimmed.startsWith('npub1')) {
		const decoded = nip19.decode(trimmed);
		if (decoded.type === 'npub') {
			return decoded.data as string;
		}
		throw new Error(`Invalid npub: ${trimmed}`);
	}

	// NIP-05 (contains @)
	if (trimmed.includes('@')) {
		const user = await NDKUser.fromNip05(trimmed, ndk);
		if (user?.pubkey) {
			return user.pubkey;
		}
		throw new Error(`Could not resolve NIP-05 address: ${trimmed}`);
	}

	throw new Error(
		`Unrecognized collaborator format: ${trimmed}\n` +
			'  Expected: hex pubkey, npub1…, or NIP-05 (user@domain.com)'
	);
}
