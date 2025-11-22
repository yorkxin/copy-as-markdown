import { html, render } from '../vendor/uhtml.js';
import type { TabGroupIndentationStyle, UnorderedListStyle } from '../lib/markdown.js';
import Settings from '../lib/settings.js';
import * as lib from './lib.js';
import { PermissionStatusValue } from './lib.js';
import { menuView } from './menu.js';

interface OptionsState {
  ready: boolean;
  flashMessage: string;
  settings: {
    alwaysEscapeLinkBrackets: boolean;
    styleOfUnorderedList: UnorderedListStyle;
    styleOfTabGroupIndentation: TabGroupIndentationStyle;
  };
  permissions: lib.PermissionStatus;
}

const root = document.getElementById('options-root') ?? document.body;

const defaultSettings = {
  alwaysEscapeLinkBrackets: false,
  styleOfUnorderedList: 'dash' as UnorderedListStyle,
  styleOfTabGroupIndentation: 'spaces' as TabGroupIndentationStyle,
};

let state: OptionsState = {
  ready: false,
  flashMessage: '',
  settings: defaultSettings,
  permissions: new Map(),
};

function setState(next: Partial<OptionsState>): void {
  state = { ...state, ...next };
  render(root, view(state));
}

function view(s: OptionsState) {
  const tabGroupsAllowed = s.permissions.get('tabGroups') === PermissionStatusValue.Yes;
  const disableAll = !s.ready;
  return html`
  <div class="container section is-max-desktop">
    <h1 class="title">Copy as Markdown</h1>
    ${s.flashMessage
      ? html`<div class="notification is-danger">
          <button class="delete" aria-label="Close notification" onclick=${() => setState({ flashMessage: '' })}></button>
          ${s.flashMessage}
        </div>`
      : null}
    <div class="columns">
      <div class="column is-narrow" id="menu">
        ${menuView(window.location)}
      </div>
      <div class="column">
        <div class="box content">
          <h2 class="title is-3">Markdown Style</h2>
          <form class="field">
            <label class="label">Unordered List Character</label>
            <div class="control">
              <label class="radio">
                <input
                  type="radio"
                  name="character"
                  value="dash"
                  checked=${s.settings.styleOfUnorderedList === 'dash'}
                  disabled=${disableAll}
                  onchange=${(e: Event) => onChangeUnorderedList((e.target as HTMLInputElement).value as UnorderedListStyle)}
                />
                Dashes (<code>-</code>)
              </label>
            </div>
            <div class="control">
              <label class="radio">
                <input
                  type="radio"
                  name="character"
                  value="asterisk"
                  checked=${s.settings.styleOfUnorderedList === 'asterisk'}
                  disabled=${disableAll}
                  onchange=${(e: Event) => onChangeUnorderedList((e.target as HTMLInputElement).value as UnorderedListStyle)}
                />
                Asterisks (<code>*</code>)
              </label>
            </div>
            <div class="control">
              <label class="radio">
                <input
                  type="radio"
                  name="character"
                  value="plus"
                  checked=${s.settings.styleOfUnorderedList === 'plus'}
                  disabled=${disableAll}
                  onchange=${(e: Event) => onChangeUnorderedList((e.target as HTMLInputElement).value as UnorderedListStyle)}
                />
                Plus Signs (<code>+</code>)
              </label>
            </div>
          </form>

          <form class="field">
            <label class="label">Tab Group Indentation <span class="tag" data-hide-if-permission-contains="tabGroups">Requires Permission</span></label>
            <div class="control">
              <label class="radio">
                <input
                  type="radio"
                  name="indentation"
                  value="spaces"
                  checked=${s.settings.styleOfTabGroupIndentation === 'spaces'}
                  disabled=${disableAll || !tabGroupsAllowed}
                  onchange=${(e: Event) => onChangeTabGroupIndent((e.target as HTMLInputElement).value as TabGroupIndentationStyle)}
                />
                Spaces
              </label>
            </div>
            <div class="control">
              <label class="radio">
                <input
                  type="radio"
                  name="indentation"
                  value="tab"
                  checked=${s.settings.styleOfTabGroupIndentation === 'tab'}
                  disabled=${disableAll || !tabGroupsAllowed}
                  onchange=${(e: Event) => onChangeTabGroupIndent((e.target as HTMLInputElement).value as TabGroupIndentationStyle)}
                />
                Tab
              </label>
            </div>
            <p class="help">
              CommonMark uses spaces to indent nested lists, which are used when exporting tabs along with tab groups.
              The number of spaces required depends on the leading characters of the parent item.
              If your Markdown processor prefers <kbd>tab</kbd> (<code>\t</code>) characters for indentation,
              choose <strong>Tab</strong> so that Copy as Markdown outputs tabs for indentation.
              Please note that this option does not affect indentations in the output of Copy Selection as Markdown.
            </p>
          </form>

          <form class="field">
            <label class="label">Escaping</label>
            <div class="control">
              <label class="checkbox">
                <input
                  type="checkbox"
                  name="enabled"
                  checked=${s.settings.alwaysEscapeLinkBrackets}
                  disabled=${disableAll}
                  onchange=${(e: Event) => onChangeEscape((e.target as HTMLInputElement).checked)}
                />
                Always escape brackets in link text (<code>[]</code> becomes <code>\[\]</code>)
              </label>
            </div>
            <p class="help">
              CommonMark allows balanced brackets <code>[]</code> in link text
              (e.g. <code>[[JIRA-123] My Project](https://link/)</code>).
              If your Markdown processor does not support this use case, you can enable this feature
              so that Copy as Markdown always escape brackets in the link text.
            </p>
          </form>
        </div>
        <div class="field is-grouped">
          <div class="control">
            <button
              id="reset"
              type="button"
              class="button is-outlined is-danger"
              disabled=${disableAll}
              onclick=${onReset}
            >
              Restore to Default
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;
}

async function onChangeEscape(checked: boolean): Promise<void> {
  try {
    setState({ settings: { ...state.settings, alwaysEscapeLinkBrackets: checked }, flashMessage: '' });
    await Settings.setLinkTextAlwaysEscapeBrackets(checked);
  } catch (error) {
    console.error('failed to save settings:', error);
    setState({ flashMessage: 'Failed to save setting. Please try again.' });
  }
}

async function onChangeUnorderedList(value: UnorderedListStyle): Promise<void> {
  try {
    setState({ settings: { ...state.settings, styleOfUnorderedList: value }, flashMessage: '' });
    await Settings.setStyleOfUnrderedList(value);
  } catch (error) {
    console.error('failed to save settings:', error);
    setState({ flashMessage: 'Failed to save setting. Please try again.' });
  }
}

async function onChangeTabGroupIndent(value: TabGroupIndentationStyle): Promise<void> {
  try {
    setState({ settings: { ...state.settings, styleOfTabGroupIndentation: value }, flashMessage: '' });
    await Settings.setStyleTabGroupIndentation(value);
  } catch (error) {
    console.error('failed to save settings:', error);
    setState({ flashMessage: 'Failed to save setting. Please try again.' });
  }
}

async function onReset(): Promise<void> {
  try {
    await Settings.reset();
    await loadSettingsAndPermissions();
    setState({ flashMessage: '' });
  } catch (error) {
    console.error('failed to reset settings:', error);
    setState({ flashMessage: 'Failed to reset settings. Please try again.' });
  }
}

async function loadSettingsAndPermissions(): Promise<void> {
  setState({ ready: false });
  const [settings, permissions] = await Promise.all([
    Settings.getAll(),
    lib.loadPermissions(),
  ]);
  setState({
    settings,
    permissions,
    ready: true,
  });
}

browser.storage.sync.onChanged.addListener(async (changes) => {
  const hasSettingsChanged = Object.keys(changes).some(key => Settings.keys.includes(key));
  if (hasSettingsChanged) {
    await loadSettingsAndPermissions();
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  render(root, view(state));
  try {
    await loadSettingsAndPermissions();
  } catch (error) {
    console.error('error getting settings', error);
    setState({ flashMessage: 'Failed to load settings. Please try again.' });
  }
});
