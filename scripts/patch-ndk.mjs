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

// Also patch @noble/curves for nostr-tools compatibility
const curvesPackageFile = 'node_modules/@noble/curves/package.json';
if (existsSync(curvesPackageFile)) {
  const pkg = JSON.parse(readFileSync(curvesPackageFile, 'utf8'));
  if (!pkg.exports['./esm/secp256k1']) {
    pkg.exports['./esm/secp256k1'] = { import: './secp256k1.js', default: './secp256k1.js' };
    pkg.exports['./esm/ed25519'] = { import: './ed25519.js', default: './ed25519.js' };
    writeFileSync(curvesPackageFile, JSON.stringify(pkg, null, 2));
    console.log('[patch-ndk] Patched @noble/curves package.json for esm subpath compat');
  }
}

// Patch @noble/hashes for sha256 compat
const hashesPackageFile = 'node_modules/@noble/hashes/package.json';
if (existsSync(hashesPackageFile)) {
  const pkg = JSON.parse(readFileSync(hashesPackageFile, 'utf8'));
  if (!pkg.exports['./sha256']) {
    pkg.exports['./sha256'] = pkg.exports['./sha2'];
    writeFileSync(hashesPackageFile, JSON.stringify(pkg, null, 2));
    console.log('[patch-ndk] Patched @noble/hashes package.json for sha256 compat');
  }
}

console.log('[patch-ndk] Done!');
