import { html, render } from '../vendor/uhtml.js';

function menuView(loc: Location) {
  const segs = loc.pathname.split('/');
  const path = segs[segs.length - 1];
  const query = new URLSearchParams(loc.search);

  const isActive = (href: string) => path === href;
  const isCustomActive = (context: string, slot: string) =>
    path === 'custom-format.html'
    && query.get('context') === context
    && query.get('slot') === slot;

  const customLinks = (context: 'multiple-links' | 'single-link') => [1, 2, 3, 4, 5].map(slot => html`
    <li>
      <a class=${isCustomActive(context, String(slot)) ? 'is-active' : null}
        data-menu-custom-format-slot=${slot}
        href=${`custom-format.html?context=${context}&slot=${slot}`}>
        Custom Format ${slot}
      </a>
    </li>
  `);

  return html`
    <aside class="menu">
      <p class="menu-label">General</p>
      <ul class="menu-list">
        <li><a class=${isActive('options.html') ? 'is-active' : null} href="options.html">Markdown Style</a></li>
        <li><a class=${isActive('options-permissions.html') ? 'is-active' : null} href="options-permissions.html">Permissions</a></li>
        <p class="menu-label">Formats</p>
        <li>
          <a class=${isActive('multiple-links.html') ? 'is-active' : null} href="multiple-links.html">Multiple Links</a>
          <ul class="menu-list" data-menu-custom-format-context="multiple-links">
            ${customLinks('multiple-links')}
          </ul>
        </li>
        <li>
          <a class=${isActive('single-link.html') ? 'is-active' : null} href="single-link.html">Single Link</a>
          <ul class="menu-list" data-menu-custom-format-context="single-link">
            ${customLinks('single-link')}
          </ul>
        </li>
      </ul>
      <p class="menu-label">Others</p>
      <ul class="menu-list">
        <li><a class=${isActive('custom-format-help.html') ? 'is-active' : null} href="custom-format-help.html">Help & Examples</a></li>
        <li><a class=${isActive('about.html') ? 'is-active' : null} href="about.html">About</a></li>
      </ul>
    </aside>
  `;
}

export function renderMenu(container: Element | DocumentFragment, loc: Location): void {
  render(container, menuView(loc));
}

export default renderMenu;
export { menuView };
