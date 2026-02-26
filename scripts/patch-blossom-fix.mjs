/**
 * Patch @nostr-dev-kit/blossom dist files to fix broken relative imports.
 *
 * The published blossom package has internal imports without the .js extension
 * (e.g. `from "../utils/http"` instead of `from "../utils/http.js"`), which
 * causes Rollup/Vite to fail in strict ESM mode.
 *
 * This script adds the missing .js extension while preserving the correct
 * relative path prefixes (./  or  ../).
 *
 * It is run automatically via the `postinstall` npm/bun hook.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const blossomDistPath = join(__dirname, '../node_modules/@nostr-dev-kit/blossom/dist');

function findJsFiles(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsFiles(fullPath));
    } else if (entry.name.endsWith('.js') && !entry.name.endsWith('.map.js') && !entry.name.endsWith('.bak')) {
      files.push(fullPath);
    }
  }
  return files;
}

try {
  const files = findJsFiles(blossomDistPath);
  let patchedCount = 0;

  for (const filePath of files) {
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;

    // Fix relative imports missing .js extension.
    // Correctly preserves the full prefix (  ./  or  ../ ).
    //
    // Matches:  from "./foo"  or  from "../foo"  or  from "../../foo"
    // where the import path does NOT already end in .js
    content = content.replace(
      /from "((?:\.\.?\/)+)([^"]+)"/g,
      (match, prefix, rest) => {
        if (!rest.endsWith('.js')) {
          modified = true;
          return `from "${prefix}${rest}.js"`;
        }
        return match;
      }
    );

    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      patchedCount++;
      const relativePath = filePath.replace(blossomDistPath, '');
      console.log(`[patch-blossom-fix] Fixed imports in: ${relativePath}`);
    }
  }

  if (patchedCount === 0) {
    console.log('[patch-blossom-fix] No files needed patching (already correct).');
  } else {
    console.log(`[patch-blossom-fix] Patched ${patchedCount} file(s).`);
  }
} catch (error) {
  console.error('[patch-blossom-fix] Error:', error.message);
  process.exit(1);
}
