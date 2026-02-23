<script lang="ts">
  import { setContext } from 'svelte';
  import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { createProfileFetcher } from '../builders/index.svelte.js';
  import { USER_CONTEXT_KEY } from './user.context.js';
  import type { Snippet } from 'svelte';
  import { cn } from "../../utils/cn.js";

  interface Props {
    ndk: NDKSvelte;

    user?: NDKUser;

    npub?: string;

    pubkey?: string;

    profile?: NDKUserProfile;

    onclick?: (e: MouseEvent) => void;

    class?: string;

    children: Snippet;
  }

  let {
    ndk,
    user,
    pubkey,
    npub,
    profile: propProfile,
    onclick,
    class: className = '',
    children
  }: Props = $props();

  // Resolve NDKUser from either user prop or pubkey
  const ndkUser = $derived.by(() => {
    if (user) return user;
    if (npub) { try { return ndk.getUser({ npub }); } catch { return null; } }
    if (pubkey) { try { return ndk.getUser({ pubkey }); } catch { return null; } }
    return null;
  });

  // Create profile fetcher at component initialization (NOT inside $effect!)
  // The config function is reactive — it returns null when ndkUser is null,
  // and the fetcher handles that gracefully.
  const profileFetcher = propProfile !== undefined
    ? null
    : createProfileFetcher(() => ({ user: ndkUser ?? null }), ndk);

  const profile = $derived(propProfile !== undefined ? propProfile : profileFetcher?.profile);

  // Create reactive context using getters for reactivity
  const context = {
    get ndk() { return ndk; },
    get user() { return user; },
    get ndkUser() { return ndkUser; },
    get profile() { return profile; },
    get onclick() { return onclick; }
  };

  setContext(USER_CONTEXT_KEY, context);
</script>

<div data-user-root="" class={cn("contents", className)}>
  {@render children()}
</div>
