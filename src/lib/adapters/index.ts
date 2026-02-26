import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import { ArticleAdapter } from './article';
import { WikiAdapter } from './wiki';
import { GenericAdapter } from './generic';
import { VersionedArticleAdapter } from './versioned-article';

// ── Shared types ──────────────────────────────────────────────

export interface EditorField {
	key: string;
	label: string;
	type: 'text' | 'textarea' | 'number' | 'json' | 'tags' | 'image';
	placeholder?: string;
	/** If true this field is required to create/update */
	required?: boolean;
}

/**
 * A KindAdapter knows how to create, read, and update events of a
 * specific Nostr kind within the collaborative-ownership (NIP-C1) model.
 */
export interface KindAdapter {
	/** Numeric event kind this adapter handles */
	kind: number;
	/** Human-readable label, e.g. "Article" */
	label: string;
	/** Emoji icon for UI badges */
	icon: string;

	/**
	 * Whether events of this kind are addressable (parameterized-replaceable,
	 * kind 30000–39999) — affects how we publish updates.
	 */
	isAddressable: boolean;

	/** Extract a display title from an event */
	getTitle(event: NDKEvent): string;

	/** Extract the main body / content from an event */
	getContent(event: NDKEvent): string;

	/**
	 * Build a *new* unsigned NDKEvent for this kind.
	 * The caller is responsible for signing and publishing.
	 */
	createEvent(ndk: NDKSvelte, dTag: string, fields: Record<string, string>): NDKEvent;

	/**
	 * Mutate an existing event's payload (before re-publishing).
	 */
	updateEvent(event: NDKEvent, fields: Record<string, string>): void;

	/**
	 * Publish an event (replaceable vs regular).
	 * @param relaySet - Optional relay set to publish to. When undefined, uses NDK defaults.
	 */
	publishEvent(event: NDKEvent, relaySet?: NDKRelaySet): Promise<void>;

	/** Describe the editor fields the UI should render for this kind */
	editorFields: EditorField[];
}

// ── Registry ──────────────────────────────────────────────────

const registry = new Map<number, KindAdapter>();

function register(adapter: KindAdapter): void {
	registry.set(adapter.kind, adapter);
}

// Pre-register the built-in adapters
register(new ArticleAdapter());
register(new WikiAdapter());
register(new VersionedArticleAdapter());

/** Returns the adapter for a kind, falling back to GenericAdapter. */
export function getAdapter(kind: number): KindAdapter {
	return registry.get(kind) ?? new GenericAdapter(kind);
}

/**
 * Register a custom adapter at runtime.
 * Later registrations override earlier ones for the same kind.
 */
export function registerAdapter(adapter: KindAdapter): void {
	register(adapter);
}

export { ArticleAdapter, WikiAdapter, GenericAdapter, VersionedArticleAdapter };
