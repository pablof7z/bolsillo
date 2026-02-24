import NDK, { NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';

const RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.primal.net'
];

export { RELAYS };

/**
 * Create and connect an NDK instance.
 * If an nsec is provided, a private-key signer is attached.
 */
export async function createConnectedNDK(nsec?: string): Promise<NDK> {
	let signer: NDKPrivateKeySigner | undefined;

	if (nsec) {
		const decoded = nip19.decode(nsec);
		if (decoded.type !== 'nsec') {
			throw new Error('Invalid key format — expected an nsec');
		}
		signer = new NDKPrivateKeySigner(decoded.data as unknown as string);
	}

	const ndk = new NDK({
		explicitRelayUrls: RELAYS,
		signer
	});

	await ndk.connect();

	// Give relays a moment to establish WebSocket connections
	await new Promise((resolve) => setTimeout(resolve, 1500));

	return ndk;
}

/**
 * Gracefully disconnect from all relays and let the process exit.
 */
export function disconnectNDK(ndk: NDK): void {
	for (const relay of ndk.pool.relays.values()) {
		try {
			relay.disconnect();
		} catch {
			// best-effort
		}
	}
}
