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

// Patch NDK signature verification for @noble/curves v2 compatibility.
// NDK v3 passes hex strings to schnorr.verify(), but @noble/curves v2
// requires Uint8Array. This converts hex strings to bytes before verification.
// We patch both CJS (index.js) and ESM (index.mjs) since Vite uses the ESM entry.
const ndkDistFiles = [
  'node_modules/@nostr-dev-kit/ndk/dist/index.js',
  'node_modules/@nostr-dev-kit/ndk/dist/index.mjs',
];

// Patterns for CJS and ESM variants of the same line
const verifyPatterns = [
  // CJS: import_secp256k1.schnorr.verify(this.sig, hash, this.pubkey)
  {
    old: 'import_secp256k1.schnorr.verify(this.sig, hash, this.pubkey)',
    new: `(() => { const _h2b = (h) => Uint8Array.from(h.match(/.{1,2}/g).map(b => parseInt(b, 16))); return import_secp256k1.schnorr.verify(typeof this.sig === 'string' ? _h2b(this.sig) : this.sig, hash, typeof this.pubkey === 'string' ? _h2b(this.pubkey) : this.pubkey); })()`,
  },
  // ESM: schnorr.verify(this.sig, hash, this.pubkey)
  {
    old: 'schnorr.verify(this.sig, hash, this.pubkey)',
    new: `(() => { const _h2b = (h) => Uint8Array.from(h.match(/.{1,2}/g).map(b => parseInt(b, 16))); return schnorr.verify(typeof this.sig === 'string' ? _h2b(this.sig) : this.sig, hash, typeof this.pubkey === 'string' ? _h2b(this.pubkey) : this.pubkey); })()`,
  },
];

for (const ndkFile of ndkDistFiles) {
  if (!existsSync(ndkFile)) {
    console.log(`[patch-ndk] Skipping ${ndkFile} (not found)`);
    continue;
  }

  let content = readFileSync(ndkFile, 'utf8');
  let patched = false;

  for (const pattern of verifyPatterns) {
    if (content.includes(pattern.old) && !content.includes('_h2b')) {
      content = content.replace(pattern.old, pattern.new);
      patched = true;
    }
  }

  if (patched) {
    writeFileSync(ndkFile, content);
    console.log(`[patch-ndk] Patched ${ndkFile} for @noble/curves v2 sig verification`);
  } else {
    console.log(`[patch-ndk] ${ndkFile} already patched or pattern not found`);
  }
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
