/**
 * Utilities for URL manipulation.
 */

/**
 * Decodes percent-encoded sequences in a URL, except for spaces (%20) and parentheses (%28, %29).
 *
 * This function decodes Unicode characters and other percent-encoded sequences while keeping
 * spaces and parentheses encoded to maintain Markdown compatibility.
 *
 * @param url - The URL to decode
 * @returns The URL with selective decoding applied
 * @example
 *   selectivelyDecodeUrl('https://example.com/%E4%B8%AD%E6%96%87%20test%28%29')
 *   // => 'https://example.com/中文%20test%28%29'
 */
export function selectivelyDecodeUrl(url: string): string {
  try {
    // First decode the entire URL
    const decoded = decodeURIComponent(url);

    // Re-encode spaces and parentheses
    return decoded.replace(/[ ()]/g, (char) => {
      switch (char) {
        case ' ':
          return '%20';
        case '(':
          return '%28';
        case ')':
          return '%29';
        default:
          // Should never happen due to regex pattern
          return char;
      }
    });
  } catch {
    // If decodeURIComponent fails (malformed sequence), return original URL
    return url;
  }
}
