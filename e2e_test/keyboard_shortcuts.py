import pyautogui
from dataclasses import dataclass

class KeyboardShortcuts:
    def __init__(self):
        self.items = []
        self.by_label = {}
        self.by_manifest_key = {}

    def append(self, item):
        self.items.append(item)
        self.by_label[item.label] = item
        self.by_manifest_key[item.manifest_key] = item

    def get_by_label(self, label):
        return self.by_label.get(label)

    def get_by_manifest_key(self, manifest_key):
        return self.by_manifest_key.get(manifest_key)


@dataclass
class Shortcut:
    label: str
    manifest_key: str
    keystroke: str

    def press(self):
        with pyautogui.hold('shift'):
            with pyautogui.hold('alt'):
                pyautogui.press(self.keystroke)


# Define all available shortcuts
ALL_SHORTCUTS = {
    "selection-as-markdown": Shortcut(label="Copy Selection as Markdown", manifest_key="selection-as-markdown", keystroke="1"),
    "current-tab-link": Shortcut(label="current tab: [title](url)", manifest_key="current-tab-link", keystroke="2"),
    "current-tab-custom-format-1": Shortcut(label="current tab: custom format 1", manifest_key="current-tab-custom-format-1", keystroke="3"),
    "current-tab-custom-format-2": Shortcut(label="current tab: custom format 2", manifest_key="current-tab-custom-format-2", keystroke="4"),
    "current-tab-custom-format-3": Shortcut(label="current tab: custom format 3", manifest_key="current-tab-custom-format-3", keystroke="5"),
    "current-tab-custom-format-4": Shortcut(label="current tab: custom format 4", manifest_key="current-tab-custom-format-4", keystroke="6"),
    "current-tab-custom-format-5": Shortcut(label="current tab: custom format 5", manifest_key="current-tab-custom-format-5", keystroke="7"),
    "all-tabs-link-as-list": Shortcut(label="all tabs: - [title](url)", manifest_key="all-tabs-link-as-list", keystroke="8"),
    "all-tabs-link-as-task-list": Shortcut(label="all tabs: - [ ] [title](url)", manifest_key="all-tabs-link-as-task-list", keystroke="9"),
    "all-tabs-title-as-list": Shortcut(label="all tabs: - title", manifest_key="all-tabs-title-as-list", keystroke="q"),
    "all-tabs-url-as-list": Shortcut(label="all tabs: - url", manifest_key="all-tabs-url-as-list", keystroke="w"),
    "highlighted-tabs-link-as-list": Shortcut(label="selected tabs: - [title](url)", manifest_key="highlighted-tabs-link-as-list", keystroke="e"),
    "highlighted-tabs-link-as-task-list": Shortcut(label="selected tabs: - [ ] [title](url)", manifest_key="highlighted-tabs-link-as-task-list", keystroke="r"),
    "highlighted-tabs-title-as-list": Shortcut(label="selected tabs: - title", manifest_key="highlighted-tabs-title-as-list", keystroke="t"),
    "highlighted-tabs-url-as-list": Shortcut(label="selected tabs: - url", manifest_key="highlighted-tabs-url-as-list", keystroke="y"),
    "all-tabs-custom-format-1": Shortcut(label="all tabs: custom format 1", manifest_key="all-tabs-custom-format-1", keystroke="u"),
    "all-tabs-custom-format-2": Shortcut(label="all tabs: custom format 2", manifest_key="all-tabs-custom-format-2", keystroke="i"),
    "all-tabs-custom-format-3": Shortcut(label="all tabs: custom format 3", manifest_key="all-tabs-custom-format-3", keystroke="o"),
    "all-tabs-custom-format-4": Shortcut(label="all tabs: custom format 4", manifest_key="all-tabs-custom-format-4", keystroke="p"),
    "all-tabs-custom-format-5": Shortcut(label="all tabs: custom format 5", manifest_key="all-tabs-custom-format-5", keystroke="a"),
    "highlighted-tabs-custom-format-1": Shortcut(label="selected tabs: custom format 1", manifest_key="highlighted-tabs-custom-format-1", keystroke="s"),
    "highlighted-tabs-custom-format-2": Shortcut(label="selected tabs: custom format 2", manifest_key="highlighted-tabs-custom-format-2", keystroke="d"),
    "highlighted-tabs-custom-format-3": Shortcut(label="selected tabs: custom format 3", manifest_key="highlighted-tabs-custom-format-3", keystroke="f"),
    "highlighted-tabs-custom-format-4": Shortcut(label="selected tabs: custom format 4", manifest_key="highlighted-tabs-custom-format-4", keystroke="g"),
    "highlighted-tabs-custom-format-5": Shortcut(label="selected tabs: custom format 5", manifest_key="highlighted-tabs-custom-format-5", keystroke="h")
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