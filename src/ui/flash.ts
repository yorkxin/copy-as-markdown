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
