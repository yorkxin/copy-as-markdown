"""Explicit image refresh; advanced version inputs are confined to this command."""
import signal
import subprocess
import sys

from docker_e2e import main

if __name__ == "__main__":
    signal.signal(signal.SIGTERM, lambda signum, frame: sys.exit(128 + signum))
    try:
        main(build_only=True)
    except KeyboardInterrupt:
        sys.exit(130)
    except subprocess.CalledProcessError as error:
        sys.exit(error.returncode if error.returncode > 0 else 128 - error.returncode)
    except (ValueError, KeyError, OSError) as error:
        sys.exit(f"Image build failed: {error}")
