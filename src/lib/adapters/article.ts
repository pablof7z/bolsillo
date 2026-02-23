import { NDKArticle, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { EditorField, KindAdapter } from './index';

/**
 * Adapter for kind 30023 (long-form article).
 * Provides the rich title + markdown body editing experience.
 */
export class ArticleAdapter implements KindAdapter {
	readonly kind = NDKKind.Article;
	readonly label = 'Article';
	readonly icon = '📝';
	readonly isAddressable = true;

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
		if (event.kind === NDKKind.Article) {
			return NDKArticle.from(event).title || 'Untitled';
		}
		return event.tagValue('title') ?? 'Untitled';
	}

	getContent(event: NDKEvent): string {
		return event.content ?? '';
	}

	createEvent(ndk: NDKSvelte, dTag: string, fields: Record<string, string>): NDKEvent {
		const article = new NDKArticle(ndk);
		article.dTag = dTag;
		article.title = fields.title ?? '';
		article.content = fields.content ?? '';
		return article;
	}

	updateEvent(event: NDKEvent, fields: Record<string, string>): void {
		if (fields.title !== undefined) {
			// NDKArticle stores title in a tag
			event.removeTag('title');
			event.tags.push(['title', fields.title]);
		}
		if (fields.content !== undefined) {
			event.content = fields.content;
		}
	}

	async publishEvent(event: NDKEvent): Promise<void> {
		await event.publishReplaceable(undefined, undefined, 0);
	}
}
