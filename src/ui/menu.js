const menuTemplate = `      
<aside class="menu">
  <p class="menu-label">General</p>
  <ul class="menu-list">
    <li><a href="options.html">Markdown Style</a></li>
    <li><a href="options-permissions.html">Permissions</a></li>
    <p class="menu-label">Formats</p>
    <li>
      <a href="multiple-tabs.html">Multiple Tabs</a>
      <ul class="menu-list" data-menu-custom-format-context="multiple-tabs">
        <li><a data-menu-custom-format-slot="1" href="custom-format.html?context=multiple-tabs&slot=1">Custom Format 1</a></li>
        <li><a data-menu-custom-format-slot="2" href="custom-format.html?context=multiple-tabs&slot=2">Custom Format 2</a></li>
        <li><a data-menu-custom-format-slot="3" href="custom-format.html?context=multiple-tabs&slot=3">Custom Format 3</a></li>
        <li><a data-menu-custom-format-slot="4" href="custom-format.html?context=multiple-tabs&slot=4">Custom Format 4</a></li>
        <li><a data-menu-custom-format-slot="5" href="custom-format.html?context=multiple-tabs&slot=5">Custom Format 5</a></li>
      </ul>
    </li>
    <li>
      <a href="single-link.html">Single Link</a>
      <ul class="menu-list" data-menu-custom-format-context="single-link">
        <li><a data-menu-custom-format-slot="1" href="custom-format.html?context=single-link&slot=1">Custom Format 1</a></li>
        <li><a data-menu-custom-format-slot="2" href="custom-format.html?context=single-link&slot=2">Custom Format 2</a></li>
        <li><a data-menu-custom-format-slot="3" href="custom-format.html?context=single-link&slot=3">Custom Format 3</a></li>
        <li><a data-menu-custom-format-slot="4" href="custom-format.html?context=single-link&slot=4">Custom Format 4</a></li>
        <li><a data-menu-custom-format-slot="5" href="custom-format.html?context=single-link&slot=5">Custom Format 5</a></li>
      </ul>
    </li>
  </ul>
  <p class="menu-label">Others</p>
  <ul class="menu-list">
    <li><a href="custom-format-help.html">Help & Examples</a></li>
    <li><a href="about.html">About</a></li>
  </ul>
</aside>
`;

/**
 *
 * @param container {Node}
 * @param loc {Location}
 */
export default function renderMenu(container, loc) {
  const parser = new DOMParser();
  const menu = parser.parseFromString(menuTemplate, 'text/html');
  const segs = loc.pathname.split('/');
  const path = segs[segs.length - 1];
  const query = new URLSearchParams(loc.search);
  /** @type {HTMLElement} */
  let active = null;
  if (path === 'custom-format.html') {
    const context = query.get('context');
    const slot = query.get('slot');
    active = menu.querySelector(`[data-menu-custom-format-context='${context}'] a[data-menu-custom-format-slot="${slot}"]`);
  } else {
    active = menu.querySelector(`a[href='${path}']`);
  }
  if (active) {
    active.classList.add('is-active');
  }
  container.appendChild(menu.body.firstChild);
}
