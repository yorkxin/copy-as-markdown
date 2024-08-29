import CustomFormatsStorage from '../storage/custom-formats-storage.js';

async function setVisibility(slot, context, visible) {
  const format = await CustomFormatsStorage.get(context, slot);
  format.showInPopupMenu = visible;
  await CustomFormatsStorage.save(context, format.slot, format);
}

async function initCheckbox(checkbox) {
  const slot = checkbox.dataset.customFormatSlot;
  const context = checkbox.dataset.customFormatContext;
  const format = await CustomFormatsStorage.get(context, slot);
  if (format.showInPopupMenu) {
    checkbox.setAttribute('checked', true);
  }
  checkbox.addEventListener('change', async (e) => {
    await setVisibility(format.slot, format.context, e.target.checked);
  });
}

async function checkCustomFormats(context) {
  const checkboxes = document.querySelectorAll(`input[type='checkbox'][data-custom-format-context='${context}']`);
  const promises = [];
  for (let i = 0; i < checkboxes.length; i += 1) {
    promises.push(initCheckbox(checkboxes[i]));
  }

  await Promise.all(promises);
}

document.addEventListener('DOMContentLoaded', async () => {
  await checkCustomFormats('single-tab');
  await checkCustomFormats('multiple-tabs');
});
