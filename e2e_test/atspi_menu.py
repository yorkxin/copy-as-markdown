"""AT-SPI menu helper for walking a browser's accessibility tree.

Serves both the Firefox and Chrome/Chromium suites: native context menus are not
in the DOM, so the menu item is located on the AT-SPI bus by accessible name.

This module is only ever imported inside the Docker image, where the entrypoint
wraps pytest in ``dbus-run-session`` so a live accessibility bus is present.
"""

import time
import gi

gi.require_version("Atspi", "2.0")
from gi.repository import Atspi  # noqa: E402

Atspi.init()

_MENU_ITEM_ROLE = Atspi.Role.MENU_ITEM


def _iter_descendants(node):
    """Depth-first walk of an accessible subtree."""
    try:
        count = node.get_child_count()
    except Exception:
        return
    for i in range(count):
        try:
            child = node.get_child_at_index(i)
        except Exception:
            # A node can go stale mid-walk while the menu tree is changing.
            # Skip the offending child rather than letting the exception escape
            # the find loop and bypass the retry/TimeoutError handling.
            continue
        if child is None:
            continue
        yield child
        yield from _iter_descendants(child)


_BROWSER_APP_HINTS = ("firefox", "chrom")  # "chrom" matches chrome / chromium


def _iter_browser_apps():
    """Yield the browser application nodes on the AT-SPI desktop.

    Matches both Firefox and Chrome/Chromium so the same walk serves both suites.
    Only one browser holds an open menu at a time, and items are matched by exact
    accessible name, so searching every browser app is safe.
    """
    desktop = Atspi.get_desktop(0)
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app is None:
            continue
        name = (app.get_name() or "").lower()
        if any(hint in name for hint in _BROWSER_APP_HINTS):
            yield app


# ASSUMPTION: menu items are flat (direct MENU_ITEM nodes). When a WebExtension
# contributes MORE THAN ONE item to a single context, both Firefox and Chrome
# group them under a "Copy as Markdown" submenu, whose children may not be
# realized until it is opened. This helper does NOT open submenus, so the e2e
# tests use single-item contexts (one extension item per right-click target) to
# keep menus flat. If a future config exposes multiple items per context, extend
# this to locate the submenu node (role MENU) and do_action() to open it before
# searching for the leaf.
def find_menu_item(name: str, timeout: float = 5.0) -> "Atspi.Accessible":
    """Poll the browser's accessibility tree for a menu item with the given name.

    Raises ``TimeoutError`` if no matching menu item is found within *timeout*
    seconds.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        for app in _iter_browser_apps():
            for node in _iter_descendants(app):
                try:
                    if node.get_role() == _MENU_ITEM_ROLE and node.get_name() == name:
                        return node
                except Exception:
                    continue
        time.sleep(0.1)
    raise TimeoutError(f"menu item not found in AT-SPI tree: {name!r}")


def click_menu_item(name: str, timeout: float = 5.0) -> None:
    """Find a menu item by accessible name and invoke its primary action."""
    item = find_menu_item(name, timeout=timeout)
    # GI binding: do_action lives on the Atspi.Action interface.
    if not Atspi.Action.do_action(item, 0):
        raise RuntimeError(f"AT-SPI action failed for menu item: {name!r}")
