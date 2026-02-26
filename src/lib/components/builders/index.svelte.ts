import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import { getNDK } from '../../utils/index.svelte.js';

// Track in-flight profile fetch requests to prevent duplicate fetches
const inFlightRequests = new Map<string, Promise<NDKUserProfile | null>>();

export interface ProfileFetcherState {
    profile: NDKUserProfile | null;
    user: NDKUser | null;
    loading: boolean;
}

export interface ProfileFetcherConfig {
    user: NDKUser | string | null | undefined; // NDKUser instance or pubkey/npub, or falsy to skip fetching
}

/**
 * Create reactive state for fetching a user profile
 *
 * Handles fetching and caching user profiles with deduplication.
 * Accepts falsy values (null/undefined) and will skip fetching until a valid user is provided.
 *
 * @param config - Function returning configuration with user (or null/undefined to skip fetching)
 * @param ndk - Optional NDK instance (uses context if not provided)
 *
 * @example
 * ```ts
 * // NDK from context
 * const profileFetcher = createProfileFetcher(() => ({ user: 'npub1...' }));
 *
 * // Or with explicit NDK
 * const profileFetcher = createProfileFetcher(() => ({ user: 'npub1...' }), ndk);
 *
 * // Handles falsy values gracefully (useful with optional props)
 * const profileFetcher = createProfileFetcher(() => ({ user: user ?? pubkey ?? null }));
 *
 * // Access state
 * profileFetcher.profile // User profile
 * profileFetcher.user // NDKUser instance (available once loaded)
 * profileFetcher.loading // Loading state
 * ```
 */
export function createProfileFetcher(
    config: () => ProfileFetcherConfig,
    ndk?: NDKSvelte
): ProfileFetcherState {
    const ndkInstance = getNDK(ndk);
    const state = $state<{ profile: NDKUserProfile | null; user: NDKUser | null; loading: boolean }>({
        profile: null,
        user: null,
        loading: false
    });

    // Track active subscription for cleanup
    let activeSubscription: ReturnType<typeof ndkInstance.subscribe> | null = null;

    async function fetchProfile(payload: NDKUser | string) {
        state.loading = true;

        try {
            const ndkUser = typeof payload === 'string'
                ? await ndkInstance.fetchUser(payload)
                : payload;

            if (!ndkUser) {
                console.warn('[ProfileFetcher] Failed to create NDKUser for:', payload);
                state.profile = null;
                state.user = null;
                state.loading = false;
                return;
            }

            const pubkey = ndkUser.pubkey;

            // Check if profile already cached
            if (ndkUser.profile) {
                state.profile = ndkUser.profile;
                state.user = ndkUser;
                state.loading = false;
                return;
            }

            // Check if there's already an in-flight request for this pubkey
            let fetchPromise = inFlightRequests.get(pubkey);

            if (!fetchPromise) {
                // No in-flight request, create a new one
                fetchPromise = ndkUser
                    .fetchProfile({ closeOnEose: true, groupable: true, groupableDelay: 250 })
                    .finally(() => {
                        // Remove from in-flight requests when complete
                        inFlightRequests.delete(pubkey);
                    });

                inFlightRequests.set(pubkey, fetchPromise);
            }

            // Fetch profile
            const fetchedProfile = await fetchPromise;

            state.profile = fetchedProfile || null;
            state.user = ndkUser;
        } catch (err) {
            // Intentionally silent in production.
            state.profile = null;
            state.user = null;
        }

        state.loading = false;
    }

    $effect(() => {
        const { user } = config();

        // Clean up previous subscription if exists
        if (activeSubscription) {
            activeSubscription.stop();
            activeSubscription = null;
        }

        if (user) {
            fetchProfile(user);

            // Set up subscription to keep profile up to date
            const pubkey = typeof user === 'string' ? user : user.pubkey;

            activeSubscription = ndkInstance.subscribe(
                { kinds: [0], authors: [pubkey] },
                {
                    closeOnEose: false,
                    groupable: true,
                    groupableDelay: 250
                },
                (event) => {
                    try {
                        const profile = JSON.parse(event.content);
                        state.profile = profile;
                    } catch (err) {
                        console.error('[ProfileFetcher] Failed to parse profile update:', err);
                    }
                }
            );
        } else {
            // Reset state when user becomes falsy
            state.profile = null;
            state.user = null;
            state.loading = false;
        }

        // Cleanup function - called when effect re-runs or component unmounts
        return () => {
            if (activeSubscription) {
                activeSubscription.stop();
                activeSubscription = null;
            }
        };
    });

    return {
        get profile() {
            return state.profile;
        },
        get user() {
            return state.user;
        },
        get loading() {
            return state.loading;
        },
    };
}
