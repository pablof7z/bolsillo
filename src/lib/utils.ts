import { nip19 } from 'nostr-tools';

/**
 * Deterministic color for a pubkey
 */
const AUTHOR_COLORS = [
	'#8b5cf6', // violet
	'#3b82f6', // blue
	'#06b6d4', // cyan
	'#10b981', // emerald
	'#f59e0b', // amber
	'#ef4444', // red
	'#ec4899', // pink
	'#6366f1', // indigo
	'#14b8a6', // teal
	'#f97316'  // orange
];

export function colorForPubkey(pubkey: string): string {
	let hash = 0;
	for (let i = 0; i < pubkey.length; i++) {
		hash = pubkey.charCodeAt(i) + ((hash << 5) - hash);
	}
	return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

/**
 * Shortened npub display
 */
export function shortPubkey(pubkey: string): string {
	try {
		const npub = nip19.npubEncode(pubkey);
		return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
	} catch {
		return `${pubkey.slice(0, 8)}…${pubkey.slice(-4)}`;
	}
}

/**
 * Format timestamp
 */
export function formatTimestamp(ts: number | undefined): string {
	if (!ts) return 'Unknown';
	const date = new Date(ts * 1000);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return 'just now';
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;

	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}

/**
 * Format full date
 */
export function formatDate(ts: number | undefined): string {
	if (!ts) return 'Unknown';
	return new Date(ts * 1000).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit'
	});
}

/**
 * Generate a slug-style ID
 */
export function generateDocId(): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	const segments = [
		Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''),
		Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
	];
	return `doc-${segments.join('-')}`;
}
