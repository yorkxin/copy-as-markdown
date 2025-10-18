/**
 * Shared type definitions used across multiple services
 */

/**
 * Markdown formatter interface for creating markdown-formatted text
 */
export interface MarkdownFormatter {
  /**
   * Escape special characters in link text
   */
  escapeLinkText: (text: string) => string;

  /**
   * Create a markdown link
   */
  linkTo: (title: string, url: string) => string;

  /**
   * Create a markdown unordered list
   */
  list: (items: any[]) => string;

  /**
   * Create a markdown task list
   */
  taskList: (items: any[]) => string;
}

/**
 * Custom format template
 */
export interface CustomFormat {
  /**
   * Render the custom format with the given input data
   */
  render: (input: any) => string;
}

/**
 * Provider for retrieving custom format templates
 */
export interface CustomFormatsProvider {
  /**
   * Get a custom format by context and slot
   * @param context - The context: 'single-link' for single links, 'multiple-links' for tab lists
   * @param slot - The slot number (e.g., '1', '2', '3')
   */
  get: (context: 'single-link' | 'multiple-links', slot: string) => Promise<CustomFormat>;
}
