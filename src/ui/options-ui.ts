import renderMenu from './menu';

document.addEventListener('DOMContentLoaded', () => {
  const menuElement = document.getElementById('menu');
  if (menuElement) {
    renderMenu(menuElement, window.location);
  }
});
