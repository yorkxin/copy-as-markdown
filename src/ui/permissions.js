document.addEventListener('DOMContentLoaded', async () => {
  const permissions = new URLSearchParams(window.location.search).get('permissions').split(',');

  document.getElementById('close').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('permissions-placeholder').textContent = permissions.join(', ');

  const grantButton = /** @type {HTMLButtonElement} */ (document.getElementById('request-permission'));
  if (await browser.permissions.contains({ permissions })) {
    grantButton.disabled = true;
    grantButton.innerText = 'Granted!';
  } else {
    grantButton.addEventListener('click', async () => {
      await browser.permissions.request({ permissions });
      window.location.reload();
    });
  }
});
