import { createNDK, type NDKSvelte } from '@nostr-dev-kit/svelte';
import { browser } from '$app/environment';

const RELAYS = [
	'wss://relay.damus.io',
	'wss://nos.lol',
	'wss://relay.primal.net'
];

export const ndk: NDKSvelte = createNDK({
	explicitRelayUrls: RELAYS,
	session: true
});

if (browser) {
	ndk.connect();
}

export { RELAYS };
