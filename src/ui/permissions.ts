document.addEventListener('DOMContentLoaded', async () => {
  const permissionsParam = new URLSearchParams(window.location.search).get('permissions');
  if (!permissionsParam) {
    throw new Error('Missing permissions parameter');
  }

  const permissions = permissionsParam.split(',') as browser._manifest.OptionalPermission[];

  const closeButton = document.getElementById('close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      window.close();
    });
  }

  const permissionsPlaceholder = document.getElementById('permissions-placeholder');
  if (permissionsPlaceholder) {
    permissionsPlaceholder.textContent = permissions.join(', ');
  }

  const grantButton = document.getElementById('request-permission') as HTMLButtonElement | null;
  if (grantButton) {
    if (await browser.permissions.contains({ permissions })) {
      grantButton.disabled = true;
      grantButton.innerText = 'Granted!';
    } else {
      grantButton.addEventListener('click', async () => {
        await browser.permissions.request({ permissions });
        window.location.reload();
      });
    }
  }
});
