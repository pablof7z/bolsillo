import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { browser } from '$app/environment';
import { ndk, RELAYS } from './ndk';

const STORAGE_KEY = 'ndk-collab-nsec';
const AUTH_METHOD_KEY = 'bolsillo-auth-method';
const NIP46_CONNECTION_KEY = 'bolsillo-nip46-connection';
const NIP46_LOCAL_KEY = 'bolsillo-nip46-local-key';
const NOSTRCONNECT_RELAY_KEY = 'bolsillo-nostrconnect-relay';
const NIP46_SIGNER_PAYLOAD_KEY = 'bolsillo-nip46-signer-payload';

export type AuthMethod = 'nsec' | 'nip07' | 'nip46' | 'nostrconnect';

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
		localStorage.removeItem(NIP46_SIGNER_PAYLOAD_KEY);
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
	localStorage.removeItem(NOSTRCONNECT_RELAY_KEY);
	localStorage.removeItem(NIP46_SIGNER_PAYLOAD_KEY);
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

	// Persist full signer state for session restore
	localStorage.setItem(AUTH_METHOD_KEY, 'nip46');
	localStorage.setItem(NIP46_SIGNER_PAYLOAD_KEY, signer.toPayload());
	// Keep legacy keys as fallback
	localStorage.setItem(NIP46_CONNECTION_KEY, connectionString.trim());
	localStorage.setItem(NIP46_LOCAL_KEY, signer.localSigner.privateKey ?? '');
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(NOSTRCONNECT_RELAY_KEY);
}

/**
 * Create a NostrConnect (client-initiated NIP-46) signer.
 * Returns the signer so the caller can access `nostrConnectUri` and `blockUntilReady`.
 *
 * @param relay - Relay URL for connection (defaults to first configured relay)
 */
export function createNostrConnectSigner(relay?: string): NDKNip46Signer {
	const connectRelay = relay ?? RELAYS[0];

	const signer = NDKNip46Signer.nostrconnect(ndk, connectRelay, undefined, {
		name: 'Bolsillo',
		url: browser ? window.location.origin : 'https://bolsillo.app',
		perms: 'get_public_key,sign_event,nip04_encrypt,nip04_decrypt,nip44_encrypt,nip44_decrypt'
	});

	return signer;
}

/**
 * Login with NostrConnect (client-initiated NIP-46 QR code flow).
 * The caller should display the QR code from `signer.nostrConnectUri` before calling this.
 *
 * @param signer - The NDKNip46Signer created by createNostrConnectSigner
 * @param timeoutMs - Timeout in milliseconds (default: 120s for QR scanning)
 */
export async function loginWithNostrConnect(
	signer: NDKNip46Signer,
	timeoutMs = 120_000
): Promise<void> {
	if (!browser) throw new Error('NostrConnect login is only available in the browser.');

	const ready = signer.blockUntilReady();
	const timeout = new Promise<never>((_, reject) =>
		setTimeout(() => reject(new Error('QR code scan timed out. Please try again.')), timeoutMs)
	);

	await Promise.race([ready, timeout]);
	await ndk.$sessions!.login(signer, { setActive: true });

	// Persist full signer state for session restore (preserves remote pubkey, relay URLs, etc.)
	localStorage.setItem(AUTH_METHOD_KEY, 'nostrconnect');
	localStorage.setItem(NIP46_SIGNER_PAYLOAD_KEY, signer.toPayload());
	localStorage.removeItem(STORAGE_KEY);
	localStorage.removeItem(NIP46_CONNECTION_KEY);
	localStorage.removeItem(NIP46_LOCAL_KEY);
	localStorage.removeItem(NOSTRCONNECT_RELAY_KEY);
}

/**
 * Restore session from localStorage if available.
 * Handles nsec, NIP-07, NIP-46, and NostrConnect auth methods.
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
				const payload = localStorage.getItem(NIP46_SIGNER_PAYLOAD_KEY);
				if (payload) {
					const signer = await NDKNip46Signer.fromPayload(payload, ndk);
					const ready = signer.blockUntilReady();
					const timeout = new Promise<never>((_, reject) =>
						setTimeout(
							() => reject(new Error('Session restore timed out.')),
							30_000
						)
					);
					await Promise.race([ready, timeout]);
					await ndk.$sessions!.login(signer, { setActive: true });
					return;
				}
				// Fallback to legacy restore (connection string + local key)
				const connection = localStorage.getItem(NIP46_CONNECTION_KEY);
				const localKey = localStorage.getItem(NIP46_LOCAL_KEY);
				if (!connection) {
					clearAuthStorage();
					return;
				}
				const localSigner = localKey || undefined;
				const signer = NDKNip46Signer.bunker(ndk, connection, localSigner);
				const ready = signer.blockUntilReady();
				const timeout = new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error('Session restore timed out.')),
						30_000
					)
				);
				await Promise.race([ready, timeout]);
				await ndk.$sessions!.login(signer, { setActive: true });
				return;
			}

			case 'nostrconnect': {
				const payload = localStorage.getItem(NIP46_SIGNER_PAYLOAD_KEY);
				if (!payload) {
					clearAuthStorage();
					return;
				}
				const signer = await NDKNip46Signer.fromPayload(payload, ndk);
				const ready = signer.blockUntilReady();
				const timeout = new Promise<never>((_, reject) =>
					setTimeout(
						() => reject(new Error('NostrConnect session restore timed out.')),
						30_000
					)
				);
				await Promise.race([ready, timeout]);
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
	localStorage.removeItem(NOSTRCONNECT_RELAY_KEY);
	localStorage.removeItem(NIP46_SIGNER_PAYLOAD_KEY);
}
