import renderMenu from './menu.js';

document.addEventListener('DOMContentLoaded', () => {
  const menuElement = document.getElementById('menu');
  if (menuElement) {
    renderMenu(menuElement, window.location);
  }
});
