import NDK, { NDKArticle, NDKEvent, NDKKind } from '@nostr-dev-kit/ndk';

export interface EventTemplate {
	content?: string;
	tags?: string[][];
}

/**
 * Build a target event from a JSON template.
 * Uses NDKArticle for kind 30023 (with proper title handling),
 * generic NDKEvent for all other kinds.
 */
export function buildTargetEvent(
	ndk: NDK,
	kind: number,
	dTag: string,
	template: EventTemplate
): NDKEvent {
	if (kind === NDKKind.Article) {
		const article = new NDKArticle(ndk);
		article.dTag = dTag;
		article.content = template.content ?? '';

		if (template.tags) {
			for (const tag of template.tags) {
				if (tag[0] === 'title') {
					article.title = tag[1] ?? '';
				} else if (tag[0] !== 'd') {
					article.tags.push(tag);
				}
			}
		}
		return article;
	}

	const event = new NDKEvent(ndk);
	event.kind = kind;
	event.tags.push(['d', dTag]);
	event.content = template.content ?? '';

	if (template.tags) {
		for (const tag of template.tags) {
			if (tag[0] !== 'd') {
				event.tags.push(tag);
			}
		}
	}

	return event;
}
