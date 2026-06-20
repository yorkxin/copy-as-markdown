/**
 * Injected by esbuild's `define` at build time (see scripts/lib/build-extension.js) and by
 * vitest's per-project `define` (see vitest.config.ts).
 * `'production'` strips the e2e-only clipboard mock from the bundle; `'e2e'` keeps it.
 * Orthogonal to BUILD_TARGET (platform). Branches gated on this constant are
 * dead-code-eliminated in production builds.
 */
declare const BUILD_PROFILE: 'production' | 'e2e';
