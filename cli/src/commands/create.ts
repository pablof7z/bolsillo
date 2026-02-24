import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import NDK, {
	NDKArticle,
	NDKCollaborativeEvent,
	NDKEvent,
	NDKKind
} from '@nostr-dev-kit/ndk';
import { nip19 } from 'nostr-tools';
import { createConnectedNDK, disconnectNDK, RELAYS } from '../ndk.js';
import { resolveCollaborator } from '../resolve-collaborator.js';

interface CreateOptions {
	kind: string;
	collab: string[];
	dtag: string;
}

/**
 * Build the target event from the JSON template.
 */
function buildTargetEvent(
	ndk: NDK,
	kind: number,
	dTag: string,
	template: { content?: string; tags?: string[][] }
): NDKEvent {
	// Use NDKArticle for kind 30023 for proper title handling
	if (kind === NDKKind.Article) {
		const article = new NDKArticle(ndk);
		article.dTag = dTag;
		article.content = template.content ?? '';

		// Apply tags from the template
		if (template.tags) {
			for (const tag of template.tags) {
				if (tag[0] === 'title') {
					article.title = tag[1] ?? '';
				} else if (tag[0] !== 'd') {
					// Don't override the d-tag we already set
					article.tags.push(tag);
				}
			}
		}
		return article;
	}

	// Generic event for all other kinds
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

export const createCommand = new Command('create')
	.description('Create a new NIP-C1 collaborative event')
	.requiredOption('-k, --kind <number>', 'Target event kind (e.g. 30023)')
	.option('--collab <identifier...>', 'Collaborator pubkey, npub, or NIP-05 (repeatable)', [])
	.requiredOption('-d, --dtag <slug>', 'Document identifier (d-tag)')
	.argument('<file>', 'Path to JSON file with event template')
	.action(async (file: string, options: CreateOptions, command: Command) => {
		const nsec = command.parent?.opts().nsec;
		if (!nsec) {
			console.error('Error: --nsec is required for the create command');
			process.exit(1);
		}

		const kind = parseInt(options.kind, 10);
		if (isNaN(kind) || kind < 0) {
			console.error(`Error: Invalid kind "${options.kind}"`);
			process.exit(1);
		}

		// Read the JSON template
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

			// ── Resolve collaborators ────────────────────────────
			const authorPubkeys = new Set<string>([user.pubkey]);
			const skipped: string[] = [];

			for (const raw of options.collab) {
				try {
					const pk = await resolveCollaborator(ndk, raw);
					authorPubkeys.add(pk);
				} catch (err) {
					skipped.push(raw);
					console.error(
						`  ⚠ Skipped collaborator "${raw}": ${err instanceof Error ? err.message : err}`
					);
				}
			}

			// ── Build & publish the collaborative pointer (39382) ─
			const collab = new NDKCollaborativeEvent(ndk);
			collab.dTag = options.dtag;
			collab.targetKind = kind;

			for (const pk of authorPubkeys) {
				collab.authors.push(ndk.getUser({ pubkey: pk }));
				collab.tags.push(['p', pk]);
			}

			await collab.sign(signer);

			/*
			 * WORKAROUND: NDKCollaborativeEvent.publish() overrides
			 * to broadcast target events. We need to publish the raw
			 * pointer event, so we call NDKEvent.prototype.publish.
			 */
			console.error('Publishing collaborative pointer (kind 39382)…');
			await NDKEvent.prototype.publish.call(collab, undefined, undefined, 0);

			// ── Build & publish the target event ─────────────────
			const targetEvent = buildTargetEvent(ndk, kind, options.dtag, template);

			// Add back-reference to the pointer
			const pointerAddr = `${NDKKind.CollaborativeEvent}:${collab.pubkey}:${collab.dTag}`;
			targetEvent.tags.push(['a', pointerAddr]);

			console.error(`Publishing target event (kind ${kind})…`);

			const isAddressable = kind >= 30000 && kind < 40000;
			if (isAddressable) {
				await targetEvent.publishReplaceable(undefined, undefined, 0);
			} else {
				await targetEvent.publish(undefined, 0);
			}

			// ── Encode and output the naddr ──────────────────────
			const naddrData: nip19.AddressPointer = {
				kind: NDKKind.CollaborativeEvent,
				pubkey: collab.pubkey,
				identifier: options.dtag,
				relays: RELAYS.slice(0, 2)
			};

			const naddr = nip19.naddrEncode(naddrData);

			if (skipped.length > 0) {
				console.error(`\nSkipped ${skipped.length} collaborator(s): ${skipped.join(', ')}`);
			}

			console.error('\n✓ Created collaborative document');
			console.error(`  Pointer:  kind ${NDKKind.CollaborativeEvent} / d:${options.dtag}`);
			console.error(`  Target:   kind ${kind} / d:${options.dtag}`);
			console.error(`  Authors:  ${authorPubkeys.size}`);
			console.error('');

			// The naddr goes to stdout so it can be piped
			console.log(naddr);
		} catch (err) {
			console.error(
				'Fatal:',
				err instanceof Error ? err.message : err
			);
			process.exit(1);
		} finally {
			if (ndk) disconnectNDK(ndk);
			// Force exit since WebSocket connections may keep the event loop alive
			setTimeout(() => process.exit(0), 500);
		}
	});
