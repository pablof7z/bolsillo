/**
 * Post-install patch for @nostr-dev-kit/svelte
 * 
 * Fixes module-level SvelteMap usage that causes lifecycle_outside_component errors.
 * SvelteMap uses $state internally and cannot be instantiated at module scope.
 * 
 * This patch replaces SvelteMap with standard Map in files where it's used
 * at the module level (outside of component initialization).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const filesToPatch = [
  'node_modules/@nostr-dev-kit/svelte/dist/builders/relay-info.svelte.js',
];

for (const file of filesToPatch) {
  if (!existsSync(file)) {
    console.log(`[patch-ndk] Skipping ${file} (not found)`);
    continue;
  }

  let content = readFileSync(file, 'utf8');
  
  if (!content.includes('SvelteMap')) {
    console.log(`[patch-ndk] ${file} already patched or no SvelteMap found`);
    continue;
  }

  // Remove SvelteMap import
  content = content.replace(/import\s*\{[^}]*SvelteMap[^}]*\}\s*from\s*["']svelte\/reactivity["'];?\n?/g, '');
  
  // Replace new SvelteMap with new Map
  content = content.replace(/new SvelteMap\(\)/g, 'new Map()');
  
  writeFileSync(file, content);
  console.log(`[patch-ndk] Patched ${file}`);
}

console.log('[patch-ndk] Done!');
