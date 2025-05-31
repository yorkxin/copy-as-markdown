import pyautogui
from dataclasses import dataclass
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

@dataclass
class Shortcut:
    label: str
    manifest_key: str
    keystroke: str

    def press(self):
        with pyautogui.hold('shift'):
            with pyautogui.hold('alt'):
                pyautogui.press(self.keystroke)

    def run_action_chain(self, actions: ActionChains):
        return actions.key_down(Keys.ALT).key_down(Keys.SHIFT).send_keys(self.keystroke).key_up(Keys.SHIFT).key_up(Keys.ALT)

class KeyboardShortcuts:
    def __init__(self):
        self.items: list[Shortcut] = []
        self.by_label: dict[str, Shortcut] = {}
        self.by_manifest_key: dict[str, Shortcut] = {}

    def append(self, item: Shortcut):
        self.items.append(item)
        self.by_label[item.label] = item
        self.by_manifest_key[item.manifest_key] = item

    def get_by_label(self, label):
        return self.by_label.get(label)

    def get_by_manifest_key(self, manifest_key):
        return self.by_manifest_key.get(manifest_key)

# NOTE: known shortcut keys that conflict with global shortcuts:
# Alt-Shift-1 on macOS: ChatGPT start pairing

# Define all available shortcuts
ALL_SHORTCUTS = {
    "selection-as-markdown": Shortcut(label="Copy Selection as Markdown", manifest_key="selection-as-markdown", keystroke="0"),
    "current-tab-link": Shortcut(label="current tab: [title](url)", manifest_key="current-tab-link", keystroke="2"),
    "current-tab-custom-format-1": Shortcut(label="current tab: custom format 1", manifest_key="current-tab-custom-format-1", keystroke="3"),
    "current-tab-custom-format-2": Shortcut(label="current tab: custom format 2", manifest_key="current-tab-custom-format-2", keystroke="4"),
    "current-tab-custom-format-3": Shortcut(label="current tab: custom format 3", manifest_key="current-tab-custom-format-3", keystroke="5"),
    "current-tab-custom-format-4": Shortcut(label="current tab: custom format 4", manifest_key="current-tab-custom-format-4", keystroke="6"),
    "current-tab-custom-format-5": Shortcut(label="current tab: custom format 5", manifest_key="current-tab-custom-format-5", keystroke="7"),
    "all-tabs-link-as-list": Shortcut(label="all tabs: - [title](url)", manifest_key="all-tabs-link-as-list", keystroke="8"),
    "all-tabs-link-as-task-list": Shortcut(label="all tabs: - [ ] [title](url)", manifest_key="all-tabs-link-as-task-list", keystroke="9"),
    "all-tabs-title-as-list": Shortcut(label="all tabs: - title", manifest_key="all-tabs-title-as-list", keystroke="a"),
    # skipping b to avoid conflict with Firefox's menu shortcut
    "all-tabs-url-as-list": Shortcut(label="all tabs: - url", manifest_key="all-tabs-url-as-list", keystroke="c"),
    "highlighted-tabs-link-as-list": Shortcut(label="selected tabs: - [title](url)", manifest_key="highlighted-tabs-link-as-list", keystroke="d"),
    # skipping e and f to avoid conflict with Firefox's menu shortcut
    "highlighted-tabs-link-as-task-list": Shortcut(label="selected tabs: - [ ] [title](url)", manifest_key="highlighted-tabs-link-as-task-list", keystroke="g"),
    # skipping h to avoid conflict with Firefox's menu shortcut
    "highlighted-tabs-title-as-list": Shortcut(label="selected tabs: - title", manifest_key="highlighted-tabs-title-as-list", keystroke="i"),
    "highlighted-tabs-url-as-list": Shortcut(label="selected tabs: - url", manifest_key="highlighted-tabs-url-as-list", keystroke="j"),
    "all-tabs-custom-format-1": Shortcut(label="all tabs: custom format 1", manifest_key="all-tabs-custom-format-1", keystroke="k"),
    "all-tabs-custom-format-2": Shortcut(label="all tabs: custom format 2", manifest_key="all-tabs-custom-format-2", keystroke="l"),
    "all-tabs-custom-format-3": Shortcut(label="all tabs: custom format 3", manifest_key="all-tabs-custom-format-3", keystroke="m"),
    "all-tabs-custom-format-4": Shortcut(label="all tabs: custom format 4", manifest_key="all-tabs-custom-format-4", keystroke="n"),
    "all-tabs-custom-format-5": Shortcut(label="all tabs: custom format 5", manifest_key="all-tabs-custom-format-5", keystroke="o"),
    "highlighted-tabs-custom-format-1": Shortcut(label="selected tabs: custom format 1", manifest_key="highlighted-tabs-custom-format-1", keystroke="p"),
    "highlighted-tabs-custom-format-2": Shortcut(label="selected tabs: custom format 2", manifest_key="highlighted-tabs-custom-format-2", keystroke="q"),
    "highlighted-tabs-custom-format-3": Shortcut(label="selected tabs: custom format 3", manifest_key="highlighted-tabs-custom-format-3", keystroke="r"),
    # skipping s and t to avoid conflict with Firefox's menu shortcut
    "highlighted-tabs-custom-format-4": Shortcut(label="selected tabs: custom format 4", manifest_key="highlighted-tabs-custom-format-4", keystroke="u"),
    # skipping v to avoid conflict with Firefox's menu shortcut
    "highlighted-tabs-custom-format-5": Shortcut(label="selected tabs: custom format 5", manifest_key="highlighted-tabs-custom-format-5", keystroke="w")
}


def init_keyboard_shortcuts(shortcut_keys=None):
    """Initialize keyboard shortcuts configuration
    
    Args:
        shortcut_keys: List of shortcut keys to initialize. If None, initialize all shortcuts.
    """
    index_shortcuts = KeyboardShortcuts()
    
    if shortcut_keys is None:
        shortcuts = list(ALL_SHORTCUTS.values())
    else:
        shortcuts = [ALL_SHORTCUTS[key] for key in shortcut_keys if key in ALL_SHORTCUTS]

    for shortcut in shortcuts:
        index_shortcuts.append(shortcut)

    return index_shortcuts 