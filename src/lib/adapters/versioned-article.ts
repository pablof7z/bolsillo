import { NDKEvent } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { EditorField, KindAdapter } from './index';

/** Nostr kind for versioned articles (non-replaceable long-form content). */
export const KIND_VERSIONED_ARTICLE = 3023;

/**
 * Adapter for kind 3023 (versioned long-form article).
 *
 * Unlike kind 30023 (Article), kind 3023 is a regular (non-replaceable)
 * event: each publish creates a *new* event that is stored independently.
 * This allows authors to accumulate multiple versions rather than having the
 * latest silently overwrite the previous one.
 *
 * The `d` tag is still included as a grouping reference so that all versions
 * of the same document can be found with a `#d` filter.
 */
export class VersionedArticleAdapter implements KindAdapter {
	readonly kind = KIND_VERSIONED_ARTICLE;
	readonly label = 'Versioned Article';
	readonly icon = '📜';
	readonly isAddressable = false;

	readonly editorFields: EditorField[] = [
		{ key: 'title', label: 'Title', type: 'text', placeholder: 'Untitled article', required: true },
		{
			key: 'content',
			label: 'Content',
			type: 'textarea',
			placeholder: 'Start writing… (Markdown supported)'
		}
	];

	getTitle(event: NDKEvent): string {
		return event.tagValue('title') ?? 'Untitled';
	}

	getContent(event: NDKEvent): string {
		return event.content ?? '';
	}

	createEvent(ndk: NDKSvelte, dTag: string, fields: Record<string, string>): NDKEvent {
		const event = new NDKEvent(ndk);
		event.kind = KIND_VERSIONED_ARTICLE;
		// The d tag groups all versions of the same document together and
		// allows them to be retrieved with a '#d' relay filter.
		event.tags.push(['d', dTag]);
		if (fields.title) event.tags.push(['title', fields.title]);
		event.content = fields.content ?? '';
		return event;
	}

	updateEvent(event: NDKEvent, fields: Record<string, string>): void {
		if (fields.title !== undefined) {
			event.removeTag('title');
			event.tags.push(['title', fields.title]);
		}
		if (fields.content !== undefined) {
			event.content = fields.content;
		}
	}

	/**
	 * Publish as a regular (non-replaceable) event so that every version is
	 * preserved on the relay rather than overwriting the previous one.
	 */
	async publishEvent(event: NDKEvent): Promise<void> {
		await event.publish(undefined, 0);
	}
}
