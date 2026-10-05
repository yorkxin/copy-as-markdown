"""Resolve Firefox release versions, excluding ESR/pre-release archive entries."""
import json
import re
import sys
from html.parser import HTMLParser
from urllib.request import urlopen

METADATA_ROOT = "https://product-details.mozilla.org/1.0"
ARCHIVE_ROOT = "https://archive.mozilla.org/pub/firefox/releases"
RELEASE_PATTERN = r"[1-9]\d*\.\d+(?:\.\d+)?"


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
    if requested == "latest":
        sources.append(f"{METADATA_ROOT}/firefox_versions.json")
        version = read_json(sources[0])["LATEST_FIREFOX_VERSION"]
    elif re.fullmatch(r"[1-9]\d*", requested):
        sources = [f"{METADATA_ROOT}/firefox_history_major_releases.json",
                   f"{METADATA_ROOT}/firefox_history_stability_releases.json", ARCHIVE_ROOT + "/"]
        major_history, stability_history = (read_json(url) for url in sources[:2])
        with urlopen(sources[2], timeout=30) as response:
            directories = ReleaseDirectories()
            directories.feed(response.read().decode("utf-8"))
        version = select_major(requested, major_history, stability_history, directories.versions)
    elif re.fullmatch(RELEASE_PATTERN, requested):
        version = requested
    else:
        raise ValueError("FIREFOX_VERSION must be latest, a positive major, or an exact release")
    if not re.fullmatch(RELEASE_PATTERN, version):
        raise ValueError(f"Invalid Firefox release: {version}")
    print(json.dumps({"requested": requested, "version": version,
                      "metadata_urls": sources}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError) as error:
        sys.exit(f"Firefox resolution failed: {error}")
