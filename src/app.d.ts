// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	/**
	 * NIP-07 browser extension interface.
	 * @see https://github.com/nostr-protocol/nips/blob/master/07.md
	 */
	interface Window {
		nostr?: {
			getPublicKey(): Promise<string>;
			signEvent(event: import('@nostr-dev-kit/ndk').NDKRawEvent): Promise<import('@nostr-dev-kit/ndk').NDKRawEvent>;
			getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
			nip04?: {
				encrypt(pubkey: string, plaintext: string): Promise<string>;
				decrypt(pubkey: string, ciphertext: string): Promise<string>;
			};
			nip44?: {
				encrypt(pubkey: string, plaintext: string): Promise<string>;
				decrypt(pubkey: string, ciphertext: string): Promise<string>;
			};
		};
	}
}

export {};
