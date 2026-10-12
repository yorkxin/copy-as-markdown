"""Resolve the latest patch of a pinned active Firefox ESR major."""
import json
import re
import sys
from urllib.request import urlopen

RELEASE_PATTERN = r"[1-9]\d*\.\d+(?:\.\d+)?"


def channel_version(metadata, requested):
    major = requested
    if not re.fullmatch(r"[1-9]\d*", major):
        raise ValueError(f"Invalid ESR major: {major}")
    versions = [version for key, version in metadata.items()
                if key.startswith("FIREFOX_ESR")
                and re.fullmatch(RELEASE_PATTERN + "esr", version)
                and version.split(".")[0] == major]
    if not versions:
        raise ValueError(f"No current Firefox ESR release for major {major}")
    return max(versions, key=lambda v: tuple(map(int, v.removesuffix("esr").split("."))))


if __name__ == "__main__":
    try:
        with urlopen("https://product-details.mozilla.org/1.0/firefox_versions.json", timeout=30) as response:
            print(channel_version(json.load(response), sys.argv[1]))
    except (ValueError, OSError) as error:
        sys.exit(f"Firefox ESR resolution failed: {error}")
