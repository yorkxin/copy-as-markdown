/**
 * URL Cleaner - Removes tracking parameters from URLs
 *
 * This module provides functionality to clean URLs by removing
 * common tracking parameters (e.g., spm, utm_*, etc.)
 */

/**
 * Default list of tracking parameters to remove from URLs.
 * These are common tracking parameters used by various platforms.
 */
export const DEFAULT_TRACKING_PARAMS: string[] = [
  // Alibaba/Aliyun tracking
  'spm',
  'scm',
  // DingTalk tracking
  '_dt_ac',
  '_dt_sig',
  '_dt_ts',
  // Google Analytics UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  // Facebook
  'fbclid',
  // Google Ads
  'gclid',
  'gclsrc',
  // Microsoft/Bing
  'msclkid',
  // Twitter
  'twclid',
  // TikTok
  'ttclid',
  // Other common tracking params
  '_ga',
  '_gl',
  'mc_cid',
  'mc_eid',
];

/**
 * Removes specified tracking parameters from a URL.
 *
 * @param url - The URL to clean
 * @param paramsToRemove - List of parameter names to remove (case-insensitive)
 * @returns The cleaned URL, or the original URL if parsing fails
 *
 * @example
 * ```typescript
 * cleanUrl('https://example.com?spm=123&id=456')
 * // Returns: 'https://example.com?id=456'
 *
 * cleanUrl('https://example.com?utm_source=google&page=1', ['utm_source'])
 * // Returns: 'https://example.com?page=1'
 * ```
 */
export function cleanUrl(
  url: string,
  paramsToRemove: string[] = DEFAULT_TRACKING_PARAMS,
): string {
  // Return original URL if it's empty or invalid
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    const urlObj = new URL(url);

    // Create a set of lowercase param names for case-insensitive matching
    const paramsToRemoveSet = new Set(
      paramsToRemove.map(p => p.toLowerCase()),
    );

    // Collect params to delete (can't modify while iterating)
    const keysToDelete: string[] = [];
    urlObj.searchParams.forEach((_, key) => {
      if (paramsToRemoveSet.has(key.toLowerCase())) {
        keysToDelete.push(key);
      }
    });

    // Delete the tracking params
    keysToDelete.forEach(key => urlObj.searchParams.delete(key));

    return urlObj.toString();
  }
  catch {
    // If URL parsing fails, return the original URL unchanged
    return url;
  }
}

/**
 * Creates a URL cleaner function with pre-configured parameters.
 *
 * @param paramsToRemove - List of parameter names to remove
 * @returns A function that cleans URLs using the specified parameters
 *
 * @example
 * ```typescript
 * const cleaner = createUrlCleaner(['spm', 'utm_source']);
 * cleaner('https://example.com?spm=123&id=456');
 * // Returns: 'https://example.com?id=456'
 * ```
 */
export function createUrlCleaner(
  paramsToRemove: string[] = DEFAULT_TRACKING_PARAMS,
): (url: string) => string {
  return (url: string) => cleanUrl(url, paramsToRemove);
}
