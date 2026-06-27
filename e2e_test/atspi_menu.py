"""AT-SPI menu helper for walking Firefox's accessibility tree.

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


def _find_firefox_app():
    desktop = Atspi.get_desktop(0)
    for i in range(desktop.get_child_count()):
        app = desktop.get_child_at_index(i)
        if app is not None and "firefox" in (app.get_name() or "").lower():
            return app
    return None


def find_menu_item(name: str, timeout: float = 5.0) -> "Atspi.Accessible":
    """Poll Firefox's accessibility tree for a menu item with the given name.

    Raises ``TimeoutError`` if no matching menu item is found within *timeout*
    seconds.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        app = _find_firefox_app()
        if app is not None:
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
    Atspi.Action.do_action(item, 0)
