import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import { ndk } from './ndk';

const STORAGE_KEY = 'ndk-collab-nsec';
const AUTH_METHOD_KEY = 'bolsillo-auth-method';
const NIP46_CONNECTION_KEY = 'bolsillo-nip46-connection';
const NIP46_LOCAL_KEY = 'bolsillo-nip46-local-key';

export type AuthMethod = 'nsec' | 'nip07' | 'nip46';

/**
 * Login with an nsec key.
 * Uses ndk.$sessions from @nostr-dev-kit/svelte for session management.
 */
export async function login(nsec: string): Promise<void> {
	if (!nsec.startsWith('nsec1')) {
		throw new Error('Invalid key format. Please provide an nsec.');
	}

	// NDKPrivateKeySigner accepts nsec strings directly
	const signer = new NDKPrivateKeySigner(nsec);
	await ndk.$sessions!.login(signer, { setActive: true });

	if (browser) {
		localStorage.setItem(STORAGE_KEY, nsec);
		localStorage.setItem(AUTH_METHOD_KEY, 'nsec');
	}
}

/**
 * Login with a NIP-07 browser extension (e.g. nos2x, Alby).
 */
export async function loginWithExtension(): Promise<void> {
	if (!browser) throw new Error('NIP-07 login is only available in the browser.');

	if (!window.nostr) {
		throw new Error('No NIP-07 extension detected. Please install a Nostr signer extension.');
	}

	const signer = new NDKNip07Signer();
	await signer.blockUntilReady();
	await ndk.$sessions!.login(signer, { setActive: true });

	localStorage.setItem(AUTH_METHOD_KEY, 'nip07');
	// Clean up any leftover nsec/nip46 data
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(NIP46_CONNECTION_KEY);
	localStorage.removeItem(NIP46_LOCAL_KEY);
}

/**
 * Login with a NIP-46 remote signer (bunker).
 * @param connectionString - A bunker:// URI or NIP-05 identifier
 * @param timeoutMs - Timeout in milliseconds for blockUntilReady (default: 30s)
 */
export async function loginWithBunker(connectionString: string, timeoutMs = 30_000): Promise<void> {
	if (!browser) throw new Error('NIP-46 login is only available in the browser.');

	if (!connectionString.trim()) {
		throw new Error('Please provide a bunker connection string.');
	}

	const signer = NDKNip46Signer.bunker(ndk, connectionString.trim());

	const ready = signer.blockUntilReady();
	const timeout = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error('Connection to remote signer timed out.')), timeoutMs)
	);

	await Promise.race([ready, timeout]);
	await ndk.$sessions!.login(signer, { setActive: true });

	// Persist connection info for session restore
	localStorage.setItem(AUTH_METHOD_KEY, 'nip46');
	localStorage.setItem(NIP46_CONNECTION_KEY, connectionString.trim());
	localStorage.setItem(NIP46_LOCAL_KEY, signer.localSigner.privateKey ?? '');
	localStorage.removeItem(STORAGE_KEY);
}

/**
 * Restore session from localStorage if available.
 * Handles nsec, NIP-07, and NIP-46 auth methods.
 */
export async function restoreSession(): Promise<void> {
	if (!browser) return;

	const method = localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod | null;

	try {
		switch (method) {
			case 'nip07': {
				if (!window.nostr) {
					console.warn('NIP-07 extension not available, clearing session.');
					clearAuthStorage();
					return;
				}
				const signer = new NDKNip07Signer();
				await signer.blockUntilReady();
				await ndk.$sessions!.login(signer, { setActive: true });
				return;
			}

			case 'nip46': {
				const connection = localStorage.getItem(NIP46_CONNECTION_KEY);
				const localKey = localStorage.getItem(NIP46_LOCAL_KEY);
				if (!connection) {
					clearAuthStorage();
					return;
				}
				const localSigner = localKey || undefined;
				const signer = NDKNip46Signer.bunker(ndk, connection, localSigner);
				await signer.blockUntilReady();
				await ndk.$sessions!.login(signer, { setActive: true });
				return;
			}

			case 'nsec':
			default: {
				// Legacy or explicit nsec flow
				const storedNsec = localStorage.getItem(STORAGE_KEY);
				if (storedNsec) {
					await login(storedNsec);
				}
				return;
			}
		}
	} catch (e) {
		console.warn('Failed to restore session:', e);
		clearAuthStorage();
	}
}

/**
 * Get the current auth method from localStorage.
 */
export function getAuthMethod(): AuthMethod | null {
	if (!browser) return null;
	return localStorage.getItem(AUTH_METHOD_KEY) as AuthMethod | null;
}

/**
 * Logout the current session.
 */
export function logout(): void {
	ndk.$sessions!.logout();
	if (browser) {
		clearAuthStorage();
	}
}

/**
 * Remove all auth-related localStorage keys.
 */
function clearAuthStorage(): void {
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(AUTH_METHOD_KEY);
	localStorage.removeItem(NIP46_CONNECTION_KEY);
	localStorage.removeItem(NIP46_LOCAL_KEY);
}
