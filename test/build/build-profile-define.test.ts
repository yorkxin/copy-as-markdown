import { describe, expect, it } from 'vitest';

// BUILD_PROFILE is an esbuild/vitest compile-time define. In the test runner it MUST be
// 'e2e' so the mock-bearing branches compile and the unit suite exercises them. This guards
// the per-project define in vitest.config.ts (root-level config does not reach test.projects).
describe('BUILD_PROFILE compile-time define', () => { // eslint-disable-line test/prefer-lowercase-title
  it('is defined as "e2e" in the vitest unit project', () => {
    expect(BUILD_PROFILE).toBe('e2e');
  });
});
