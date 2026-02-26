import { browser } from '$app/environment';
import { NDKRelaySet } from '@nostr-dev-kit/ndk';
import { ndk, RELAYS } from './ndk';

/** Default relay URLs as a Set for O(1) lookup. */
const DEFAULT_RELAYS = new Set(RELAYS);

const STORAGE_KEY = 'bolsillo-custom-relays';

function isValidRelayUrl(value: unknown): value is string {
	return typeof value === 'string' && (value.startsWith('wss://') || value.startsWith('ws://'));
}

function loadFromStorage(): string[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isValidRelayUrl);
	} catch {
		return [];
	}
}

let _relays = $state<string[]>(loadFromStorage());

/**
 * Register any custom relays loaded from storage with NDK.
 * Must be called after NDK is initialized (e.g., from +layout.svelte),
 * not at module init time, to avoid a race condition during NDK startup.
 */
export function initializeRelays(): void {
	if (!browser) return;
	for (const url of _relays) {
		ndk.addExplicitRelay(url);
	}
}

function persist(): void {
	if (!browser) return;
	if (_relays.length === 0) {
		localStorage.removeItem(STORAGE_KEY);
	} else {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(_relays));
	}
}

/**
 * Reactive relay selection state.
 * Access `relayState.customRelays` and `relayState.isCustomMode` inside Svelte
 * reactive contexts ($derived, $effect, ndk.$subscribe config functions) to get
 * automatic reactivity when the relay list changes.
 */
export const relayState = {
	/** Currently selected relay URLs. Empty means "use NDK defaults". */
	get customRelays(): string[] {
		// Return a defensive copy to prevent external mutation bypassing
		// validation, persistence, and reactive updates.
		return [..._relays];
	},
	/** True when the user has selected at least one custom relay. */
	get isCustomMode(): boolean {
		return _relays.length > 0;
	},
	/**
	 * NDKRelaySet for the currently selected relays.
	 * Returns undefined in default mode.
	 */
	get relaySet(): NDKRelaySet | undefined {
		if (_relays.length === 0) return undefined;
		return NDKRelaySet.fromRelayUrls(_relays, ndk);
	}
};

/**
 * Add a relay URL to the custom relay list.
 * @throws if the URL is not a valid ws:// or wss:// URL
 */
export function addRelay(url: string): void {
	const normalized = url.trim().replace(/\/+$/, '');
	if (!normalized.startsWith('wss://') && !normalized.startsWith('ws://')) {
		throw new Error('Relay URL must start with wss:// or ws://');
	}
	if (_relays.includes(normalized)) return;
	_relays = [..._relays, normalized];
	persist();
	// Connect to the relay so NDK can use it for subscriptions/publishes
	ndk.addExplicitRelay(normalized);
}

/** Remove a relay URL from the custom relay list. */
export function removeRelay(url: string): void {
	_relays = _relays.filter((r) => r !== url);
	persist();
	// Only disconnect from the pool if this URL isn't one of the app defaults.
	// Removing a default relay would permanently break subscriptions that rely on it.
	if (!DEFAULT_RELAYS.has(url)) {
		ndk.pool.removeRelay(url);
	}
}

/** Reset to default mode — clears all custom relay selections. */
export function resetToDefault(): void {
	const toRemove = [..._relays];
	_relays = [];
	persist();
	// Only disconnect non-default relays from the pool. Default relays must stay
	// connected so that the app continues to work after resetting.
	for (const url of toRemove) {
		if (!DEFAULT_RELAYS.has(url)) {
			ndk.pool.removeRelay(url);
		}
	}
}
