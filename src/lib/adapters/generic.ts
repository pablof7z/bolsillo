import { NDKEvent, NDKRelaySet } from '@nostr-dev-kit/ndk';
import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { EditorField, KindAdapter } from './index';
import { kindLabel } from '../kind-labels';

/** Validate that a value is a tag array (array of string arrays). */
function parseExtraTags(raw: string): string[][] {
	const parsed: unknown = JSON.parse(raw);
	if (!Array.isArray(parsed)) return [];

	const valid: string[][] = [];
	for (const tag of parsed) {
		if (!Array.isArray(tag)) continue;
		if (!tag.every((el: unknown) => typeof el === 'string')) continue;
		if (tag.length === 0) continue;
		valid.push(tag as string[]);
	}
	return valid;
}

/**
 * Fallback adapter that handles *any* event kind.
 * Provides a JSON/plain-text content editor and a raw-tags view.
 */
export class GenericAdapter implements KindAdapter {
	readonly kind: number;
	readonly icon = '📄';
	readonly editorFields: EditorField[];

	constructor(kind: number) {
		this.kind = kind;
		this.editorFields = [
			{ key: 'content', label: 'Content', type: 'textarea', placeholder: 'Event content…' },
			{ key: 'tags', label: 'Extra tags (JSON)', type: 'json', placeholder: '[["t","nostr"]]' }
		];
	}

	get label(): string {
		return kindLabel(this.kind);
	}

	get isAddressable(): boolean {
		return this.kind >= 30000 && this.kind < 40000;
	}

	getTitle(event: NDKEvent): string {
		// Try common title-bearing tags first
		return (
			event.tagValue('title') ??
			event.tagValue('name') ??
			event.tagValue('subject') ??
			(event.content ? event.content.slice(0, 60) + (event.content.length > 60 ? '…' : '') : `Kind ${event.kind} event`)
		);
	}

	getContent(event: NDKEvent): string {
		return event.content ?? '';
	}

	createEvent(ndk: NDKSvelte, dTag: string, fields: Record<string, string>): NDKEvent {
		const event = new NDKEvent(ndk);
		event.kind = this.kind;
		event.tags.push(['d', dTag]);
		event.content = fields.content ?? '';

		if (fields.tags) {
			try {
				for (const tag of parseExtraTags(fields.tags)) {
					event.tags.push(tag);
				}
			} catch {
				// ignore malformed tags input
			}
		}

		return event;
	}

	updateEvent(event: NDKEvent, fields: Record<string, string>): void {
		if (fields.content !== undefined) {
			event.content = fields.content;
		}
		// Extra tags are additive — we don't remove previously set custom tags
		if (fields.tags) {
			try {
				for (const tag of parseExtraTags(fields.tags)) {
					event.tags.push(tag);
				}
			} catch {
				// ignore malformed tags input
			}
		}
	}

	async publishEvent(event: NDKEvent, relaySet?: NDKRelaySet): Promise<void> {
		if (this.isAddressable) {
			await event.publishReplaceable(relaySet, undefined, 0);
		} else {
			await event.publish(relaySet, 0);
		}
	}
}
