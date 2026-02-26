import { NDKEvent, NDKKind, NDKRelaySet } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { EditorField, KindAdapter } from './index';

/**
 * Adapter for kind 30818 (wiki page).
 * Very similar to the article adapter but branded differently.
 */
export class WikiAdapter implements KindAdapter {
	readonly kind = NDKKind.Wiki;
	readonly label = 'Wiki';
	readonly icon = '📖';
	readonly isAddressable = true;

	readonly editorFields: EditorField[] = [
		{ key: 'title', label: 'Title', type: 'text', placeholder: 'Page title', required: true },
		{
			key: 'content',
			label: 'Content',
			type: 'textarea',
			placeholder: 'Start writing… (Markdown supported)'
		}
	];

	getTitle(event: NDKEvent): string {
		return event.tagValue('title') ?? event.tagValue('d') ?? 'Untitled';
	}

	getContent(event: NDKEvent): string {
		return event.content ?? '';
	}

	createEvent(ndk: NDKSvelte, dTag: string, fields: Record<string, string>): NDKEvent {
		const event = new NDKEvent(ndk);
		event.kind = NDKKind.Wiki;
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

	async publishEvent(event: NDKEvent, relaySet?: NDKRelaySet): Promise<void> {
		await event.publishReplaceable(relaySet, undefined, 0);
	}
}
