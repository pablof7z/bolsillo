<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { EventCard } from './index.js';
  import ReplyButton from './reply-button.svelte';
  import ReactionButton from './reaction-button.svelte';
  import RepostButton from './repost-button.svelte';
  import ZapButton from './zap-button.svelte';
  import ReplyButtonAvatars from './reply-button-avatars.svelte';
  import ReactionButtonAvatars from './reaction-button-avatars.svelte';
  import RepostButtonAvatars from './repost-button-avatars.svelte';
  import ZapButtonAvatars from './zap-button-avatars.svelte';
  import { cn } from '../utils/cn';
  import type { ReplyIntentCallback } from './builders/index.js';
  import type { QuoteIntentCallback } from './builders/index.js';
  import type { ZapIntentCallback } from './builders/index.js';
  import type {
    UserClickCallback,
    EventClickCallback,
    HashtagClickCallback,
    LinkClickCallback,
    MediaClickCallback
  } from './ui/index.svelte.js';

  interface Props {
    ndk: NDKSvelte;

    event: NDKEvent;

    truncate?: number;

    withAvatars?: boolean;

    onReplyIntent?: ReplyIntentCallback;

    onQuoteIntent?: QuoteIntentCallback;

    onZapIntent?: ZapIntentCallback;

    onUserClick?: UserClickCallback;

    onEventClick?: EventClickCallback;

    onHashtagClick?: HashtagClickCallback;

    onLinkClick?: LinkClickCallback;

    onMediaClick?: MediaClickCallback;

    class?: string;
  }

  let {
    ndk,
    event,
    truncate,
    withAvatars = false,
    onReplyIntent,
    onQuoteIntent,
    onZapIntent,
    onUserClick,
    onEventClick,
    onHashtagClick,
    onLinkClick,
    onMediaClick,
    class: className = ''
  }: Props = $props();
</script>

<EventCard.Root
    data-event-card-basic=""
  {ndk}
  {event}
  {onUserClick}
  {onEventClick}
  {onHashtagClick}
  {onLinkClick}
  {onMediaClick}
  class={cn(
    'p-4 bg-background',
    'hover:bg-muted/50 transition-colors',
    className
  )}
>
  <div class="flex items-start justify-between gap-2">
    <EventCard.Header />
    <EventCard.Dropdown />
  </div>

  <EventCard.ReplyIndicator />

  <EventCard.Content {truncate} class="wrap-break-word" />

  <EventCard.Actions>
    {#if withAvatars}
      <ReplyButtonAvatars {ndk} {event} onlyFollows={true} onclick={() => onReplyIntent?.(event)} />
      <RepostButtonAvatars {ndk} {event} onlyFollows={true} />
      <ReactionButtonAvatars {ndk} {event} onlyFollows={true} />
      <ZapButtonAvatars {ndk} {event} onlyFollows={true} onclick={(zapFn) => onZapIntent?.(event, zapFn)} />
    {:else}
      <ReplyButton {ndk} {event} onclick={() => onReplyIntent?.(event)} />
      <RepostButton {ndk} {event} onquote={() => onQuoteIntent?.(event)} />
      <ReactionButton {ndk} {event} />
      <ZapButton {ndk} {event} onclick={(zapFn) => onZapIntent?.(event, zapFn)} />
    {/if}
  </EventCard.Actions>
</EventCard.Root>