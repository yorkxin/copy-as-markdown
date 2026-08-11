/**
 * The shared `#flash-error` banner every options page carries.
 *
 * Pages call these instead of poking at the element so the settings error
 * feedback stays identical across pages.
 */

function flashElement(): HTMLElement | null {
  return document.getElementById('flash-error');
}

export function showFlash(message: string): void {
  const flash = flashElement();
  if (!flash) return;
  flash.classList.remove('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = message;
}

export function hideFlash(): void {
  const flash = flashElement();
  if (!flash) return;
  flash.classList.add('is-hidden');
  const p = flash.querySelector('p');
  if (p) p.textContent = '';
}
