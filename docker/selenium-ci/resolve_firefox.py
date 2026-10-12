"""Resolve Firefox Stable, primary ESR, or a requested release version."""
import json
import re
import sys
from html.parser import HTMLParser
from urllib.request import urlopen

METADATA_ROOT = "https://product-details.mozilla.org/1.0"
ARCHIVE_ROOT = "https://archive.mozilla.org/pub/firefox/releases"
RELEASE_PATTERN = r"[1-9]\d*\.\d+(?:\.\d+)?"


def channel_version(metadata, requested):
    if requested.startswith("esr:"):
        major = requested.removeprefix("esr:")
        if not re.fullmatch(r"[1-9]\d*", major):
            raise ValueError(f"Invalid ESR major: {major}")
        versions = [version for key, version in metadata.items()
                    if key.startswith("FIREFOX_ESR")
                    and re.fullmatch(RELEASE_PATTERN + "esr", version)
                    and version.split(".")[0] == major]
        if not versions:
            raise ValueError(f"No current Firefox ESR release for major {major}")
        return max(versions, key=lambda v: tuple(map(int, v.removesuffix("esr").split("."))))
    key = "FIREFOX_ESR" if requested == "esr" else "LATEST_FIREFOX_VERSION"
    version = metadata[key]
    pattern = RELEASE_PATTERN + ("esr" if requested == "esr" else "")
    if not re.fullmatch(pattern, version):
        raise ValueError(f"Invalid Firefox {requested} release: {version}")
    return version


class ReleaseDirectories(HTMLParser):
    def __init__(self):
        super().__init__()
        self.versions = set()

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            href = dict(attrs).get("href", "").removeprefix("/pub/firefox/releases/")
            if re.fullmatch(RELEASE_PATTERN + "/", href):
                self.versions.add(href[:-1])


def select_major(requested, major_history, stability_history, archive_versions):
    # Stability metadata contains ESR updates without an 'esr' suffix. Only
    # ordinary numeric archive directories establish a release candidate.
    candidates = set(major_history) | set(stability_history)
    candidates = [v for v in candidates if re.fullmatch(RELEASE_PATTERN, v)
                  and v.split(".")[0] == requested and v in archive_versions]
    if not candidates:
        raise ValueError(f"No ordinary Firefox release found for major {requested}")
    return max(candidates, key=lambda v: tuple(int(part) for part in v.split(".")))


def read_json(url):
    with urlopen(url, timeout=30) as response:
        return json.load(response)


def main():
    requested = sys.argv[1]
    sources = []
    if requested in ("latest", "esr") or requested.startswith("esr:"):
        sources.append(f"{METADATA_ROOT}/firefox_versions.json")
        version = channel_version(read_json(sources[0]), requested)
    elif re.fullmatch(r"[1-9]\d*", requested):
        sources = [f"{METADATA_ROOT}/firefox_history_major_releases.json",
                   f"{METADATA_ROOT}/firefox_history_stability_releases.json", ARCHIVE_ROOT + "/"]
        major_history, stability_history = (read_json(url) for url in sources[:2])
        with urlopen(sources[2], timeout=30) as response:
            directories = ReleaseDirectories()
            directories.feed(response.read().decode("utf-8"))
        version = select_major(requested, major_history, stability_history, directories.versions)
    elif re.fullmatch(RELEASE_PATTERN + r"(?:esr)?", requested):
        version = requested
    else:
        raise ValueError("FIREFOX_VERSION must be latest, esr, esr:MAJOR, a positive major, or an exact release")
    if not re.fullmatch(RELEASE_PATTERN + r"(?:esr)?", version):
        raise ValueError(f"Invalid Firefox release: {version}")
    print(json.dumps({"requested": requested, "version": version,
                      "metadata_urls": sources}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        sys.exit(f"Firefox resolution failed: {error}")
