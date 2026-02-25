/**
 * Human-readable labels for well-known Nostr event kinds.
 * Used by the generic adapter and the kind picker UI.
 */
const KNOWN_KINDS: Record<number, string> = {
	0: 'Profile Metadata',
	1: 'Short Note',
	3: 'Contacts',
	4: 'Encrypted DM',
	5: 'Deletion',
	6: 'Repost',
	7: 'Reaction',
	11: 'Thread',
	20: 'Image',
	21: 'Video',
	22: 'Short Video',
	23: 'Story',
	1063: 'Media',
	1111: 'Reply',
	1222: 'Voice Message',
	1934: 'Task',
	3023: 'Versioned Article',
	30023: 'Article',
	30818: 'Wiki',
	30024: 'Draft Article',
	30040: 'Modular Article',
	30402: 'Classified',
};

/** Return a human-readable label for a kind number */
export function kindLabel(kind: number): string {
	if (KNOWN_KINDS[kind]) return KNOWN_KINDS[kind];
	if (kind >= 30000 && kind < 40000) return `Addressable (${kind})`;
	if (kind >= 20000 && kind < 30000) return `Ephemeral (${kind})`;
	if (kind >= 10000 && kind < 20000) return `Replaceable (${kind})`;
	return `Kind ${kind}`;
}

/** Replaceable kinds (10000–19999) share one slot per author+kind — no d-tag identity. */
export function isReplaceableKind(kind: number): boolean {
	return kind >= 10000 && kind < 20000;
}

/** Ephemeral kinds (20000–29999) are not persisted by relays. */
export function isEphemeralKind(kind: number): boolean {
	return kind >= 20000 && kind < 30000;
}

/**
 * A curated list of kinds that are commonly used and make sense
 * to create collaboratively. Shown in the "quick pick" UI.
 */
export const SUGGESTED_KINDS: { kind: number; label: string; icon: string }[] = [
	{ kind: 30023, label: 'Article', icon: '📝' },
	{ kind: 3023, label: 'Versioned Article', icon: '📜' },
	{ kind: 30818, label: 'Wiki Page', icon: '📖' },
	{ kind: 1, label: 'Short Note', icon: '💬' },
	{ kind: 30402, label: 'Classified', icon: '🏷️' },
	{ kind: 30040, label: 'Modular Article', icon: '🧩' },
];
