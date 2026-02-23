# Collabstr — Collaborative Documents on Nostr

A real-time collaborative document editor powered by [NDK](https://github.com/nostr-dev-kit/ndk) and [Nostr](https://nostr.com), showcasing [NIP-C1 Collaborative Events](https://github.com/nostr-dev-kit/ndk/tree/feat/nip-c1-collaborative-events).

## Features

- 🔑 **nsec-based login** — simple private key authentication
- 📝 **Create documents** — publish collaborative documents to Nostr relays
- 👥 **Multi-author collaboration** — invite others by npub to co-edit documents
- ⚡ **Real-time updates** — live subscription to document changes
- 📚 **Version history** — browse all versions with author attribution
- 🌙 **Beautiful dark UI** — Linear/Notion-inspired aesthetics

## Tech Stack

- **SvelteKit** + **Svelte 5** (runes)
- **TailwindCSS** — dark mode styling
- **NDK** — `@nostr-dev-kit/ndk` with `NDKCollaborativeEvent` (kind 39382)
- **Vercel** adapter for deployment

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## How It Works

1. **Sign in** with your Nostr nsec (stored locally, never transmitted)
2. **Create a document** with a title and initial content, optionally invite co-authors
3. A **collaborative pointer event** (kind 39382) is published, linking to an **NDKArticle** (kind 30023)
4. Authorized authors can publish **new versions** of the article
5. The app **subscribes live** to updates from all authorized authors
6. The **latest version** (highest `created_at`) is displayed as the current document

## Architecture

```
Kind 39382 (Collaborative Pointer)
├── d-tag: document identifier
├── k-tag: 30023 (target kind = Article)
├── p-tags: authorized author pubkeys
└── References → Kind 30023 (Article) with same d-tag
    ├── Version by Author A (created_at: T1)
    ├── Version by Author B (created_at: T2) ← latest wins
    └── Version by Author A (created_at: T3)
```

## License

MIT
