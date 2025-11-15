import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '../fixtures';
import { enableMockPermissions, hasPermissions, injectMockPermissionsIntoPage, removeOptionalPermissions } from '../helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPTIONAL_EXTENSION_PATH = path.join(__dirname, '../../../chrome-optional-test');

const REQUEST_URL = (extensionBaseUrl: string) => `${extensionBaseUrl}/dist/static/permissions.html?permissions=tabs`;

test.describe('Permission request page', () => {
  test.use({ extensionPath: OPTIONAL_EXTENSION_PATH });

  test.beforeEach(async ({ serviceWorker }) => {
    await enableMockPermissions(serviceWorker);
    await removeOptionalPermissions(serviceWorker, ['tabs', 'tabGroups']);
  });

  test.afterEach(async ({ serviceWorker }) => {
    await removeOptionalPermissions(serviceWorker, ['tabs', 'tabGroups']);
  });

  test('grants permission when user clicks request button', async ({ context, extensionBaseUrl, serviceWorker }) => {
    const permissionPage = await context.newPage();
    await injectMockPermissionsIntoPage(permissionPage);
    await permissionPage.goto(REQUEST_URL(extensionBaseUrl));

    await expect(permissionPage.locator('body')).toContainText('requires additional permissions: tabs');

    const grantButton = permissionPage.locator('#request-permission');
    await expect(grantButton).toBeEnabled();
    await grantButton.click();
    await expect(grantButton).toBeDisabled();

    const granted = await hasPermissions(serviceWorker, ['tabs']);
    expect(granted).toBeTruthy();

    await permissionPage.close();
  });

  test('close button closes the window', async ({ browserName, context, extensionBaseUrl }) => {
    test.skip(browserName === 'firefox', 'Firefox does not allow closing extension pages that were not script-opened');

    const permissionPage = await context.newPage();
    await injectMockPermissionsIntoPage(permissionPage);
    await permissionPage.goto(REQUEST_URL(extensionBaseUrl));

    const closeButton = permissionPage.locator('#close');
    await expect(closeButton).toBeEnabled();

    const closePromise = permissionPage.waitForEvent('close');
    await closeButton.click();
    await closePromise;

    expect(permissionPage.isClosed()).toBeTruthy();
  });
});
