import renderMenu from './menu.js';

document.addEventListener('DOMContentLoaded', () => {
  renderMenu(document.getElementById('menu'), window.location);
});
