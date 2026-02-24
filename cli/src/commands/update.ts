import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import NDK, {
	NDKArticle,
	NDKCollaborativeEvent,
	NDKEvent,
	NDKKind,
	NDKSubscriptionCacheUsage
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { createConnectedNDK, disconnectNDK } from '../ndk.js';

export const updateCommand = new Command('update')
	.description('Publish a new version of a NIP-C1 collaborative document')
	.argument('<naddr>', 'naddr of the collaborative pointer (kind 39382)')
	.argument('<file>', 'Path to JSON file with updated content')
	.action(async (naddr: string, file: string, _options: unknown, command: Command) => {
		const nsec = command.parent?.opts().nsec;
		if (!nsec) {
			console.error('Error: --nsec is required for the update command');
			process.exit(1);
		}

		// ── Decode the naddr ─────────────────────────────────
		let decoded: nip19.AddressPointer;
		try {
			const result = nip19.decode(naddr);
			if (result.type !== 'naddr') {
				throw new Error(`Expected naddr, got ${result.type}`);
			}
			decoded = result.data;
		} catch (err) {
			console.error(
				'Error decoding naddr:',
				err instanceof Error ? err.message : err
			);
			process.exit(1);
		}

		// ── Read the update template ─────────────────────────
		let template: { content?: string; tags?: string[][] };
		try {
			const raw = readFileSync(file, 'utf-8');
			template = JSON.parse(raw);
		} catch (err) {
			console.error(
				`Error reading ${file}:`,
				err instanceof Error ? err.message : err
			);
			process.exit(1);
		}

		let ndk: NDK | undefined;

		try {
			console.error('Connecting to relays…');
			ndk = await createConnectedNDK(nsec);

			const signer = ndk.signer!;
			const user = await signer.user();

			console.error(`Signed in as ${user.pubkey.slice(0, 12)}…`);

			// ── Fetch the collaborative pointer ──────────────────
			console.error('Fetching collaborative pointer…');
			const pointerEvents = await ndk.fetchEvents({
				kinds: [decoded.kind],
				authors: [decoded.pubkey],
				'#d': [decoded.identifier]
			}, { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY });

			if (pointerEvents.size === 0) {
				console.error('Error: Collaborative pointer not found');
				process.exit(1);
			}

			const pointerEvent = [...pointerEvents].reduce((a, b) =>
				(a.created_at ?? 0) > (b.created_at ?? 0) ? a : b
			);

			const collab = NDKCollaborativeEvent.from(pointerEvent);
			const targetKind = collab.targetKind ?? NDKKind.Article;
			const dTag = collab.dTag ?? decoded.identifier;
			const authorPubkeys = collab.authorPubkeys;

			// ── Verify authorization ─────────────────────────────
			if (!authorPubkeys.includes(user.pubkey)) {
				console.error('Error: You are not an authorized author of this document');
				console.error(`  Your pubkey: ${user.pubkey}`);
				console.error(`  Authorized:  ${authorPubkeys.join(', ')}`);
				process.exit(1);
			}

			// ── Build the updated target event ───────────────────
			let targetEvent: NDKEvent;

			if (targetKind === NDKKind.Article) {
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
				targetEvent = article;
			} else {
				targetEvent = new NDKEvent(ndk);
				targetEvent.kind = targetKind;
				targetEvent.tags.push(['d', dTag]);
				targetEvent.content = template.content ?? '';

				if (template.tags) {
					for (const tag of template.tags) {
						if (tag[0] !== 'd') {
							targetEvent.tags.push(tag);
						}
					}
				}
			}

			// Add back-reference to the pointer
			const pointerAddr = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}`;
			targetEvent.tags.push(['a', pointerAddr]);

			// ── Publish ──────────────────────────────────────────
			console.error(`Publishing updated event (kind ${targetKind})…`);

			const isAddressable = targetKind >= 30000 && targetKind < 40000;
			if (isAddressable) {
				await targetEvent.publishReplaceable(undefined, undefined, 0);
			} else {
				await targetEvent.publish(undefined, 0);
			}

			console.error('\n✓ Published update');
			console.error(`  Kind:     ${targetKind}`);
			console.error(`  d-tag:    ${dTag}`);
			console.error(`  Author:   ${user.pubkey.slice(0, 12)}…`);
			console.error(`  Event ID: ${targetEvent.id}`);
		} catch (err) {
			console.error(
				'Fatal:',
				err instanceof Error ? err.message : err
			);
			process.exit(1);
		} finally {
			if (ndk) disconnectNDK(ndk);
			setTimeout(() => process.exit(0), 500);
		}
	});
