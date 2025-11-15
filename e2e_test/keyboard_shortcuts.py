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

    def toFirefoxShortcut(self):
        return "Alt+Shift+" + self.keystroke.upper()

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
    "all-tabs-link-as-list": Shortcut(label="all tabs: - [title](url)", manifest_key="all-tabs-link-as-list", keystroke="8"),
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
