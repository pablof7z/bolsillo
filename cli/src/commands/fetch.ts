import { Command } from 'commander';
import NDK, {
	NDKKind,
	NDKSubscriptionCacheUsage
} from '@nostr-dev-kit/ndk';
import { createConnectedNDK, disconnectNDK } from '../ndk.js';
import { decodeNaddr, fetchCollaborativePointer } from '../fetch-pointer.js';

export const fetchCommand = new Command('fetch')
	.description('Fetch the latest version of a NIP-C1 collaborative document')
	.argument('<naddr>', 'naddr of the collaborative pointer (kind 39382)')
	.action(async (naddr: string) => {
		// ── Decode the naddr ─────────────────────────────────
		let decoded: ReturnType<typeof decodeNaddr>;
		try {
			decoded = decodeNaddr(naddr);
		} catch (err) {
			console.error(
				'Error decoding naddr:',
				err instanceof Error ? err.message : err
			);
			process.exit(1);
		}

		let ndk: NDK | undefined;
		let exitCode = 0;

		try {
			console.error('Connecting to relays…');
			ndk = await createConnectedNDK();

			// ── Fetch the collaborative pointer ──────────────────
			console.error('Fetching collaborative pointer…');
			const collab = await fetchCollaborativePointer(ndk, decoded);
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
			exitCode = 1;
		} finally {
			if (ndk) disconnectNDK(ndk);
			setTimeout(() => process.exit(exitCode), 500);
		}
	});
