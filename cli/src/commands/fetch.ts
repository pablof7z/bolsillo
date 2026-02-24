import { Command } from 'commander';
import NDK, {
	NDKCollaborativeEvent,
	NDKKind,
	NDKSubscriptionCacheUsage
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { createConnectedNDK, disconnectNDK } from '../ndk.js';

export const fetchCommand = new Command('fetch')
	.description('Fetch the latest version of a NIP-C1 collaborative document')
	.argument('<naddr>', 'naddr of the collaborative pointer (kind 39382)')
	.action(async (naddr: string) => {
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

		let ndk: NDK | undefined;

		try {
			console.error('Connecting to relays…');
			ndk = await createConnectedNDK();

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

			// Pick the newest pointer event
			const pointerEvent = [...pointerEvents].reduce((a, b) =>
				(a.created_at ?? 0) > (b.created_at ?? 0) ? a : b
			);

			const collab = NDKCollaborativeEvent.from(pointerEvent);
			const targetKind = collab.targetKind ?? NDKKind.Article;
			const authorPubkeys = collab.authorPubkeys;
			const dTag = collab.dTag ?? decoded.identifier;

			console.error(`  Kind:     ${targetKind}`);
			console.error(`  d-tag:    ${dTag}`);
			console.error(`  Authors:  ${authorPubkeys.length}`);

			// ── Fetch target events from all authorized authors ──
			console.error('Fetching latest version…');
			const targetEvents = await ndk.fetchEvents({
				kinds: [targetKind],
				authors: authorPubkeys,
				'#d': [dTag]
			}, { cacheUsage: NDKSubscriptionCacheUsage.ONLY_RELAY });

			if (targetEvents.size === 0) {
				console.error('Warning: No target events found (pointer exists but no content published yet)');

				// Output the pointer metadata anyway
				const output = {
					pointer: {
						kind: NDKKind.CollaborativeEvent,
						pubkey: collab.pubkey,
						dTag,
						targetKind,
						authors: authorPubkeys
					},
					event: null
				};
				console.log(JSON.stringify(output, null, 2));
				return;
			}

			// Pick the latest target event (highest created_at)
			const latest = [...targetEvents].reduce((a, b) =>
				(a.created_at ?? 0) > (b.created_at ?? 0) ? a : b
			);

			console.error(`  Found ${targetEvents.size} version(s), returning latest`);
			console.error('');

			// ── Output ───────────────────────────────────────────
			const output = {
				pointer: {
					kind: NDKKind.CollaborativeEvent,
					pubkey: collab.pubkey,
					dTag,
					targetKind,
					authors: authorPubkeys
				},
				event: {
					id: latest.id,
					pubkey: latest.pubkey,
					kind: latest.kind,
					content: latest.content,
					tags: latest.tags,
					created_at: latest.created_at
				}
			};

			console.log(JSON.stringify(output, null, 2));
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
