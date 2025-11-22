/**
 * Centralized access to optional global flags that may be injected for tests or browser quirks.
 */
function getBooleanFlag(name: string): boolean {
  return (globalThis as Record<string, unknown>)[name] === true;
}

export const Flags = {
  alwaysUseNavigatorClipboard: () => getBooleanFlag('ALWAYS_USE_NAVIGATOR_COPY_API'),
  periodicallyRefreshMenu: () => getBooleanFlag('PERIDOCIALLY_REFRESH_MENU'),
};
