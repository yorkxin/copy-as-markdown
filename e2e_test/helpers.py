import time
import pyperclip


class Clipboard:
    @staticmethod
    def clear() -> None:
        pyperclip.copy('')

    @staticmethod
    def read() -> str:
        return pyperclip.paste()

    @staticmethod
    def poll(timeout: float = 3.0) -> str:
        """Poll the OS clipboard until text is available or timeout is reached."""
        started_at = time.time()
        time.sleep(0.5)  # small delay to let clipboard writes finish

        while time.time() - started_at < timeout:
            clipboard_content = Clipboard.read()
            if clipboard_content != '':
                return clipboard_content.replace('\r\n', '\n') # avoid Windows line endings
            time.sleep(0.1)

        raise TimeoutError(f"Clipboard was empty after {timeout} seconds.")
