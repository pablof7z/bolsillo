import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import NDK, {
	NDKKind
} from '@nostr-dev-kit/ndk';
import { createConnectedNDK, disconnectNDK } from '../ndk.js';
import { buildTargetEvent, type EventTemplate } from '../build-target-event.js';
import { decodeNaddr, fetchCollaborativePointer } from '../fetch-pointer.js';

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

		// ── Read the update template ─────────────────────────
		let template: EventTemplate;
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
		let exitCode = 0;

		try {
			console.error('Connecting to relays…');
			ndk = await createConnectedNDK(nsec);

			const signer = ndk.signer!;
			const user = await signer.user();

			console.error(`Signed in as ${user.pubkey.slice(0, 12)}…`);

			// ── Fetch the collaborative pointer ──────────────────
			console.error('Fetching collaborative pointer…');
			const collab = await fetchCollaborativePointer(ndk, decoded);
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
			const targetEvent = buildTargetEvent(ndk, targetKind, dTag, template);

			// Add back-reference to the pointer (use computed dTag for safety)
			const pointerAddr = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${dTag}`;
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
			exitCode = 1;
		} finally {
			if (ndk) disconnectNDK(ndk);
			setTimeout(() => process.exit(exitCode), 500);
		}
	});
