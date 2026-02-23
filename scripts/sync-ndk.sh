#!/bin/bash
# Sync NDK dist files from the worktree to .ndk-local/
# Run this after rebuilding NDK core in the feat/nip-c1-collaborative-events worktree

NDK_DIST="../NDK-nhlteu/.worktrees/feat_nip-c1-collaborative-events/core/dist"
LOCAL_DIR=".ndk-local"

if [ ! -d "$NDK_DIST" ]; then
  echo "Error: NDK dist not found at $NDK_DIST"
  echo "Build NDK core first: cd ../NDK-nhlteu/.worktrees/feat_nip-c1-collaborative-events/core && bun run build"
  exit 1
fi

mkdir -p "$LOCAL_DIR"

cp "$NDK_DIST/index.mjs" "$LOCAL_DIR/"
cp "$NDK_DIST/index.d.mts" "$LOCAL_DIR/"
cp "$NDK_DIST/index.js" "$LOCAL_DIR/"
cp "$NDK_DIST/index.d.ts" "$LOCAL_DIR/"

echo "✓ NDK dist synced to $LOCAL_DIR/"
