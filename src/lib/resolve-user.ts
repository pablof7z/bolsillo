import { nip19 } from 'nostr-tools';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';

export interface ResolvedUser {
	/** Hex pubkey */
	pubkey: string;
	/** Original input string used to resolve this user */
	input: string;
}

export type ResolveError =
	| { type: 'invalid'; message: string }
	| { type: 'not_found'; message: string }
	| { type: 'network'; message: string };

export type ResolveResult =
	| { ok: true; user: ResolvedUser }
	| { ok: false; error: ResolveError };

const HEX_PUBKEY_RE = /^[0-9a-f]{64}$/i;
const NIP05_RE = /^[\w.+-]+@[\w.-]+\.\w+$/;

/**
 * Resolve a user input string (npub, hex pubkey, or NIP-05) to a hex pubkey.
 */
export async function resolveUser(
	input: string,
	ndk: NDKSvelte
): Promise<ResolveResult> {
	const trimmed = input.trim();
	if (!trimmed) {
		return { ok: false, error: { type: 'invalid', message: 'Empty input' } };
	}

	// Try npub
	if (trimmed.startsWith('npub1')) {
		try {
			const decoded = nip19.decode(trimmed);
			if (decoded.type === 'npub') {
				return {
					ok: true,
					user: { pubkey: decoded.data as string, input: trimmed }
				};
			}
		} catch {
			return {
				ok: false,
				error: { type: 'invalid', message: 'Invalid npub format' }
			};
		}
	}

	// Try hex pubkey
	if (HEX_PUBKEY_RE.test(trimmed)) {
		return { ok: true, user: { pubkey: trimmed.toLowerCase(), input: trimmed } };
	}

	// Try NIP-05
	if (NIP05_RE.test(trimmed)) {
		try {
			const user = await ndk.getUserFromNip05(trimmed);
			if (user) {
				return {
					ok: true,
					user: { pubkey: user.pubkey, input: trimmed }
				};
			}
			return {
				ok: false,
				error: { type: 'not_found', message: `No user found for ${trimmed}` }
			};
		} catch {
			return {
				ok: false,
				error: { type: 'network', message: `Failed to resolve ${trimmed}` }
			};
		}
	}

	return {
		ok: false,
		error: { type: 'invalid', message: 'Enter an npub, hex pubkey, or NIP-05 address' }
	};
}
