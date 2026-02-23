import { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { ndk } from './ndk';

const STORAGE_KEY = 'ndk-collab-nsec';

/**
 * Login with an nsec key.
 * Uses ndk.$sessions from @nostr-dev-kit/svelte for session management.
 */
export async function login(nsec: string): Promise<void> {
	const decoded = nip19.decode(nsec);
	if (decoded.type !== 'nsec') {
		throw new Error('Invalid key format. Please provide an nsec.');
	}

	const signer = new NDKPrivateKeySigner(decoded.data as string);
	await ndk.$sessions!.login(signer, { setActive: true });

	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, nsec);
	}
}

/**
 * Restore session from localStorage if available.
 */
export async function restoreSession(): Promise<void> {
	if (typeof localStorage === 'undefined') return;

	const storedNsec = localStorage.getItem(STORAGE_KEY);
	if (storedNsec) {
		try {
			await login(storedNsec);
		} catch (e) {
			console.warn('Failed to restore session:', e);
			localStorage.removeItem(STORAGE_KEY);
		}
	}
}

/**
 * Logout the current session.
 */
export function logout(): void {
	ndk.$sessions!.logout();

	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(STORAGE_KEY);
	}
}
