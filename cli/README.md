# Bolsillo CLI

Command-line tool for creating and managing NIP-C1 collaborative events on Nostr.

## Install

```bash
npx bolsillo --help
```

Or install globally:

```bash
npm install -g bolsillo
```

## Commands

### Create a collaborative document

```bash
npx bolsillo --nsec <nsec> create \
  -k 30023 \
  --collab 09d48a1a5dbe13404a729634f1d6ba722d40513468dd713c8ea38ca9b7b6f2c7 \
  --collab user@example.com \
  -d my-article \
  article.json
```

**Options:**

| Flag | Description |
|------|-------------|
| `-k, --kind <number>` | Target event kind (e.g. `30023` for articles) |
| `--collab <id>` | Collaborator identifier — hex pubkey, `npub1…`, or NIP-05 (`user@domain.com`). Repeatable. |
| `-d, --dtag <slug>` | Document identifier (d-tag) |

**Input file** (`article.json`):

```json
{
  "content": "Your article content here…",
  "tags": [
    ["title", "My Collaborative Article"],
    ["t", "nostr"]
  ]
}
```

The command publishes both the collaborative pointer (kind 39382) and the initial target event, then outputs the `naddr` to stdout.

### Fetch the latest version

```bash
npx bolsillo fetch <naddr>
```

Returns the latest target event as JSON:

```json
{
  "id": "...",
  "pubkey": "...",
  "kind": 30023,
  "content": "...",
  "tags": [...],
  "created_at": 1234567890
}
```

Add `--verbose` to include the collaborative pointer metadata:

```bash
npx bolsillo fetch --verbose <naddr>
```

```json
{
  "pointer": {
    "kind": 39382,
    "pubkey": "...",
    "dTag": "my-article",
    "targetKind": 30023,
    "authors": ["pubkey1", "pubkey2"]
  },
  "event": { ... }
}
```

### Update a collaborative document

```bash
npx bolsillo --nsec <nsec> update <naddr> update.json
```

Publishes a new version of the target event. The signer must be an authorized author.

**Input file** (`update.json`):

```json
{
  "content": "Updated content…",
  "tags": [
    ["title", "Updated Title"],
    ["t", "nostr"]
  ]
}
```

## How It Works

This tool implements the [NIP-C1 Collaborative Events](https://github.com/nostr-dev-kit/ndk/tree/feat/nip-c1-collaborative-events) pattern:

1. A **collaborative pointer** (kind 39382) defines the document identity, target kind, and authorized authors
2. **Target events** (e.g. kind 30023 articles) are published by any authorized author
3. The **latest version** (highest `created_at`) from any authorized author is the current state

## Development

```bash
cd cli
npm install
npm run build
node dist/index.js --help
```

## Relays

Events are published to:
- `wss://relay.damus.io`
- `wss://nos.lol`
- `wss://relay.primal.net`
