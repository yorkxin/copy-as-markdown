import { WebExt } from '../webext.js';

document.addEventListener('DOMContentLoaded', async () => {
  const paramPermissions = new URLSearchParams(window.location.search).get('permissions').split(',');

  document.getElementById('close').addEventListener('click', () => {
    window.close();
  });

  document.getElementById('permissions-placeholder').textContent = paramPermissions.join(', ');

  const grantButton = document.getElementById('request-permission');
  if (await WebExt.permissions.allGranted(paramPermissions)) {
    grantButton.disabled = true;
    grantButton.innerText = 'Granted!';
  } else {
    grantButton.addEventListener('click', async () => {
      await WebExt.permissions.request(paramPermissions);
      window.location.reload();
    });
  }
});
