import CustomFormatsStorage from '../storage/custom-formats-storage.js';

/** @typedef {import('../lib/custom-format.js').Context} CustomFormatContext */

/**
 * @param {string} slot
 * @param {CustomFormatContext} context
 * @param {boolean} visible
 * @returns {Promise<void>}
 */
async function setVisibility(slot, context, visible) {
  const format = await CustomFormatsStorage.get(context, slot);
  format.showInMenus = visible;
  await CustomFormatsStorage.save(context, format.slot, format);
}

/**
 * @param {HTMLInputElement} checkbox
 * @returns {Promise<void>}
 */
async function initCheckbox(checkbox) {
  const slot = checkbox.dataset.customFormatSlot;
  const context = /** @type {CustomFormatContext} */ (checkbox.dataset.customFormatContext);
  const format = await CustomFormatsStorage.get(context, slot);
  if (format.showInMenus) {
    checkbox.setAttribute('checked', 'true');
  }
  checkbox.addEventListener('change', async (e) => {
    await setVisibility(
      format.slot,
      format.context,
      /** @type {HTMLInputElement} */ (e.target).checked,
    );
  });
}

/**
 * @param {import('../lib/custom-format.js').Context} context
 * @returns {Promise<void>}
 */
async function checkCustomFormats(context) {
  const checkboxes = document.querySelectorAll(`input[type='checkbox'][data-custom-format-context='${context}']`);
  const promises = [];
  for (let i = 0; i < checkboxes.length; i += 1) {
    promises.push(initCheckbox(/** @type {HTMLInputElement} */ (checkboxes[i])));
  }

  await Promise.all(promises);
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkCustomFormats('single-link');
  await checkCustomFormats('multiple-links');
});
